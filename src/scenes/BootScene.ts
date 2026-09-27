/**
 * BootScene — single entry point. Generates the placeholder textures once,
 * applies offline automation accrual (M5), then hands off to the hub with
 * the "while you were gone" haul so it can show the return banner.
 */
import Phaser from 'phaser';
import { AutomationSystem } from '../systems/AutomationSystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { makeMansionTextures } from './mansion';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    makeMansionTextures(this);

    // Offline accrual: capped hours at reduced rate (CONFIG.AUTOMATION).
    const save = ProgressionSystem.load();
    const haul = AutomationSystem.bootAccrue(save, Date.now());
    ProgressionSystem.save(save);

    const go = () => {
      this.scene.start('HubScene', {
        offlineHaul: { money: Math.floor(haul.money), clout: Math.floor(haul.clout) },
      });
    };

    // Wait (briefly) for the web font so the first text objects don't cache
    // the fallback face. Offline or blocked: the timeout wins and we go anyway.
    const fonts = document.fonts;
    if (!fonts) {
      go();
      return;
    }
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500));
    Promise.race([Promise.all([fonts.load('500 16px "Space Grotesk"'), fonts.load('700 16px "Space Grotesk"')]), timeout])
      .catch(() => undefined)
      .then(go);
  }
}
