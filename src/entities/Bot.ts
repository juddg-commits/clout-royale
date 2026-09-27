/**
 * Bot — simple AI parody archetype. M2 behavior: at most CONFIG.BOTS.AGGRO
 * bots push into melee at once (role 'attack'); the rest hover at standoff
 * range and orbit (role 'standoff'). Bots take knockback, flash on hit,
 * and occasionally shout a cringe voice line.
 */
import Phaser from 'phaser';
import { CONFIG, type BotArchetypeConfig } from '../data/config';
import type { Player } from './Player';

export type BotRole = 'attack' | 'standoff';

export class Bot extends Phaser.Physics.Arcade.Image {
  readonly def: BotArchetypeConfig;
  health: number;
  /** GameScene schedules the next voice line here. */
  nextVoiceAt = 0;

  private nextAttackAt = 0;
  private knockbackUntil = 0;
  private orbitDir: 1 | -1;
  private nameLabel: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Ellipse;
  private speech?: Phaser.GameObjects.Text;
  private speechUntil = 0;
  private onAttack: (bot: Bot) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    def: BotArchetypeConfig,
    onAttack: (bot: Bot) => void,
  ) {
    super(scene, x, y, `bot-${def.id}`);
    this.def = def;
    this.health = def.maxHealth;
    this.onAttack = onAttack;
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.setDepth(10);

    this.shadow = scene.add.ellipse(x, y + 12, 26, 9, 0x000000, 0.35).setDepth(9);
    this.nameLabel = scene.add
      .text(x, y, def.label, { fontFamily: CONFIG.UI.FONT, fontSize: '11px', fontStyle: 'bold', color: '#e8e8f0', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(11);
    this.hpBar = scene.add.graphics().setDepth(11);
    this.syncAttachments();
  }

  /** Chase/hover per role; swing when in range and off cooldown. */
  updateAI(time: number, player: Player, role: BotRole): void {
    if (!this.active) return;

    // Let knockback impulses play out before the AI steers again.
    if (time < this.knockbackUntil) {
      this.syncAttachments();
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const angleToPlayer = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

    if (player.dead) {
      this.setVelocity(0, 0);
    } else if (role === 'attack') {
      if (dist > this.def.attackRangePx) {
        this.scene.physics.velocityFromRotation(angleToPlayer, this.def.moveSpeed, body.velocity);
        this.setRotation(angleToPlayer);
      } else {
        this.setVelocity(0, 0);
        if (time >= this.nextAttackAt) {
          this.nextAttackAt = time + this.def.attackCooldownMs;
          // Little lunge so the swing reads visually.
          this.scene.tweens.add({ targets: this, scaleX: 1.3, scaleY: 1.3, yoyo: true, duration: 90 });
          this.onAttack(this);
        }
      }
    } else {
      // Standoff: hover at range and strafe, waiting for an aggro slot.
      const aggro = CONFIG.BOTS.AGGRO;
      this.setRotation(angleToPlayer);
      if (dist > aggro.STANDOFF_DISTANCE_PX + aggro.STANDOFF_HYSTERESIS_PX) {
        this.scene.physics.velocityFromRotation(angleToPlayer, this.def.moveSpeed, body.velocity);
      } else if (dist < aggro.STANDOFF_DISTANCE_PX - aggro.STANDOFF_HYSTERESIS_PX) {
        this.scene.physics.velocityFromRotation(angleToPlayer + Math.PI, this.def.moveSpeed * 0.8, body.velocity);
      } else {
        this.scene.physics.velocityFromRotation(
          angleToPlayer + (this.orbitDir * Math.PI) / 2,
          aggro.ORBIT_SPEED,
          body.velocity,
        );
      }
    }

    this.syncAttachments();
  }

  /**
   * Apply damage (with optional knockback impulse).
   * Returns true if this hit was lethal (bot is destroyed).
   */
  takeDamage(amount: number, knockbackAngle?: number, knockbackVelocity?: number): boolean {
    if (!this.active) return false;
    this.health -= amount;

    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(CONFIG.UI.HIT_FLASH_MS, () => {
      if (this.active) this.clearTint();
    });

    if (knockbackAngle !== undefined && knockbackVelocity !== undefined) {
      this.knockbackUntil = this.scene.time.now + CONFIG.COMBAT.KNOCKBACK.DURATION_MS;
      this.setVelocity(Math.cos(knockbackAngle) * knockbackVelocity, Math.sin(knockbackAngle) * knockbackVelocity);
    }

    if (this.health <= 0) {
      this.destroy(); // label + hp bar + speech cleaned up in destroy() below
      return true;
    }
    this.syncAttachments();
    return false;
  }

  /** Shout a cringe line in a little speech bubble. */
  say(line: string): void {
    this.speechUntil = this.scene.time.now + CONFIG.BOTS.VOICE.BUBBLE_DURATION_MS;
    if (!this.speech) {
      this.speech = this.scene.add
        .text(this.x, this.y, line, {
          fontFamily: CONFIG.UI.FONT,
          fontSize: '11px',
          color: '#111122',
          backgroundColor: '#f5f5fa',
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5, 1)
        .setDepth(12);
    } else {
      this.speech.setText(line).setVisible(true);
    }
    this.syncAttachments();
  }

  private syncAttachments(): void {
    const bar = CONFIG.UI.BOT_HP_BAR;
    this.shadow.setPosition(this.x, this.y + 12);
    this.nameLabel.setPosition(this.x, this.y + bar.OFFSET_Y - 10);
    this.hpBar.clear();
    const pct = Phaser.Math.Clamp(this.health / this.def.maxHealth, 0, 1);
    const bx = this.x - bar.WIDTH / 2;
    const by = this.y + bar.OFFSET_Y;
    this.hpBar.fillStyle(0x000000, 0.6).fillRect(bx, by, bar.WIDTH, bar.HEIGHT);
    this.hpBar.fillStyle(pct > 0.4 ? 0x2ecc71 : 0xe74c3c, 1).fillRect(bx + 1, by + 1, (bar.WIDTH - 2) * pct, bar.HEIGHT - 2);

    if (this.speech) {
      if (this.scene.time.now > this.speechUntil) {
        this.speech.setVisible(false);
      } else {
        this.speech.setPosition(this.x, this.y + bar.OFFSET_Y - 18);
      }
    }
  }

  destroy(fromScene?: boolean): void {
    this.shadow.destroy();
    this.nameLabel.destroy();
    this.hpBar.destroy();
    this.speech?.destroy();
    super.destroy(fromScene);
  }
}
