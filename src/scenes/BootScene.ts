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

    this.scene.start('HubScene', {
      offlineHaul: { money: Math.floor(haul.money), clout: Math.floor(haul.clout) },
    });
  }
}
