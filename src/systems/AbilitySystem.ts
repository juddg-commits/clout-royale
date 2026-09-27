/**
 * AbilitySystem — data-driven executor for the player's abilities.
 * Reads the class's abilityIds from CLASS_REGISTRY, resolves each against
 * ABILITY_REGISTRY, binds its slot key, tracks cooldowns, draws HUD icons.
 *
 * Adding an ability to a class = a registry entry + one executor function
 * in the map below. Cooldowns, input, and HUD icons are generic.
 */
import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { ABILITY_REGISTRY, type AbilityDef, type AbilitySlot } from '../data/abilities';
import type { Player } from '../entities/Player';
import { Bot } from '../entities/Bot';
import type { CombatSystem } from './CombatSystem';
import type { EffectsSystem } from './EffectsSystem';

interface AbilityIcon {
  def: AbilityDef;
  frame: Phaser.GameObjects.Rectangle;
  cdOverlay: Phaser.GameObjects.Rectangle;
  cdText: Phaser.GameObjects.Text;
}

export class AbilitySystem {
  private scene: Phaser.Scene;
  private player: Player;
  private botGroup: Phaser.Physics.Arcade.Group;
  private combat: CombatSystem;
  private effects: EffectsSystem;

  private abilities: AbilityDef[];
  private keys: Partial<Record<AbilitySlot, Phaser.Input.Keyboard.Key>>;
  private nextReadyAt: Record<string, number> = {};
  private icons: AbilityIcon[] = [];

  constructor(
    scene: Phaser.Scene,
    player: Player,
    botGroup: Phaser.Physics.Arcade.Group,
    combat: CombatSystem,
    effects: EffectsSystem,
  ) {
    this.scene = scene;
    this.player = player;
    this.botGroup = botGroup;
    this.combat = combat;
    this.effects = effects;

    this.abilities = player.classDef.abilityIds
      .map((id) => ABILITY_REGISTRY[id])
      .filter((def): def is AbilityDef => def !== undefined);

    this.keys = scene.input.keyboard!.addKeys('Q,E,R,SHIFT') as Record<AbilitySlot, Phaser.Input.Keyboard.Key>;
    this.buildHudIcons();
  }

  update(time: number): void {
    for (const def of this.abilities) {
      const key = this.keys[def.slot];
      if (key && Phaser.Input.Keyboard.JustDown(key)) this.tryCast(def, time);
    }
    this.updateHudIcons(time);
  }

  /** Registry cooldown after the Pre-Workout Stack upgrade. */
  private cooldownFor(def: AbilityDef): number {
    return Math.round(def.cooldownMs * this.player.upgradeMods.abilityCooldownMult);
  }

  private tryCast(def: AbilityDef, time: number): void {
    if (this.player.dead) return;
    if (time < (this.nextReadyAt[def.id] ?? 0)) return;
    const executor = this.executors[def.id];
    if (!executor) return;
    this.nextReadyAt[def.id] = time + this.cooldownFor(def);
    executor(time);
  }

  // ---------------------------------------------------------------------
  // Executors — one per ability id. New ability = new entry here.
  // ---------------------------------------------------------------------
  private executors: Record<string, (time: number) => void> = {
    /** Q — cone stare: damage + width scale with Aura; hits steal Aura back. */
    mogBeam: () => {
      const cfg = CONFIG.ABILITIES.MOG_BEAM;
      const aura = this.player.stats.aura;
      const damage = Math.round(cfg.DAMAGE * (1 + aura * CONFIG.METERS.AURA_MOG_BEAM_BONUS_PER_POINT));
      const halfAngle = Phaser.Math.DegToRad(cfg.CONE_HALF_ANGLE_DEG * (1 + aura * cfg.AURA_WIDTH_BONUS_PER_POINT));
      const aim = this.player.rotation;
      this.player.addAura(-cfg.AURA_COST);

      // Visible cone flash in the aim direction.
      const cone = this.scene.add.graphics().setDepth(8);
      cone.fillStyle(0xbfe8ff, 0.3);
      cone.slice(this.player.x, this.player.y, cfg.RANGE_PX, aim - halfAngle, aim + halfAngle, false);
      cone.fillPath();
      this.scene.tweens.add({ targets: cone, alpha: 0, duration: cfg.VISUAL_FADE_MS, onComplete: () => cone.destroy() });

      // Snapshot the list — hitBot can destroy bots mid-iteration.
      const bots = [...(this.botGroup.getChildren() as Bot[])];
      for (const bot of bots) {
        if (!bot.active) continue;
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, bot.x, bot.y);
        if (dist > cfg.RANGE_PX) continue;
        const toBot = Phaser.Math.Angle.Between(this.player.x, this.player.y, bot.x, bot.y);
        if (Math.abs(Phaser.Math.Angle.Wrap(toBot - aim)) > halfAngle) continue;
        this.effects.floatText(bot.x, bot.y - 34, 'MOGGED', '#9be7ff');
        this.player.addAura(cfg.AURA_STEAL_PER_HIT); // their aura is yours now
        this.combat.hitBot(bot, damage, toBot, CONFIG.COMBAT.KNOCKBACK.VELOCITY);
      }
    },

    /** E — timed block; the reflect itself is handled in CombatSystem. */
    mewingParry: (time) => {
      this.player.startParry(time);
      this.effects.floatText(this.player.x, this.player.y - 34, 'mewing...', '#c8f7ff');
    },

    /** Shift — damaging dash; GameScene applies dash hits + afterimages. */
    dryScoopDash: (time) => {
      this.player.startDash(time);
      this.effects.floatText(this.player.x, this.player.y - 34, 'DRY SCOOP', '#ffd28a');
    },

    /** R — ult buff; cringe spike on end is handled in Player.update. */
    fakePlatesRage: (time) => {
      this.player.startRage(time);
      this.effects.memePopup('FAKE PLATES RAGE', '#ff6b6b');
    },
  };

  // ---------------------------------------------------------------------
  // HUD cooldown icons
  // ---------------------------------------------------------------------

  private buildHudIcons(): void {
    const bar = CONFIG.UI.ABILITY_BAR;
    const depth = CONFIG.UI.HUD_DEPTH;
    const y = CONFIG.CANVAS.HEIGHT - bar.Y_OFFSET_FROM_BOTTOM;
    const totalWidth = (this.abilities.length - 1) * bar.SPACING;
    const startX = CONFIG.CANVAS.WIDTH / 2 - totalWidth / 2;

    this.abilities.forEach((def, i) => {
      const x = startX + i * bar.SPACING;
      const frame = this.scene.add
        .rectangle(x, y, bar.ICON_SIZE, bar.ICON_SIZE, 0x1e1e30, 0.9)
        .setStrokeStyle(2, 0xffe066)
        .setDepth(depth);
      const keyLabel = def.slot === 'SHIFT' ? 'SHF' : def.slot;
      this.scene.add
        .text(x, y - 8, keyLabel, { fontFamily: CONFIG.UI.FONT, fontSize: '18px', color: '#ffffff', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setDepth(depth + 1);
      this.scene.add
        .text(x, y + 14, def.shortName, { fontFamily: CONFIG.UI.FONT, fontSize: '10px', color: '#aaaacc' })
        .setOrigin(0.5)
        .setDepth(depth + 1);
      const cdOverlay = this.scene.add
        .rectangle(x, y + bar.ICON_SIZE / 2, bar.ICON_SIZE, bar.ICON_SIZE, 0x000000, 0.7)
        .setOrigin(0.5, 1)
        .setDepth(depth + 2)
        .setVisible(false);
      const cdText = this.scene.add
        .text(x, y, '', { fontFamily: CONFIG.UI.FONT, fontSize: '15px', color: '#ffffff', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setDepth(depth + 3);
      this.icons.push({ def, frame, cdOverlay, cdText });
    });
  }

  private updateHudIcons(time: number): void {
    const size = CONFIG.UI.ABILITY_BAR.ICON_SIZE;
    for (const icon of this.icons) {
      const remaining = Math.max(0, (this.nextReadyAt[icon.def.id] ?? 0) - time);
      if (remaining > 0) {
        const frac = remaining / this.cooldownFor(icon.def);
        icon.cdOverlay.setVisible(true).setDisplaySize(size, Math.max(1, size * frac));
        icon.cdText.setText(`${Math.ceil(remaining / 1000)}`);
        icon.frame.setStrokeStyle(2, 0x555577);
      } else {
        icon.cdOverlay.setVisible(false);
        icon.cdText.setText('');
        icon.frame.setStrokeStyle(2, 0xffe066);
      }
    }
  }
}
