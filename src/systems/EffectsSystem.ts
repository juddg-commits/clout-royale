/**
 * EffectsSystem — floating text, damage numbers, particle bursts, and meme popups.
 * Owned by GameScene; passed to Combat/Ability systems so every hit and
 * trigger can produce feedback without those systems touching the display list.
 */
import Phaser from 'phaser';
import { CONFIG } from '../data/config';

export class EffectsSystem {
  private scene: Phaser.Scene;
  /** Per-text rate limit so popups don't spam. */
  private lastPopupAt: Record<string, number> = {};
  private currentPopup?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  floatText(x: number, y: number, message: string, color: string, fontSize = 14): void {
    const t = this.scene.add
      .text(x, y, message, { fontFamily: CONFIG.UI.FONT, fontSize: `${fontSize}px`, color, fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(20);
    this.scene.tweens.add({
      targets: t,
      y: y - CONFIG.UI.FLOAT_TEXT_RISE_PX,
      alpha: 0,
      duration: CONFIG.UI.FLOAT_TEXT_DURATION_MS,
      onComplete: () => t.destroy(),
    });
  }

  /** Floating damage number with a little horizontal jitter. */
  damageNumber(x: number, y: number, amount: number, color = '#ffe066'): void {
    this.floatText(x + Phaser.Math.Between(-8, 8), y, `${Math.round(amount)}`, color, 15);
  }

  /** One-shot particle burst (hits, eliminations, pickups). The emitter self-destructs. */
  burst(x: number, y: number, color: number, count: number, speed = 200): void {
    const emitter = this.scene.add
      .particles(x, y, 'spark', {
        speed: { min: speed * 0.3, max: speed },
        angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 180, max: 420 },
        tint: color,
        emitting: false,
      })
      .setDepth(15);
    emitter.explode(count);
    this.scene.time.delayedCall(600, () => emitter.destroy());
  }

  /** Big, fast center-screen popup. Rate-limited per text. */
  memePopup(text: string, color = '#ffd700'): void {
    const now = this.scene.time.now;
    if ((this.lastPopupAt[text] ?? -Infinity) + CONFIG.UI.POPUP.MIN_REPEAT_MS > now) return;
    this.lastPopupAt[text] = now;

    this.currentPopup?.destroy();
    const popup = this.scene.add
      .text(CONFIG.CANVAS.WIDTH / 2, CONFIG.UI.POPUP.Y, text, {
        fontFamily: CONFIG.UI.FONT,
        fontSize: '42px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(90)
      .setScale(0.4)
      .setAngle(Phaser.Math.Between(-4, 4));
    this.currentPopup = popup;

    this.scene.tweens.add({ targets: popup, scale: 1, duration: 140, ease: 'Back.Out' });
    this.scene.tweens.add({
      targets: popup,
      alpha: 0,
      y: CONFIG.UI.POPUP.Y - 30,
      delay: CONFIG.UI.POPUP.HOLD_MS,
      duration: 300,
      onComplete: () => {
        if (this.currentPopup === popup) this.currentPopup = undefined;
        popup.destroy();
      },
    });
  }
}
