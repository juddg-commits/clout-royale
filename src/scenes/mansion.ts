/**
 * Shared Aura Mansion rendering — used by both HubScene (non-combat)
 * and GameScene (arena) so the two spaces are visibly the same place.
 * All placeholder textures are generated here; BootScene calls
 * makeMansionTextures() once, and the exists-guards make repeat calls free.
 */
import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { CLASS_REGISTRY, DEFAULT_CLASS_ID } from '../data/classes';

export function makeMansionTextures(scene: Phaser.Scene): void {
  const mk = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    if (scene.textures.exists(key)) return;
    const g = scene.add.graphics();
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  const classDef = CLASS_REGISTRY[DEFAULT_CLASS_ID];
  mk('player', 30, 30, (g) => {
    g.fillStyle(classDef.color, 1);
    g.fillRect(0, 0, 30, 30);
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(20, 11, 10, 8); // "nose" notch so rotation reads as aim
  });

  for (const def of Object.values(CONFIG.BOTS.ARCHETYPES)) {
    mk(`bot-${def.id}`, 26, 26, (g) => {
      g.fillStyle(def.color, 1);
      g.fillRect(0, 0, 26, 26);
      g.fillStyle(0x000000, 0.35);
      g.fillRect(17, 9, 9, 8);
    });
  }

  mk('projectile', 14, 5, (g) => {
    g.fillStyle(0xfff3b0, 1);
    g.fillRect(0, 0, 14, 5);
  });

  mk('pickup', 12, 12, (g) => {
    g.fillStyle(0xffd700, 1);
    g.fillRect(0, 0, 12, 12);
    g.fillStyle(0xffffff, 0.7);
    g.fillRect(3, 3, 3, 3);
  });

  mk('smoothie', 12, 16, (g) => {
    g.fillStyle(0x40e0d0, 1); // AirWon teal
    g.fillRect(1, 4, 10, 12); // cup
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(0, 2, 12, 3); // lid
    g.fillRect(5, 0, 2, 4); // straw
  });
}

/** Background, walls, and the labeled zones. */
export function drawMansion(scene: Phaser.Scene, subtitle: string): void {
  const { WIDTH, HEIGHT } = CONFIG.CANVAS;
  scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x141422).setDepth(0);
  scene.add
    .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH - 4, HEIGHT - 4)
    .setStrokeStyle(4, 0x3a3a55, 1)
    .setDepth(1);

  for (const zone of CONFIG.ARENA.ZONES) {
    scene.add
      .rectangle(zone.x + zone.width / 2, zone.y + zone.height / 2, zone.width, zone.height, zone.color, 0.22)
      .setStrokeStyle(2, zone.color, 0.8)
      .setDepth(1);
    scene.add
      .text(zone.x + zone.width / 2, zone.y + 14, zone.label, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(0.85)
      .setDepth(2);
  }

  scene.add
    .text(WIDTH / 2, HEIGHT - 22, `${CONFIG.ARENA.NAME} — ${subtitle}`, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#8888aa',
    })
    .setOrigin(0.5)
    .setDepth(2);
}
