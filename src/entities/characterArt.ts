/**
 * Shared character presentation: size a sprite from its actual frame (Kenney
 * art or the generated stand-in, whichever loaded), give it a circular body
 * centered on its origin, and draw a team-color ring under it.
 * Circles suit top-down characters: the hitbox doesn't change as they rotate.
 */
import Phaser from 'phaser';
import { CONFIG } from '../data/config';

export function fitCharacter(sprite: Phaser.Physics.Arcade.Image, sizePx: number, bodyRadiusPx: number): void {
  const scale = sizePx / Math.max(sprite.frame.width, sprite.frame.height);
  sprite.setScale(scale);
  const r = bodyRadiusPx / scale; // setCircle works in source (unscaled) pixels
  sprite.setCircle(r, sprite.displayOriginX - r, sprite.displayOriginY - r);
}

/** Ground ring: identifies who's who at a glance and doubles as a contact shadow. */
export function makeGroundRing(
  scene: Phaser.Scene,
  x: number,
  y: number,
  bodyRadiusPx: number,
  color: number,
): Phaser.GameObjects.Arc {
  return scene.add
    .circle(x, y, bodyRadiusPx + CONFIG.ART.GROUND_RING_PAD_PX, 0x000000, 0.3)
    .setStrokeStyle(2, color, 0.9)
    .setDepth(9);
}
