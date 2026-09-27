/**
 * GameScene — one mission in the Aura Mansion.
 * The Gymfluencer with all four abilities, enemies arriving in waves (a fixed
 * pool or a looping cycle, per mission), aggro-capped bot AI, live meters, the
 * AirWon trend, meme popups, bot voice lines, and punchy hit feedback. The
 * mission's objective (eliminate / survive / collect) decides how it ends.
 */
import Phaser from 'phaser';
import { CONFIG, type BotArchetypeConfig, type SpawnPoint, type TrendStage, type ZoneConfig } from '../data/config';
import { CLASS_REGISTRY, DEFAULT_CLASS_ID } from '../data/classes';
import { MISSION_REGISTRY, DEFAULT_MISSION_ID, elimsLabel, outcomePresentation, type MissionDef, type MissionResult } from '../data/missions';
import { postsFor, BOT_VOICE_LINES, type PostTrigger } from '../data/posts';
import { Player } from '../entities/Player';
import { Bot } from '../entities/Bot';
import { CombatSystem } from '../systems/CombatSystem';
import { TrendSystem } from '../systems/TrendSystem';
import { AbilitySystem } from '../systems/AbilitySystem';
import { AutomationSystem } from '../systems/AutomationSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { addGlow } from '../systems/fx';
import { ProgressionSystem, type SaveData } from '../systems/ProgressionSystem';
import { drawMansion, makeMansionTextures } from './mansion';

type Outcome = 'victory' | 'defeat' | 'timeup';

interface GameSceneData {
  missionId?: string;
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private botGroup!: Phaser.Physics.Arcade.Group;
  private pickupGroup!: Phaser.Physics.Arcade.Group;
  private combat!: CombatSystem;
  private abilitySystem!: AbilitySystem;
  private effects!: EffectsSystem;
  private save!: SaveData;
  private missionDef!: MissionDef;

  // Match state
  private eliminations = 0;
  private timeLeftMs = 0;
  private matchOver = false;
  private startingMoney = 0; // for the moneyEarned delta in the result payload

  // Wave state — fixed pool, no respawns
  private waveIndex = -1;
  private nextWaveAt = Number.POSITIVE_INFINITY;
  private totalPool = 0;
  private deaths = 0;

  // AirWon trend heat (M7) — match-scoped
  private trend!: TrendSystem;
  private smoothieGroup!: Phaser.Physics.Arcade.Group;
  private nextSmoothieAt = Number.POSITIVE_INFINITY;
  private prevTrendStage: TrendStage = 'Underground';
  private smoothiesCollected = 0; // collect-objective progress
  private started = false; // first update() tick schedules waves + smoothies

  // Meter/zone watches (for one-shot popups on threshold crossings)
  private wasCringeSlowed = false;
  private wasAuraLow = false;
  private currentZoneId: string | null = null;

  // HUD
  private hudHealthBar!: Phaser.GameObjects.Graphics;
  private hudHealthText!: Phaser.GameObjects.Text;
  private hudMeterBars!: Phaser.GameObjects.Graphics;
  private hudAuraText!: Phaser.GameObjects.Text;
  private hudCringeText!: Phaser.GameObjects.Text;
  private hudStatsText!: Phaser.GameObjects.Text;
  private hudTimerText!: Phaser.GameObjects.Text;
  private hudElimsText!: Phaser.GameObjects.Text;
  private hudWaveText!: Phaser.GameObjects.Text;
  private hudTrendText!: Phaser.GameObjects.Text;
  private parryGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('GameScene');
  }

  init(data: GameSceneData): void {
    this.missionDef = MISSION_REGISTRY[data?.missionId ?? ''] ?? MISSION_REGISTRY[DEFAULT_MISSION_ID];
  }

  create(): void {
    // Scene instances survive re-entry — reset all match state here.
    this.eliminations = 0;
    this.timeLeftMs = this.missionDef.durationSeconds * 1000;
    this.matchOver = false;
    this.waveIndex = -1;
    this.nextWaveAt = Number.POSITIVE_INFINITY;
    this.deaths = 0;
    this.totalPool = this.missionDef.waves.flat().length;
    this.wasCringeSlowed = false;
    this.wasAuraLow = false;
    this.currentZoneId = null;

    makeMansionTextures(this);
    drawMansion(this, this.missionDef.name);
    this.add
      .text(18, CONFIG.CANVAS.HEIGHT - 30, 'WASD move · Mouse aim · LMB attack · Q/E/Shift/R abilities', {
        fontFamily: CONFIG.UI.FONT,
        fontSize: '12px',
        color: '#d8d8e8',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setDepth(4);

    const pad = CONFIG.ARENA.WALL_PADDING;
    this.physics.world.setBounds(pad, pad, CONFIG.CANVAS.WIDTH - pad * 2, CONFIG.CANVAS.HEIGHT - pad * 2);

    this.save = ProgressionSystem.load();
    this.startingMoney = this.save.money;
    const classDef = CLASS_REGISTRY[DEFAULT_CLASS_ID];
    this.player = new Player(this, CONFIG.CANVAS.WIDTH / 2, CONFIG.CANVAS.HEIGHT / 2, classDef, this.save);

    this.trend = new TrendSystem();
    this.prevTrendStage = 'Underground';
    this.smoothiesCollected = 0;
    this.nextSmoothieAt = Number.POSITIVE_INFINITY; // scheduled on the first tick
    this.started = false;

    this.botGroup = this.physics.add.group();
    this.pickupGroup = this.physics.add.group();
    this.smoothieGroup = this.physics.add.group();
    this.effects = new EffectsSystem(this);

    this.combat = new CombatSystem(this, this.player, this.botGroup, this.effects, {
      onBotEliminated: (bot) => this.handleBotEliminated(bot),
      onPlayerDied: () => this.endMatch('defeat'),
      onParry: (bot) => this.handleParry(bot),
    });
    this.abilitySystem = new AbilitySystem(this, this.player, this.botGroup, this.combat, this.effects);

    this.physics.add.collider(this.player, this.botGroup);
    this.physics.add.collider(this.botGroup, this.botGroup);
    this.physics.add.overlap(this.player, this.pickupGroup, this.handlePickupCollected);
    this.physics.add.overlap(this.player, this.smoothieGroup, this.handleSmoothieCollected);

    this.parryGfx = this.add.graphics().setDepth(9);
    this.buildHud();
    // Waves + smoothies are scheduled in update(): see the `started` block.
  }

  update(time: number, delta: number): void {
    if (this.matchOver) return;

    // First tick: schedule from the live clock. this.time.now is stale during
    // create() (a re-entered scene keeps its last frame's value; a fresh one
    // reads ~0), which made the wave failsafe and the smoothie timer fire
    // instantly instead of 30s / 5s in.
    if (!this.started) {
      this.started = true;
      this.nextSmoothieAt = time + CONFIG.TREND.FIRST_SPAWN_DELAY_MS;
      this.startNextWave(time);
    }

    this.player.update(time, this.combat);
    this.abilitySystem.update(time);
    this.updateDash(time);
    this.updateParryVisual(time);
    this.updateBots(time);
    this.updateWaves(time);
    this.updateZones(delta);
    this.updateMeterWatches();
    this.trend.update(delta);
    this.updateSmoothies(time);
    this.updateTrendWatch();

    if (this.player.rageJustEnded) {
      this.player.rageJustEnded = false;
      this.firePopup('rageEnd', '#ff6b6b');
    }

    this.timeLeftMs = Math.max(0, this.timeLeftMs - delta);
    this.updateHud();

    // --- End conditions (death arrives via the combat callback) ---
    // The timer is the win for SURVIVE and a draw for everything else.
    // Objective targets end the match instantly; clearing a fixed pool wins outright.
    const objective = this.missionDef.objective;
    if (this.timeLeftMs <= 0) {
      this.endMatch(objective.type === 'survive' ? 'victory' : 'timeup');
    } else if (objective.type === 'eliminate' && this.eliminations >= objective.target) {
      this.endMatch('victory');
    } else if (objective.type === 'collect' && this.smoothiesCollected >= objective.target) {
      this.endMatch('victory');
    } else if (!this.missionDef.loopWaves && this.deaths >= this.totalPool) {
      this.endMatch('victory'); // arena cleared
    }
  }

  // ---------------------------------------------------------------------
  // Per-frame subsystems
  // ---------------------------------------------------------------------

  /** Aggro cap: nearest N bots attack, the rest hover at standoff range. */
  private updateBots(time: number): void {
    const bots = (this.botGroup.getChildren() as Bot[]).filter((b) => b.active);
    const byDistance = [...bots].sort(
      (a, b) =>
        Phaser.Math.Distance.Between(a.x, a.y, this.player.x, this.player.y) -
        Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y),
    );
    byDistance.forEach((bot, i) => {
      bot.updateAI(time, this.player, i < CONFIG.BOTS.AGGRO.MAX_ATTACKERS ? 'attack' : 'standoff');
    });

    // Occasional cringe voice lines.
    const voice = CONFIG.BOTS.VOICE;
    for (const bot of bots) {
      if (time >= bot.nextVoiceAt) {
        const lines = BOT_VOICE_LINES[bot.def.id];
        if (lines && lines.length > 0) bot.say(Phaser.Utils.Array.GetRandom(lines));
        bot.nextVoiceAt = time + Phaser.Math.Between(voice.MIN_INTERVAL_MS, voice.MAX_INTERVAL_MS);
      }
    }
  }

  /** Dash hits + afterimage trail while the player is mid-Dry-Scoop. */
  private updateDash(time: number): void {
    if (!this.player.isDashing(time)) return;

    const ghost = this.add
      .image(this.player.x, this.player.y, 'player')
      .setScale(this.player.scaleX)
      .setRotation(this.player.rotation)
      .setAlpha(0.35)
      .setDepth(9);
    this.tweens.add({ targets: ghost, alpha: 0, duration: 200, onComplete: () => ghost.destroy() });

    const cfg = CONFIG.ABILITIES.DRY_SCOOP_DASH;
    const bots = [...(this.botGroup.getChildren() as Bot[])];
    for (const bot of bots) {
      if (!bot.active || this.player.dashHitSet.has(bot)) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, bot.x, bot.y);
      if (dist <= cfg.HIT_RADIUS_PX) {
        this.player.dashHitSet.add(bot);
        this.combat.hitBot(bot, cfg.DAMAGE, this.player.currentDashAngle, CONFIG.COMBAT.KNOCKBACK.VELOCITY);
      }
    }
  }

  private updateParryVisual(time: number): void {
    this.parryGfx.clear();
    if (this.player.isParrying(time) && !this.player.dead) {
      this.parryGfx.lineStyle(3, 0x9be7ff, 0.9);
      this.parryGfx.strokeCircle(this.player.x, this.player.y, 26);
    }
  }

  /** Next wave when the field is clear, or after the failsafe interval. Looping missions never run dry. */
  private updateWaves(time: number): void {
    const onLastWave = this.waveIndex >= this.missionDef.waves.length - 1;
    if (onLastWave && !this.missionDef.loopWaves) return;
    const alive = this.botGroup.countActive(true);
    if (alive === 0 || time >= this.nextWaveAt) {
      this.startNextWave(time);
    }
  }

  private startNextWave(time: number): void {
    this.waveIndex += 1;
    const lineup = this.missionDef.waves[this.waveIndex % this.missionDef.waves.length];
    if (!lineup) return;
    for (const archetypeId of lineup) {
      this.spawnBot(archetypeId, time);
    }
    this.nextWaveAt = time + this.missionDef.waveMaxIntervalMs;
    if (this.waveIndex > 0) {
      this.effects.memePopup(`WAVE ${this.waveIndex + 1} PULLED UP`, '#8ecae6');
    }
  }

  /** Zone effects: backyard drains Cringe, smoothie shop grants Aura on entry. */
  private updateZones(delta: number): void {
    const zone = this.zoneAt(this.player.x, this.player.y);
    const zoneId = zone?.id ?? null;

    if (zoneId !== this.currentZoneId) {
      this.currentZoneId = zoneId;
      if (zoneId === 'touchGrassBackyard') {
        this.firePopup('zoneBackyard', '#7bb661');
      } else if (zoneId === 'smoothieShop') {
        this.player.addAura(CONFIG.METERS.SMOOTHIE_AURA_GAIN);
        this.firePopup('zoneSmoothieShop', '#27ae60');
      }
    }

    if (zoneId === 'touchGrassBackyard' && this.player.stats.cringe > 0) {
      this.player.addCringe(-CONFIG.METERS.CRINGE_DECAY_IN_BACKYARD_PER_SECOND * (delta / 1000));
    }
  }

  private zoneAt(x: number, y: number): ZoneConfig | undefined {
    return CONFIG.ARENA.ZONES.find(
      (z) => x >= z.x && x <= z.x + z.width && y >= z.y && y <= z.y + z.height,
    );
  }

  /** One-shot popups when meters cross their thresholds. */
  private updateMeterWatches(): void {
    const slowed = this.player.isCringeSlowed();
    if (slowed && !this.wasCringeSlowed) this.firePopup('cringeHigh', '#ff6bd6');
    this.wasCringeSlowed = slowed;

    const auraLow = this.player.stats.aura < CONFIG.METERS.AURA_LOW_THRESHOLD;
    if (auraLow && !this.wasAuraLow) this.firePopup('auraLow', '#b39ddb');
    this.wasAuraLow = auraLow;
  }

  /** Spawn smoothies in the AirWon shop; melt them if ignored. */
  private updateSmoothies(time: number): void {
    if (time < this.nextSmoothieAt) return;
    if (this.smoothieGroup.countActive(true) >= CONFIG.TREND.MAX_ON_FIELD) return;
    this.nextSmoothieAt = time + CONFIG.TREND.SPAWN_INTERVAL_MS;

    const shop = CONFIG.ARENA.ZONES.find((z) => z.id === 'smoothieShop');
    if (!shop) return;
    const x = Phaser.Math.Between(shop.x + 24, shop.x + shop.width - 24);
    const y = Phaser.Math.Between(shop.y + 34, shop.y + shop.height - 24);
    const smoothie = this.smoothieGroup.create(x, y, 'smoothie') as Phaser.Physics.Arcade.Image;
    smoothie.setDepth(4);
    this.attachGlow(smoothie, 0x40e0d0, 0.9);
    addGlow(smoothie, 0x40e0d0);
    this.tweens.add({ targets: smoothie, y: y - 5, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.InOut' });
    this.time.delayedCall(CONFIG.TREND.SMOOTHIE_LIFETIME_MS, () => {
      if (smoothie.active) smoothie.destroy(); // it melted
    });
  }

  /** Grab pays out at the CURRENT stage, THEN pumps the heat. */
  private handleSmoothieCollected: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_playerObj, smoothieObj) => {
    const smoothie = smoothieObj as Phaser.Physics.Arcade.Image;
    if (!smoothie.active || this.matchOver) return;
    const payout = this.trend.payout();
    smoothie.destroy();
    this.smoothiesCollected += 1;
    this.player.stats.money += payout.money;
    this.player.stats.clout += payout.clout;
    if (payout.cringe > 0) this.player.addCringe(payout.cringe);
    this.trend.addHeat(CONFIG.TREND.HEAT_PER_SMOOTHIE);

    const parts = [`+$${payout.money}`, payout.clout > 0 ? `+${payout.clout}c` : '', payout.cringe > 0 ? `+${payout.cringe} CRINGE` : '']
      .filter(Boolean)
      .join('  ');
    this.effects.floatText(smoothie.x, smoothie.y - 16, parts, payout.cringe > 0 ? '#ff6bd6' : '#40e0d0');
    this.effects.burst(smoothie.x, smoothie.y, payout.cringe > 0 ? 0xff6bd6 : 0x40e0d0, 10, 140);
    this.firePopup('smoothieGrab', '#40e0d0');
  };

  /** Stage-crossing popups — only on the way UP (decay is silent). */
  private updateTrendWatch(): void {
    const stage = this.trend.stage;
    if (stage === this.prevTrendStage) return;
    const order: Record<TrendStage, number> = { Underground: 0, Viral: 1, Mainstream: 2, Washed: 3 };
    if (order[stage] > order[this.prevTrendStage]) {
      const triggers: Partial<Record<TrendStage, PostTrigger>> = {
        Viral: 'trendViral',
        Mainstream: 'trendMainstream',
        Washed: 'trendWashed',
      };
      const trigger = triggers[stage];
      if (trigger) this.firePopup(trigger, stage === 'Washed' ? '#ff6bd6' : '#40e0d0');
    }
    this.prevTrendStage = stage;
  }

  /** Fire a random popup registered for this trigger. */
  private firePopup(trigger: PostTrigger, color?: string): void {
    const candidates = postsFor(trigger);
    if (candidates.length === 0) return;
    this.effects.memePopup(Phaser.Utils.Array.GetRandom(candidates).text, color);
  }

  // ---------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------

  private buildHud(): void {
    const depth = CONFIG.UI.HUD_DEPTH;
    const bar = CONFIG.UI.HEALTH_BAR;
    const font = { fontFamily: CONFIG.UI.FONT, color: '#ffffff' };

    // Panels behind the two HUD clusters so text stays readable over any zone.
    const panels = this.add.graphics().setDepth(depth - 1);
    panels.fillStyle(0x000000, 0.42);
    panels.fillRoundedRect(8, 6, 312, 92, 12);
    panels.fillRoundedRect(CONFIG.CANVAS.WIDTH - 332, 6, 324, 78, 12);

    this.hudHealthBar = this.add.graphics().setDepth(depth);
    this.hudHealthText = this.add
      .text(bar.X + bar.WIDTH + 10, bar.Y + 2, '', { ...font, fontSize: '13px' })
      .setDepth(depth);

    this.hudMeterBars = this.add.graphics().setDepth(depth);
    const meterY = bar.Y + bar.HEIGHT + 8;
    this.hudAuraText = this.add
      .text(bar.X + CONFIG.UI.METER_BAR.WIDTH + 8, meterY - 2, '', { ...font, fontSize: '11px', color: '#9be7ff' })
      .setDepth(depth);
    this.hudCringeText = this.add
      .text(bar.X + CONFIG.UI.METER_BAR.WIDTH + 8, meterY + 14, '', { ...font, fontSize: '11px', color: '#ff6bd6' })
      .setDepth(depth);

    this.hudStatsText = this.add
      .text(bar.X, meterY + 32, '', { ...font, fontSize: '13px', color: '#ccccdd' })
      .setDepth(depth);
    this.hudTimerText = this.add
      .text(CONFIG.CANVAS.WIDTH / 2, 12, '', { ...font, fontSize: '28px', fontStyle: 'bold', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5, 0)
      .setDepth(depth);
    this.hudElimsText = this.add
      .text(CONFIG.CANVAS.WIDTH - 16, 16, '', { ...font, fontSize: '16px' })
      .setOrigin(1, 0)
      .setDepth(depth);
    this.hudWaveText = this.add
      .text(CONFIG.CANVAS.WIDTH - 16, 40, '', { ...font, fontSize: '13px', color: '#aaaacc' })
      .setOrigin(1, 0)
      .setDepth(depth);
    this.hudTrendText = this.add
      .text(CONFIG.CANVAS.WIDTH - 16, 60, '', { ...font, fontSize: '13px', color: '#40e0d0' })
      .setOrigin(1, 0)
      .setDepth(depth);

    this.updateHud();
  }

  private updateHud(): void {
    const bar = CONFIG.UI.HEALTH_BAR;
    const meter = CONFIG.UI.METER_BAR;
    const s = this.player.stats;

    // Health bar
    const pct = Phaser.Math.Clamp(s.health / s.maxHealth, 0, 1);
    this.hudHealthBar.clear();
    this.hudHealthBar.fillStyle(0x000000, 0.65).fillRoundedRect(bar.X, bar.Y, bar.WIDTH, bar.HEIGHT, 6);
    const hpColor = pct > 0.5 ? 0x2ecc71 : pct > 0.25 ? 0xf1c40f : 0xe74c3c;
    const hpWidth = (bar.WIDTH - 4) * pct;
    if (hpWidth > 0) this.hudHealthBar.fillStyle(hpColor, 1).fillRoundedRect(bar.X + 2, bar.Y + 2, Math.max(hpWidth, 8), bar.HEIGHT - 4, 5);
    this.hudHealthText.setText(`HP ${Math.ceil(s.health)}/${s.maxHealth}`);

    // Aura / Cringe meter bars (cringe turns red when slowing the player)
    const meterY = bar.Y + bar.HEIGHT + 8;
    const auraPct = s.aura / CONFIG.METERS.AURA_MAX;
    const cringePct = s.cringe / CONFIG.METERS.CRINGE_MAX;
    const slowed = this.player.isCringeSlowed();
    this.hudMeterBars.clear();
    const meterFill = (y: number, pctFill: number, color: number) => {
      this.hudMeterBars.fillStyle(0x000000, 0.65).fillRoundedRect(bar.X, y, meter.WIDTH, meter.HEIGHT, 4);
      const w = (meter.WIDTH - 2) * pctFill;
      if (w > 0) this.hudMeterBars.fillStyle(color, 1).fillRoundedRect(bar.X + 1, y + 1, Math.max(w, 6), meter.HEIGHT - 2, 3);
    };
    meterFill(meterY, auraPct, 0x9be7ff);
    meterFill(meterY + 16, cringePct, slowed ? 0xff3355 : 0xff6bd6);
    // Cringe-slow threshold tick mark
    const tickX = bar.X + meter.WIDTH * (CONFIG.METERS.CRINGE_SLOW_THRESHOLD / CONFIG.METERS.CRINGE_MAX);
    this.hudMeterBars.fillStyle(0xffffff, 0.8).fillRect(tickX, meterY + 15, 1, meter.HEIGHT + 2);

    this.hudAuraText.setText(`AURA ${Math.round(s.aura)}`);
    this.hudCringeText.setText(`CRINGE ${Math.round(s.cringe)}${slowed ? '  SLOWED!' : ''}`);

    const maxed = this.save.level >= CONFIG.XP.LEVEL_CAP ? ' (MAX)' : '';
    this.hudStatsText.setText(`$${s.money}   Clout ${s.clout}   Lv ${this.save.level}${maxed}`);

    const totalSec = Math.ceil(this.timeLeftMs / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = (totalSec % 60).toString().padStart(2, '0');
    this.hudTimerText.setText(`${mm}:${ss}`);

    this.hudElimsText.setText(this.objectiveHudText());
    const waveNo = Math.max(1, this.waveIndex + 1);
    this.hudWaveText.setText(
      this.missionDef.loopWaves
        ? `Wave ${waveNo} · Elims ${this.eliminations}`
        : `Wave ${waveNo}/${this.missionDef.waves.length} · Enemies left ${this.totalPool - this.deaths}`,
    );
    const heatTicks = Math.round((this.trend.heat / CONFIG.TREND.HEAT_MAX) * 10);
    this.hudTrendText.setText(`AIRWON: ${this.trend.stage.toUpperCase()} ${'▓'.repeat(heatTicks)}${'░'.repeat(10 - heatTicks)}`);
  }

  /** Top-right objective readout, per objective type. */
  private objectiveHudText(): string {
    const objective = this.missionDef.objective;
    switch (objective.type) {
      case 'eliminate':
        return `Elims ${this.eliminations}/${objective.target}`;
      case 'survive':
        return 'SURVIVE THE TIMER';
      case 'collect':
        return `Smoothies ${this.smoothiesCollected}/${objective.target}`;
    }
  }

  // ---------------------------------------------------------------------
  // Bots, drops, pickups
  // ---------------------------------------------------------------------

  private spawnBot(archetypeId: string, time: number): void {
    const def = CONFIG.BOTS.ARCHETYPES[archetypeId];
    if (!def) return;
    const point = this.pickSpawnPoint();
    const bot = new Bot(this, point.x, point.y, def, (b) => this.combat.botAttacksPlayer(b));
    bot.nextVoiceAt = time + Phaser.Math.Between(1500, CONFIG.BOTS.VOICE.MAX_INTERVAL_MS);
    this.botGroup.add(bot);
    // Group defaults reset collideWorldBounds on add, so re-apply it (knockback could push bots off-arena).
    bot.setCollideWorldBounds(true);
  }

  private pickSpawnPoint(): SpawnPoint {
    const points = CONFIG.BOTS.SPAWN_POINTS;
    const valid = points.filter(
      (p) => Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y) >= CONFIG.BOTS.MIN_SPAWN_DISTANCE_PX,
    );
    return Phaser.Utils.Array.GetRandom(valid.length > 0 ? valid : points);
  }

  private handleBotEliminated(bot: Bot): void {
    this.eliminations += 1;
    this.deaths += 1;
    this.effects.floatText(bot.x, bot.y - 20, 'ELIMINATED', '#ff6b6b');
    this.effects.burst(bot.x, bot.y, bot.def.color, 22, 260);
    this.firePopup('elimination');
    this.spawnPickup(bot.x, bot.y, bot.def);
  }

  private handleParry(bot: Bot): void {
    this.effects.floatText(this.player.x, this.player.y - 36, 'PARRIED!', '#7cfc00');
    this.effects.floatText(this.player.x, this.player.y - 52, `+${CONFIG.ABILITIES.MEWING_PARRY.AURA_GAIN} aura`, '#9be7ff');
    this.cameras.main.flash(120, 155, 231, 255);
    void bot;
  }

  private spawnPickup(x: number, y: number, def: BotArchetypeConfig): void {
    const pickup = this.pickupGroup.create(x, y, 'pickup') as Phaser.Physics.Arcade.Image;
    pickup.setDepth(4);
    this.attachGlow(pickup, 0xffd700, 0.8);
    addGlow(pickup, 0xffd700);
    pickup.setData('money', def.moneyDrop);
    pickup.setData('clout', def.cloutDrop);
    this.tweens.add({ targets: pickup, scale: 1.3, yoyo: true, repeat: -1, duration: 400 });
    this.time.delayedCall(CONFIG.PICKUPS.LIFETIME_MS, () => {
      if (pickup.active) pickup.destroy();
    });
  }

  /** Pulsing tinted glow that follows a drop and dies with it. */
  private attachGlow(target: Phaser.GameObjects.Image, color: number, scale: number): void {
    const glow = this.add.image(target.x, target.y, 'glow').setTint(color).setScale(scale).setDepth(3.5);
    this.tweens.add({ targets: glow, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
    target.once(Phaser.GameObjects.Events.DESTROY, () => glow.destroy());
  }

  private handlePickupCollected: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_playerObj, pickupObj) => {
    const pickup = pickupObj as Phaser.Physics.Arcade.Image;
    if (!pickup.active || this.matchOver) return;
    const money = (pickup.getData('money') as number) ?? 0;
    const clout = (pickup.getData('clout') as number) ?? 0;
    this.player.stats.money += money;
    this.player.stats.clout += clout;
    this.effects.floatText(pickup.x, pickup.y - 14, `+$${money}  +${clout} clout`, '#ffd700');
    this.effects.burst(pickup.x, pickup.y, 0xffd700, 8, 120);
    pickup.destroy();
  };

  // ---------------------------------------------------------------------
  // Match end
  // ---------------------------------------------------------------------

  private endMatch(outcome: Outcome): void {
    if (this.matchOver) return;
    this.matchOver = true;
    this.physics.pause();

    if (outcome === 'defeat') this.firePopup('gotEliminated', '#ff6b6b');

    // Victory cleanup crew: bank drops still on the ground (see CONFIG.PICKUPS).
    if (outcome === 'victory' && CONFIG.PICKUPS.AUTO_COLLECT_ON_VICTORY) {
      for (const obj of this.pickupGroup.getChildren() as Phaser.Physics.Arcade.Image[]) {
        if (!obj.active) continue;
        this.player.stats.money += (obj.getData('money') as number) ?? 0;
        this.player.stats.clout += (obj.getData('clout') as number) ?? 0;
      }
    }

    // Bank the match: money, lifetime clout, mission wins, and XP persist.
    const clearedPool = !this.missionDef.loopWaves && this.deaths >= this.totalPool;
    const xpEarned =
      this.eliminations * CONFIG.XP.PER_ELIMINATION +
      CONFIG.XP.OUTCOME_BONUS[outcome] +
      (outcome === 'victory' && clearedPool ? CONFIG.XP.CLEARED_BONUS : 0);
    const moneyEarned = this.player.stats.money - this.startingMoney;
    const cloutEarned = this.player.stats.clout;
    this.save.money = this.player.stats.money;
    this.save.totalClout += cloutEarned;
    if (outcome === 'victory') {
      this.save.missionsCompleted[this.missionDef.id] = (this.save.missionsCompleted[this.missionDef.id] ?? 0) + 1;
    }
    const { levelsGained } = ProgressionSystem.addXp(this.save, xpEarned);
    AutomationSystem.fold(this.save, Date.now(), 1); // bank the online trickle too
    ProgressionSystem.save(this.save);

    const result: MissionResult = {
      missionId: this.missionDef.id,
      outcome,
      victoryType: outcome === 'victory' ? this.victoryType(clearedPool) : undefined,
      eliminations: this.eliminations,
      totalPool: this.totalPool,
      smoothiesCollected: this.smoothiesCollected,
      durationMs: this.missionDef.durationSeconds * 1000 - this.timeLeftMs,
      moneyEarned,
      cloutEarned,
      xpEarned,
      levelsGained,
      peakTrendStage: TrendSystem.stageFor(this.trend.peakHeat),
    };

    this.showEndOverlay(result);
  }

  /** Which victory condition fired — survive missions win on the timer, the rest on target/clear. */
  private victoryType(clearedPool: boolean): MissionResult['victoryType'] {
    if (this.missionDef.objective.type === 'survive') return 'survived';
    return clearedPool ? 'cleared' : 'target';
  }

  private showEndOverlay(result: MissionResult): void {
    const { WIDTH, HEIGHT } = CONFIG.CANVAS;
    const depth = CONFIG.UI.OVERLAY_DEPTH;
    const { title, color } = outcomePresentation(result);
    const objective = this.missionDef.objective;
    const summary =
      objective.type === 'collect'
        ? `Smoothies ${this.smoothiesCollected}/${objective.target} · ${elimsLabel(result)}`
        : elimsLabel(result);

    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.72).setDepth(depth);
    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 110, title, {
        fontFamily: CONFIG.UI.FONT,
        fontSize: '52px',
        color,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(depth);

    // Title beat only — the full recap now lives on the creator feed
    // (PostMatchScene). Level-up / XP / money detail renders there.
    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 20, summary, {
        fontFamily: CONFIG.UI.FONT,
        fontSize: '18px',
        color: '#e8e8f0',
      })
      .setOrigin(0.5, 0)
      .setDepth(depth);

    const prompt = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 90, 'Click to check the feed', {
        fontFamily: CONFIG.UI.FONT,
        fontSize: '16px',
        color: '#aaaacc',
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.tweens.add({ targets: prompt, alpha: 0.35, yoyo: true, repeat: -1, duration: 600 });

    // Short lock so a held attack click doesn't instantly dismiss the screen.
    // Transition on pointerUP (not down): switching scenes mid-press would eat
    // the release event and leave activePointer.isDown latched true in the
    // next scene, making the player auto-fire forever.
    this.time.delayedCall(CONFIG.MATCH.RESTART_INPUT_LOCK_MS, () => {
      this.input.once('pointerup', () => this.scene.start('PostMatchScene', { result }));
    });
  }
}
