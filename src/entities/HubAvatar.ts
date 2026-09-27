/**
 * HubAvatar — the player's non-combat body in the hub. Deliberately NOT the
 * combat Player entity: no stats, no meters, no ability state, no damage.
 * The only shared surface is ~10 lines of movement math; duplicating that
 * beats threading `combat?` conditionals through the combat update loop.
 */
import Phaser from 'phaser';
import { CLASS_REGISTRY, DEFAULT_CLASS_ID } from '../data/classes';

type WASDKeys = Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

export class HubAvatar extends Phaser.Physics.Arcade.Image {
  private keys: WASDKeys;
  private moveSpeed: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.setDepth(10);
    this.moveSpeed = CLASS_REGISTRY[DEFAULT_CLASS_ID].baseStats.moveSpeed;
    this.keys = scene.input.keyboard!.addKeys('W,A,S,D') as WASDKeys;
  }

  update(): void {
    // WASD movement (normalized so diagonals aren't faster)
    const ix = (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0);
    const iy = (this.keys.S.isDown ? 1 : 0) - (this.keys.W.isDown ? 1 : 0);
    const len = Math.hypot(ix, iy);
    if (len > 0) {
      this.setVelocity((ix / len) * this.moveSpeed, (iy / len) * this.moveSpeed);
    } else {
      this.setVelocity(0, 0);
    }

    // Face the mouse so walking around still feels like the same guy
    const pointer = this.scene.input.activePointer;
    this.setRotation(Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY));
  }
}
