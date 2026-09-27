/**
 * Player — the Gymfluencer (class-agnostic: everything reads from the
 * CreatorClassDef passed in, so future classes reuse this entity untouched).
 * WASD move, mouse aim, LMB basic attack, plus M2 ability state:
 * parry window, dash, rage buff, and live Aura/Cringe meter effects.
 */
import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import type { CreatorClassDef } from '../data/classes';
import { computeUpgradeMods, type UpgradeMods } from '../data/upgrades';
import type { SaveData } from '../systems/ProgressionSystem';
import type { CombatSystem } from './../systems/CombatSystem';

export interface PlayerStats {
  health: number;
  maxHealth: number;
  clout: number;
  aura: number;
  cringe: number;
  money: number;
}

type WASDKeys = Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

export class Player extends Phaser.Physics.Arcade.Image {
  readonly classDef: CreatorClassDef;
  readonly stats: PlayerStats;
  /** Aggregated owned-upgrade effects, computed once at match start. */
  readonly upgradeMods: UpgradeMods;
  dead = false;

  // --- ability state (driven by AbilitySystem, read by GameScene/Combat) ---
  private parryUntil = 0;
  private dashUntil = 0;
  private dashAngle = 0;
  /** Bots already hit by the current dash (each dash hits a bot once). */
  readonly dashHitSet = new Set<unknown>();
  private rageUntil = 0;
  private wasDashing = false;
  private wasRaging = false;
  /** One-frame flag GameScene consumes to fire the rage-end popup. */
  rageJustEnded = false;

  private keys: WASDKeys;
  private nextAttackAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, classDef: CreatorClassDef, save: SaveData) {
    super(scene, x, y, 'player');
    this.classDef = classDef;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.setPushable(false); // bots bump into the player but can't shove them across the arena
    this.setDepth(10);

    this.upgradeMods = computeUpgradeMods(save.upgrades);
    const maxHealth = classDef.baseStats.maxHealth + this.upgradeMods.maxHealthBonus;
    this.stats = {
      health: maxHealth,
      maxHealth,
      clout: classDef.startingMeters.clout,
      aura: classDef.startingMeters.aura,
      cringe: classDef.startingMeters.cringe,
      money: save.money, // money persists across matches
    };

    this.keys = scene.input.keyboard!.addKeys('W,A,S,D') as WASDKeys;
  }

  update(time: number, combat: CombatSystem): void {
    if (this.dead) return;

    // --- Dash overrides normal movement while active ---
    if (this.isDashing(time)) {
      const dashSpeed =
        CONFIG.ABILITIES.DRY_SCOOP_DASH.DISTANCE_PX / (CONFIG.ABILITIES.DRY_SCOOP_DASH.DURATION_MS / 1000);
      this.setVelocity(Math.cos(this.dashAngle) * dashSpeed, Math.sin(this.dashAngle) * dashSpeed);
      this.wasDashing = true;
    } else {
      if (this.wasDashing) {
        // Dash just ended — dry scooping in public is cringe.
        this.wasDashing = false;
        this.addCringe(CONFIG.ABILITIES.DRY_SCOOP_DASH.CRINGE_GAIN);
      }

      // --- WASD movement (normalized so diagonals aren't faster) ---
      const speed = this.effectiveMoveSpeed(time);
      const ix = (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0);
      const iy = (this.keys.S.isDown ? 1 : 0) - (this.keys.W.isDown ? 1 : 0);
      const len = Math.hypot(ix, iy);
      if (len > 0) {
        this.setVelocity((ix / len) * speed, (iy / len) * speed);
      } else {
        this.setVelocity(0, 0);
      }
    }

    // --- Rage visual + end-of-rage cringe spike ---
    if (this.isRaging(time)) {
      this.wasRaging = true;
      // Pulsing red tint while the hype flows.
      this.setTint(Math.sin(time / 90) > 0 ? 0xff5555 : 0xffaa88);
    } else if (this.wasRaging) {
      this.wasRaging = false;
      this.clearTint();
      this.addCringe(CONFIG.ABILITIES.FAKE_PLATES_RAGE.CRINGE_SPIKE_ON_END);
      this.rageJustEnded = true; // GameScene fires "FAKE PLATES EXPOSED"
    }

    // --- Mouse aim ---
    const pointer = this.scene.input.activePointer;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY);
    this.setRotation(angle);

    // --- Left-click basic attack (hold to auto-fire at cooldown rate) ---
    if (pointer.isDown && time >= this.nextAttackAt) {
      this.nextAttackAt = time + this.classDef.baseStats.attackCooldownMs;
      combat.firePlayerProjectile(this.x, this.y, angle);
    }
  }

  // ---------------------------------------------------------------------
  // Meters (clamped; GameScene watches threshold crossings for popups)
  // ---------------------------------------------------------------------

  addAura(delta: number): void {
    this.stats.aura = Phaser.Math.Clamp(this.stats.aura + delta, 0, CONFIG.METERS.AURA_MAX);
  }

  addCringe(delta: number): void {
    this.stats.cringe = Phaser.Math.Clamp(this.stats.cringe + delta, 0, CONFIG.METERS.CRINGE_MAX);
  }

  isCringeSlowed(): boolean {
    return this.stats.cringe >= CONFIG.METERS.CRINGE_SLOW_THRESHOLD;
  }

  /**
   * Move speed: base × upgrade mult × rage mult × cringe-slow mult.
   * Flat/base-adjacent modifiers first, situational multipliers after.
   */
  effectiveMoveSpeed(time: number): number {
    let speed = this.classDef.baseStats.moveSpeed * this.upgradeMods.moveSpeedMult;
    if (this.isRaging(time)) speed *= CONFIG.ABILITIES.FAKE_PLATES_RAGE.MOVE_SPEED_MULTIPLIER;
    if (this.isCringeSlowed()) speed *= CONFIG.METERS.CRINGE_SLOW_MULTIPLIER;
    return speed;
  }

  /** Basic-attack damage: (base + upgrade flat) × rage mult. */
  effectiveAttackDamage(): number {
    const raging = this.isRaging(this.scene.time.now);
    const mult = raging ? CONFIG.ABILITIES.FAKE_PLATES_RAGE.DAMAGE_MULTIPLIER : 1;
    return Math.round((this.classDef.baseStats.attackDamage + this.upgradeMods.attackDamageBonus) * mult);
  }

  // ---------------------------------------------------------------------
  // Ability state (started by AbilitySystem)
  // ---------------------------------------------------------------------

  startParry(time: number): void {
    this.parryUntil = time + CONFIG.ABILITIES.MEWING_PARRY.WINDOW_MS;
  }

  isParrying(time: number): boolean {
    return time < this.parryUntil;
  }

  startDash(time: number): void {
    this.dashUntil = time + CONFIG.ABILITIES.DRY_SCOOP_DASH.DURATION_MS;
    this.dashAngle = this.rotation; // dash toward the mouse aim
    this.dashHitSet.clear();
  }

  isDashing(time: number): boolean {
    return time < this.dashUntil;
  }

  get currentDashAngle(): number {
    return this.dashAngle;
  }

  startRage(time: number): void {
    this.rageUntil = time + CONFIG.ABILITIES.FAKE_PLATES_RAGE.DURATION_MS;
  }

  isRaging(time: number): boolean {
    return time < this.rageUntil;
  }

  // ---------------------------------------------------------------------

  /** Apply damage. Returns true if this hit was lethal. */
  takeDamage(amount: number): boolean {
    if (this.dead) return false;
    this.stats.health = Math.max(0, this.stats.health - amount);

    this.setTintFill(0xff4444);
    this.scene.time.delayedCall(CONFIG.UI.HIT_FLASH_MS, () => {
      if (this.active && !this.isRaging(this.scene.time.now)) this.clearTint();
    });

    if (this.stats.health <= 0) {
      this.dead = true;
      this.setVelocity(0, 0);
      return true;
    }
    return false;
  }
}
