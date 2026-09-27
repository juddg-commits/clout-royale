/**
 * EffectsSystem — floating text, damage numbers, and big dumb meme popups.
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
      .text(x, y, message, { fontFamily: 'monospace', fontSize: `${fontSize}px`, color, fontStyle: 'bold' })
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

  /** Big, fast, dumb-funny center-screen popup. Rate-limited per text. */
  memePopup(text: string, color = '#ffd700'): void {
    const now = this.scene.time.now;
    if ((this.lastPopupAt[text] ?? -Infinity) + CONFIG.UI.POPUP.MIN_REPEAT_MS > now) return;
    this.lastPopupAt[text] = now;

    this.currentPopup?.destroy();
    const popup = this.scene.add
      .text(CONFIG.CANVAS.WIDTH / 2, CONFIG.UI.POPUP.Y, text, {
        fontFamily: 'monospace',
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
