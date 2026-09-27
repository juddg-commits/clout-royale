/**
 * Shared Aura Mansion rendering — used by both HubScene (non-combat) and
 * GameScene (arena) so the two spaces are visibly the same place.
 * Art comes from data/art.ts (loaded in BootScene). makeMansionTextures()
 * generates procedural stand-ins, and its exists-guards skip every key that
 * already loaded, so the stand-ins only appear if a file is missing.
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

  // Rounded "creator" body with a visor on the facing side, so rotation reads as aim.
  const classDef = CLASS_REGISTRY[DEFAULT_CLASS_ID];
  mk('player', 34, 34, (g) => {
    g.fillStyle(classDef.color, 1);
    g.fillRoundedRect(2, 2, 30, 30, 9);
    g.fillStyle(0xffffff, 0.22);
    g.fillRoundedRect(5, 5, 24, 9, 5); // top highlight
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeRoundedRect(2, 2, 30, 30, 9);
    g.fillStyle(0x0b0b12, 0.9);
    g.fillRoundedRect(20, 11, 10, 12, 3); // visor
    g.fillStyle(0xffffff, 0.95);
    g.fillRoundedRect(22, 13, 6, 8, 2);
  });

  for (const def of Object.values(CONFIG.BOTS.ARCHETYPES)) {
    mk(`bot-${def.id}`, 30, 30, (g) => {
      g.fillStyle(def.color, 1);
      g.fillRoundedRect(2, 2, 26, 26, 8);
      g.fillStyle(0xffffff, 0.18);
      g.fillRoundedRect(5, 5, 20, 8, 4);
      g.lineStyle(2, 0x000000, 0.35);
      g.strokeRoundedRect(2, 2, 26, 26, 8);
      g.fillStyle(0x000000, 0.55);
      g.fillRoundedRect(18, 10, 8, 10, 3); // "eye" on the facing side
    });
  }

  mk('projectile', 16, 6, (g) => {
    g.fillStyle(0xffe066, 1);
    g.fillRoundedRect(0, 0, 16, 6, 3);
    g.fillStyle(0xffffff, 0.9);
    g.fillRoundedRect(3, 1.5, 9, 3, 1.5);
  });

  mk('pickup', 14, 14, (g) => {
    g.fillStyle(0xffd700, 1);
    g.fillCircle(7, 7, 7);
    g.lineStyle(2, 0xb8860b, 1);
    g.strokeCircle(7, 7, 5);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(5, 4.5, 2);
  });

  mk('smoothie', 12, 16, (g) => {
    g.fillStyle(0x40e0d0, 1); // AirWon teal
    g.fillRoundedRect(1, 4, 10, 12, 3); // cup
    g.fillStyle(0xffffff, 0.9);
    g.fillRoundedRect(0, 2, 12, 3, 1); // lid
    g.fillRect(5, 0, 2, 4); // straw
  });

  // Particle + glow sprites (tinted where they're used).
  mk('spark', 6, 6, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 3, 3);
  });
  mk('glow', 64, 64, (g) => {
    for (let r = 32; r > 0; r -= 4) {
      g.fillStyle(0xffffff, 0.06);
      g.fillCircle(32, 32, r);
    }
  });

  // Floor tile: dark slate with a faint grid, tiled across the arena.
  mk('floor', 64, 64, (g) => {
    g.fillStyle(0x151526, 1);
    g.fillRect(0, 0, 64, 64);
    g.lineStyle(1, 0x1f1f36, 1);
    g.strokeRect(0.5, 0.5, 63, 63);
    g.fillStyle(0x24243c, 1);
    g.fillRect(31, 31, 2, 2);
  });

  // Vignette: a real radial gradient via a canvas texture (Graphics can't).
  if (!scene.textures.exists('vignette')) {
    const { WIDTH, HEIGHT } = CONFIG.CANVAS;
    const canvas = scene.textures.createCanvas('vignette', WIDTH, HEIGHT);
    const ctx = canvas?.getContext();
    if (canvas && ctx) {
      const grad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.35, WIDTH / 2, HEIGHT / 2, WIDTH * 0.62);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      canvas.refresh();
    }
  }
}

/** Floor, room floors, props, room trims + labels, outer wall, and a vignette. */
export function drawMansion(scene: Phaser.Scene, subtitle: string): void {
  const { WIDTH, HEIGHT } = CONFIG.CANVAS;
  const tileScale = CONFIG.ART.TILE_SCALE;
  scene.add
    .tileSprite(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 'floor')
    .setTileScale(tileScale)
    .setTint(CONFIG.ART.FLOOR_TINT)
    .setDepth(0);

  // Room floors: tiled texture when loaded, flat tint otherwise.
  for (const zone of CONFIG.ARENA.ZONES) {
    const cx = zone.x + zone.width / 2;
    const cy = zone.y + zone.height / 2;
    if (zone.floor && scene.textures.exists(zone.floor)) {
      scene.add.tileSprite(cx, cy, zone.width, zone.height, zone.floor).setTileScale(tileScale).setDepth(1);
    } else {
      scene.add.rectangle(cx, cy, zone.width, zone.height, zone.color, 0.16).setDepth(1);
    }
  }

  // Props (cosmetic, no collision). Missing textures are skipped.
  for (const d of CONFIG.ARENA.DECOR) {
    if (!scene.textures.exists(d.key)) continue;
    if (d.width !== undefined && d.height !== undefined) {
      scene.add.tileSprite(d.x, d.y, d.width, d.height, d.key).setTileScale(tileScale).setDepth(1.5);
    } else {
      scene.add
        .image(d.x, d.y, d.key)
        .setScale(tileScale * (d.scale ?? 1))
        .setAngle(d.angle ?? 0)
        .setDepth(1.5);
    }
  }

  // Room trims in the zone color (keeps each room's identity) + label pills.
  const trims = scene.add.graphics().setDepth(2);
  for (const zone of CONFIG.ARENA.ZONES) {
    trims.lineStyle(6, 0x000000, 0.35);
    trims.strokeRect(zone.x, zone.y, zone.width, zone.height);
    trims.lineStyle(3, zone.color, 1);
    trims.strokeRect(zone.x, zone.y, zone.width, zone.height);

    const label = scene.add
      .text(zone.x + zone.width / 2, zone.y + 16, zone.label, {
        fontFamily: CONFIG.UI.FONT,
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(2.6);
    trims.fillStyle(0x000000, 0.6);
    trims.fillRoundedRect(label.x - label.width / 2 - 9, label.y - 10, label.width + 18, 20, 10);
    trims.fillStyle(zone.color, 1);
    trims.fillCircle(label.x - label.width / 2 - 2, label.y, 3); // color dot
  }

  // Outer wall (the physics bounds) + vignette, above floors, below entities.
  const wall = scene.add.graphics().setDepth(2.5);
  wall.lineStyle(12, 0x26262f, 1).strokeRect(4, 4, WIDTH - 8, HEIGHT - 8);
  wall.lineStyle(2, 0x5a5a6e, 1).strokeRect(10, 10, WIDTH - 20, HEIGHT - 20);
  scene.add.image(WIDTH / 2, HEIGHT / 2, 'vignette').setDepth(3);

  scene.add
    .text(WIDTH / 2, HEIGHT - 24, `${CONFIG.ARENA.NAME} — ${subtitle}`, {
      fontFamily: CONFIG.UI.FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#e8e8f0',
      stroke: '#000000',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(4);
}
