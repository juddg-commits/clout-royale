/**
 * Thin wrapper over Phaser's built-in WebGL glow effect (preFX).
 * Every call is a no-op on the Canvas renderer, so the game still runs
 * without WebGL, just without the extra shine.
 */
import Phaser from 'phaser';
import { CONFIG } from '../data/config';

function webgl(scene: Phaser.Scene): boolean {
  return scene.sys.game.renderer.type === Phaser.WEBGL;
}

/** Soft outer glow around an image. Returns the effect so it can be removed later. */
export function addGlow(
  obj: Phaser.GameObjects.Image,
  color: number,
  strength: number = CONFIG.ART.GLOW.STRENGTH,
): Phaser.FX.Glow | undefined {
  if (!webgl(obj.scene) || !obj.preFX) return undefined;
  obj.preFX.setPadding(CONFIG.ART.GLOW.PADDING);
  return obj.preFX.addGlow(color, strength, 0, false, 0.1, 12);
}

export function removeGlow(obj: Phaser.GameObjects.Image, fx: Phaser.FX.Glow | undefined): void {
  if (fx && obj.preFX) obj.preFX.remove(fx);
}
