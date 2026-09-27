/**
 * Clout Royale — entry point. Fixed 1280x720 canvas, arcade physics.
 */
import Phaser from 'phaser';
import { CONFIG } from './data/config';
import { AutomationSystem } from './systems/AutomationSystem';
import { ProgressionSystem } from './systems/ProgressionSystem';
import { BootScene } from './scenes/BootScene';
import { HubScene } from './scenes/HubScene';
import { GameScene } from './scenes/GameScene';
import { PostMatchScene } from './scenes/PostMatchScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { AutomationScene } from './scenes/AutomationScene';

// ?forceloop=1 runs the game clock on setTimeout instead of requestAnimationFrame.
// Headless/backgrounded browsers park rAF (which freezes the game); automated tests
// append this param. Real players stay on rAF.
const forceLoop = new URLSearchParams(window.location.search).has('forceloop');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: CONFIG.CANVAS.WIDTH,
  height: CONFIG.CANVAS.HEIGHT,
  fps: forceLoop ? { forceSetTimeOut: true, target: 60 } : undefined,
  backgroundColor: '#0b0b12',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // top-down: no gravity
      debug: false,
    },
  },
  scene: [BootScene, HubScene, GameScene, PostMatchScene, UpgradeScene, AutomationScene],
});

// Fold the online automation trickle into storage when the page goes away, so
// closing the tab doesn't lose the session's accrual (boot would otherwise
// re-count the gap at the reduced offline rate). Game-level, registered once.
window.addEventListener('pagehide', () => {
  const save = ProgressionSystem.load();
  AutomationSystem.fold(save, Date.now(), 1);
  ProgressionSystem.save(save);
});

// Debug handle so automated tests can inspect scene state (dev builds only).
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
