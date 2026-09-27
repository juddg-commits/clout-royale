/**
 * CombatSystem — owns projectiles and all damage exchange between the player
 * and bots. Every bot hit goes through hitBot() so damage numbers, hit-flash,
 * knockback, and elimination flow stay consistent across basic attacks,
 * abilities, and parry reflects. Scene wiring happens through explicit
 * callbacks (no scene-event subscriptions, so restarts can't leak handlers).
 */
import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import type { Player } from '../entities/Player';
import { Bot } from '../entities/Bot';
import type { EffectsSystem } from './EffectsSystem';
import { addGlow } from './fx';

export interface CombatCallbacks {
  /** Fired after a bot's HP reaches 0 (bot is already destroyed). */
  onBotEliminated: (bot: Bot) => void;
  /** Fired once when the player's HP reaches 0. */
  onPlayerDied: () => void;
  /** Fired when the player successfully parries a melee hit. */
  onParry: (bot: Bot) => void;
}

export class CombatSystem {
  private scene: Phaser.Scene;
  private player: Player;
  private projectiles: Phaser.Physics.Arcade.Group;
  private effects: EffectsSystem;
  private callbacks: CombatCallbacks;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    botGroup: Phaser.Physics.Arcade.Group,
    effects: EffectsSystem,
    callbacks: CombatCallbacks,
  ) {
    this.scene = scene;
    this.player = player;
    this.effects = effects;
    this.callbacks = callbacks;
    this.projectiles = scene.physics.add.group();
    scene.physics.add.overlap(this.projectiles, botGroup, this.handleProjectileHit);
  }

  /** Player basic attack: a projectile that dies after its max travel range. */
  firePlayerProjectile(x: number, y: number, angleRad: number): void {
    const stats = this.player.classDef.baseStats;
    const proj = this.projectiles.create(x, y, 'projectile') as Phaser.Physics.Arcade.Image;
    proj.setRotation(angleRad);
    proj.setDepth(5);
    addGlow(proj, 0xffe066, 2);
    this.scene.physics.velocityFromRotation(
      angleRad,
      stats.projectileSpeed,
      (proj.body as Phaser.Physics.Arcade.Body).velocity,
    );
    const lifetimeMs = (stats.attackRangePx / stats.projectileSpeed) * 1000;
    this.scene.time.delayedCall(lifetimeMs, () => {
      if (proj.active) proj.destroy();
    });
  }

  /**
   * Single entry point for damaging a bot: damage number, hit-flash,
   * knockback, and the elimination callback. Returns true if lethal.
   */
  hitBot(bot: Bot, damage: number, knockbackAngle?: number, knockbackVelocity?: number): boolean {
    if (!bot.active) return false;
    this.effects.damageNumber(bot.x, bot.y - 22, damage);
    this.effects.burst(bot.x, bot.y, 0xffffff, 5, 160);
    const died = bot.takeDamage(damage, knockbackAngle, knockbackVelocity);
    if (died) this.callbacks.onBotEliminated(bot);
    return died;
  }

  private handleProjectileHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (projObj, botObj) => {
    const proj = projObj as Phaser.Physics.Arcade.Image;
    const bot = botObj as Bot;
    if (!proj.active || !bot.active) return;
    const angle = proj.rotation;
    proj.destroy();
    this.hitBot(bot, this.player.effectiveAttackDamage(), angle, CONFIG.COMBAT.PROJECTILE_KNOCKBACK_VELOCITY);
  };

  /** Bot melee swing connecting with the player (bots call this via their onAttack hook). */
  botAttacksPlayer(bot: Bot): void {
    if (this.player.dead || !bot.active) return;
    const now = this.scene.time.now;

    // --- Mewing Parry: block, reflect, gain Aura ---
    if (this.player.isParrying(now)) {
      const parry = CONFIG.ABILITIES.MEWING_PARRY;
      const reflected = Math.round(bot.def.attackDamage * parry.REFLECT_MULTIPLIER);
      this.player.addAura(parry.AURA_GAIN);
      this.callbacks.onParry(bot);
      const away = Phaser.Math.Angle.Between(this.player.x, this.player.y, bot.x, bot.y);
      this.hitBot(bot, reflected, away, CONFIG.COMBAT.KNOCKBACK.VELOCITY * 1.4);
      return;
    }

    const died = this.player.takeDamage(bot.def.attackDamage);
    this.effects.damageNumber(this.player.x, this.player.y - 24, bot.def.attackDamage, '#ff8080');
    this.effects.burst(this.player.x, this.player.y, 0xff5555, 6, 140);
    this.scene.cameras.main.shake(CONFIG.UI.HIT_SHAKE_DURATION_MS, CONFIG.UI.HIT_SHAKE_INTENSITY);
    if (died) this.callbacks.onPlayerDied();
  }
}
