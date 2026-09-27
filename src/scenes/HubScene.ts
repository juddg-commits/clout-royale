/**
 * HubScene — the Aura Mansion as a non-combat home base.
 * Walk around (no bots, no combat/ability systems loaded), use interactables
 * (walk close + E), pick a mission at the terminal, and read the result
 * banner when a run hands control back here.
 */
import Phaser from 'phaser';
import { CONFIG, type HubInteractableConfig } from '../data/config';
import {
  MISSION_REGISTRY,
  elimsLabel,
  formatClock,
  isMissionUnlocked,
  objectiveLabel,
  outcomePresentation,
  type MissionDef,
  type MissionResult,
} from '../data/missions';
import { HubAvatar } from '../entities/HubAvatar';
import { EffectsSystem } from '../systems/EffectsSystem';
import { ProgressionSystem, type SaveData } from '../systems/ProgressionSystem';
import { drawMansion, makeMansionTextures } from './mansion';

interface HubSceneData {
  result?: MissionResult;
  /** Offline automation earnings computed by BootScene (page-load arrivals only). */
  offlineHaul?: { money: number; clout: number };
}

interface PlacedInteractable {
  def: HubInteractableConfig;
  marker: Phaser.GameObjects.Rectangle;
}

export class HubScene extends Phaser.Scene {
  private avatar!: HubAvatar;
  private effects!: EffectsSystem;
  private save!: SaveData;
  private keys!: { E: Phaser.Input.Keyboard.Key; ESC: Phaser.Input.Keyboard.Key };
  private interactables: PlacedInteractable[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private pickerOpen = false;
  private pickerObjects: Phaser.GameObjects.GameObject[] = [];
  private statsObjects: Phaser.GameObjects.GameObject[] = [];
  private lastResult?: MissionResult;
  private offlineHaul?: { money: number; clout: number };

  constructor() {
    super('HubScene');
  }

  init(data: HubSceneData): void {
    this.lastResult = data?.result;
    this.offlineHaul = data?.offlineHaul;
  }

  create(): void {
    // Scene instances survive re-entry — reset per-visit state here.
    this.pickerOpen = false;
    this.pickerObjects = [];
    this.statsObjects = [];
    this.interactables = [];

    makeMansionTextures(this);
    drawMansion(this, 'HOME BASE');

    const pad = CONFIG.ARENA.WALL_PADDING;
    this.physics.world.setBounds(pad, pad, CONFIG.CANVAS.WIDTH - pad * 2, CONFIG.CANVAS.HEIGHT - pad * 2);

    this.save = ProgressionSystem.load();
    this.avatar = new HubAvatar(this, CONFIG.HUB.PLAYER_SPAWN.x, CONFIG.HUB.PLAYER_SPAWN.y);
    this.effects = new EffectsSystem(this);
    this.keys = this.input.keyboard!.addKeys('E,ESC') as typeof this.keys;

    for (const def of CONFIG.HUB.INTERACTABLES) {
      const glow = this.add.image(def.x, def.y, 'glow').setTint(def.color).setScale(1.6).setDepth(4);
      this.tweens.add({ targets: glow, alpha: 0.45, scale: 1.3, duration: 1400, repeat: -1, yoyo: true, ease: 'Sine.InOut' });
      const marker = this.add
        .rectangle(def.x, def.y, 30, 30, def.color, 0.95)
        .setStrokeStyle(2, 0xffffff, 0.7)
        .setDepth(5);
      this.tweens.add({ targets: marker, angle: 45, duration: 2400, repeat: -1, yoyo: true, ease: 'Sine.InOut' });
      this.add
        .text(def.x, def.y - 34, def.label, { fontFamily: CONFIG.UI.FONT, fontSize: '11px', fontStyle: 'bold', color: '#e8e8f0', stroke: '#000000', strokeThickness: 3 })
        .setOrigin(0.5)
        .setDepth(5);
      this.interactables.push({ def, marker });
    }

    this.prompt = this.add
      .text(0, 0, '', { fontFamily: CONFIG.UI.FONT, fontSize: '13px', color: '#ffe066', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);

    this.buildHud();
    if (this.lastResult) this.showResultBanner(this.lastResult);
    if (this.offlineHaul && (this.offlineHaul.money > 0 || this.offlineHaul.clout > 0)) {
      this.showOfflineBanner(this.offlineHaul);
      this.offlineHaul = undefined; // once per page load
    }
  }

  update(): void {
    if (!this.pickerOpen) this.avatar.update();

    // Nearest interactable in range gets the "[E]" prompt
    let nearest: PlacedInteractable | null = null;
    let nearestDist = CONFIG.HUB.INTERACT_RADIUS_PX;
    for (const it of this.interactables) {
      const d = Phaser.Math.Distance.Between(this.avatar.x, this.avatar.y, it.def.x, it.def.y);
      if (d <= nearestDist) {
        nearest = it;
        nearestDist = d;
      }
    }
    if (nearest && !this.pickerOpen) {
      this.prompt.setVisible(true).setPosition(nearest.def.x, nearest.def.y + 34).setText(`[E] ${nearest.def.label}`);
    } else {
      this.prompt.setVisible(false);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.E) && nearest && !this.pickerOpen) {
      this.actions[nearest.def.action]?.(nearest.def);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      if (this.pickerOpen) this.closePicker();
      this.clearStatsPanel();
    }
  }

  // ---------------------------------------------------------------------
  // Interactable actions — string-keyed registry, mirrors ability executors
  // ---------------------------------------------------------------------
  private actions: Record<string, (def: HubInteractableConfig) => void> = {
    openMissionSelect: () => this.openPicker(),
    flavor: (def) => {
      if (def.flavorText) this.effects.memePopup(def.flavorText, '#8ecae6');
    },
    showStats: () => this.toggleStatsPanel(),
    openShop: () => {
      // Shop renders OVER the paused hub, so the avatar stays where it is.
      // UpgradeScene stops itself, resumes us, and calls refreshHud() on close.
      // Guard: relaunching an already-running shop would skip create() and
      // leave a stale purchase-input lock.
      if (this.scene.isActive('UpgradeScene') || this.scene.isPaused('UpgradeScene')) return;
      this.scene.launch('UpgradeScene');
      this.scene.pause();
    },
    openAutomation: () => {
      // Same launch-over-paused-hub pattern as the Gains Shop.
      if (this.scene.isActive('AutomationScene') || this.scene.isPaused('AutomationScene')) return;
      this.scene.launch('AutomationScene');
      this.scene.pause();
    },
  };

  // ---------------------------------------------------------------------
  // Mission picker (overlay panel, not a separate scene)
  // ---------------------------------------------------------------------

  private openPicker(): void {
    if (this.pickerOpen) return;
    this.pickerOpen = true;
    this.clearStatsPanel();
    const { WIDTH, HEIGHT } = CONFIG.CANVAS;
    const depth = CONFIG.UI.OVERLAY_DEPTH;

    const dim = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.7).setDepth(depth).setInteractive();
    const title = this.add
      .text(WIDTH / 2, 120, 'MISSION TERMINAL', { fontFamily: CONFIG.UI.FONT, fontSize: '34px', color: '#ffe066', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(depth);
    const hint = this.add
      .text(WIDTH / 2, HEIGHT - 90, '[ESC] close', { fontFamily: CONFIG.UI.FONT, fontSize: '14px', color: '#aaaacc' })
      .setOrigin(0.5)
      .setDepth(depth);
    this.pickerObjects.push(dim, title, hint);

    const missions = Object.values(MISSION_REGISTRY);
    missions.forEach((mission, i) => {
      const y = 220 + i * 130;
      this.pickerObjects.push(...this.buildMissionCard(mission, WIDTH / 2, y, depth));
    });
  }

  private buildMissionCard(mission: MissionDef, x: number, y: number, depth: number): Phaser.GameObjects.GameObject[] {
    const unlocked = isMissionUnlocked(mission, this.save);
    const wins = this.save.missionsCompleted[mission.id] ?? 0;
    const pool = mission.waves.flat().length;
    const gate = mission.unlockAfter ? MISSION_REGISTRY[mission.unlockAfter.missionId] : undefined;
    const need = mission.unlockAfter?.wins ?? 0;

    const card = this.add
      .rectangle(x, y, 640, 110, unlocked ? 0x1e1e30 : 0x15151d, 0.95)
      .setStrokeStyle(2, unlocked ? 0xffe066 : 0x444455)
      .setDepth(depth);
    const name = this.add
      .text(x - 300, y - 38, mission.name, { fontFamily: CONFIG.UI.FONT, fontSize: '20px', color: unlocked ? '#ffffff' : '#666677', fontStyle: 'bold' })
      .setOrigin(0, 0.5)
      .setDepth(depth + 1);
    const tag = this.add
      .text(x - 300, y - 12, mission.tagline, { fontFamily: CONFIG.UI.FONT, fontSize: '12px', color: '#aaaacc' })
      .setOrigin(0, 0.5)
      .setDepth(depth + 1);
    const detailText = unlocked
      ? `${objectiveLabel(mission)} · ${pool} enemies in ${mission.waves.length} waves${mission.loopWaves ? ' (looping)' : ''} · ${formatClock(mission.durationSeconds)} · wins: ${wins}`
      : `locked · win ${gate?.name ?? '?'}${need > 1 ? ` ${need} times` : ''} first`;
    const detail = this.add
      .text(x - 300, y + 16, detailText, { fontFamily: CONFIG.UI.FONT, fontSize: '12px', color: unlocked ? '#8ecae6' : '#666677' })
      .setOrigin(0, 0.5)
      .setDepth(depth + 1);
    const launch = this.add
      .text(x + 300, y + 34, unlocked ? '[CLICK TO DEPLOY]' : '[LOCKED]', {
        fontFamily: CONFIG.UI.FONT,
        fontSize: '13px',
        color: unlocked ? '#7cfc00' : '#666677',
      })
      .setOrigin(1, 0.5)
      .setDepth(depth + 1);

    if (unlocked) {
      card.setInteractive({ useHandCursor: true });
      card.on('pointerover', () => card.setStrokeStyle(3, 0x7cfc00));
      card.on('pointerout', () => card.setStrokeStyle(2, 0xffe066));
      card.on('pointerup', () => this.scene.start('GameScene', { missionId: mission.id }));
    }
    return [card, name, tag, detail, launch];
  }

  private closePicker(): void {
    for (const obj of this.pickerObjects) obj.destroy();
    this.pickerObjects = [];
    this.pickerOpen = false;
  }

  // ---------------------------------------------------------------------
  // Grind Shrine stats panel
  // ---------------------------------------------------------------------

  private toggleStatsPanel(): void {
    if (this.statsObjects.length > 0) {
      this.clearStatsPanel();
      return;
    }
    const depth = CONFIG.UI.OVERLAY_DEPTH;
    const s = this.save;
    const totalWins = Object.values(s.missionsCompleted).reduce((a, b) => a + b, 0);
    const atCap = s.level >= CONFIG.XP.LEVEL_CAP;
    const lines = [
      'THE GRIND SO FAR',
      '',
      `Level ${s.level}${atCap ? ' (MAX)' : `  ·  ${s.xp}/${ProgressionSystem.xpToNext(s.level)} XP`}`,
      `Money: $${s.money}`,
      `Lifetime clout: ${s.totalClout}`,
      `Missions won: ${totalWins}`,
      '',
      '[E] or [ESC] to close',
    ];
    const bg = this.add.rectangle(235, 300, 320, 190, 0x1e1e30, 0.95).setStrokeStyle(2, 0xe74c3c).setDepth(depth);
    const text = this.add
      .text(235, 300, lines.join('\n'), { fontFamily: CONFIG.UI.FONT, fontSize: '13px', color: '#e8e8f0', align: 'center', lineSpacing: 4 })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    this.statsObjects = [bg, text];
  }

  private clearStatsPanel(): void {
    for (const obj of this.statsObjects) obj.destroy();
    this.statsObjects = [];
  }

  // ---------------------------------------------------------------------
  // HUD + result banner
  // ---------------------------------------------------------------------

  private hudText!: Phaser.GameObjects.Text;

  private hudLine(): string {
    const s = this.save;
    const atCap = s.level >= CONFIG.XP.LEVEL_CAP;
    const levelPart = atCap ? `Lv ${s.level} (MAX)` : `Lv ${s.level} (${s.xp}/${ProgressionSystem.xpToNext(s.level)} XP)`;
    return `$${s.money}   Clout ${s.totalClout}   ${levelPart}`;
  }

  /** Re-read the save and repaint the HUD (called by UpgradeScene on close). */
  refreshHud(): void {
    this.save = ProgressionSystem.load();
    this.hudText.setText(this.hudLine());
  }

  private buildHud(): void {
    const depth = CONFIG.UI.HUD_DEPTH;
    this.hudText = this.add
      .text(16, 16, this.hudLine(), {
        fontFamily: CONFIG.UI.FONT,
        fontSize: '15px',
        color: '#ffffff',
      })
      .setDepth(depth);
    this.add
      .text(16, CONFIG.CANVAS.HEIGHT - 28, 'WASD move · walk up to a marker and press E', {
        fontFamily: CONFIG.UI.FONT,
        fontSize: '12px',
        color: '#666688',
      })
      .setDepth(depth);
  }

  /** "While you were gone" moment — points at the Content Studio to collect. */
  private showOfflineBanner(haul: { money: number; clout: number }): void {
    const depth = CONFIG.UI.HUD_DEPTH;
    const parts = [haul.money > 0 ? `$${haul.money}` : '', haul.clout > 0 ? `${haul.clout} clout` : '']
      .filter(Boolean)
      .join(' + ');
    const banner = this.add
      .text(
        CONFIG.CANVAS.WIDTH / 2,
        140,
        `WHILE YOU WERE GONE the slop farmed ${parts}\ncollect it at the CONTENT STUDIO`,
        {
          fontFamily: CONFIG.UI.FONT,
          fontSize: '16px',
          color: '#8d99ae',
          align: 'center',
          lineSpacing: 6,
          backgroundColor: '#000000aa',
          padding: { x: 14, y: 8 },
        },
      )
      .setOrigin(0.5, 0)
      .setDepth(depth + 1);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: CONFIG.HUB.RESULT_BANNER_MS,
      duration: 600,
      onComplete: () => banner.destroy(),
    });
  }

  private showResultBanner(result: MissionResult): void {
    const depth = CONFIG.UI.HUD_DEPTH;
    const mission = MISSION_REGISTRY[result.missionId];
    const { title, color } = outcomePresentation(result);
    const secs = Math.round(result.durationMs / 1000);
    const lines = [
      `${title} — ${mission?.name ?? result.missionId}`,
      `${elimsLabel(result)} · ${secs}s · +$${result.moneyEarned} · +${result.cloutEarned} clout · +${result.xpEarned} XP` +
        (result.levelsGained > 0 ? ` · LEVEL UP x${result.levelsGained}!` : ''),
    ];
    const banner = this.add
      .text(CONFIG.CANVAS.WIDTH / 2, 64, lines.join('\n'), {
        fontFamily: CONFIG.UI.FONT,
        fontSize: '16px',
        color,
        align: 'center',
        lineSpacing: 6,
        backgroundColor: '#000000aa',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setDepth(depth + 1);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: CONFIG.HUB.RESULT_BANNER_MS,
      duration: 600,
      onComplete: () => banner.destroy(),
    });
  }
}
