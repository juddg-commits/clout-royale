/**
 * TrendSystem — AirWon Smoothie Trend Heat (LIVE as of M7, filling the M1 stub).
 * Owns the heat value, its decay, and the stage/payout lookups. Match-scoped:
 * GameScene creates one per mission and wires smoothie spawning/collection.
 */
import Phaser from 'phaser';
import { CONFIG, type TrendStage } from '../data/config';

export class TrendSystem {
  heat = 0;
  /** Highest heat reached this match (drives the peak stage on the result). */
  peakHeat = 0;

  addHeat(amount: number): void {
    this.heat = Phaser.Math.Clamp(this.heat + amount, 0, CONFIG.TREND.HEAT_MAX);
    this.peakHeat = Math.max(this.peakHeat, this.heat);
  }

  get stage(): TrendStage {
    return TrendSystem.stageFor(this.heat);
  }

  static stageFor(heat: number): TrendStage {
    const t = CONFIG.TREND.STAGE_THRESHOLDS;
    if (heat >= t.WASHED) return 'Washed';
    if (heat >= t.MAINSTREAM) return 'Mainstream';
    if (heat >= t.VIRAL) return 'Viral';
    return 'Underground';
  }

  /** Call once per frame with delta ms; heat decays toward 0. */
  update(deltaMs: number): void {
    if (this.heat > 0) {
      this.heat = Math.max(0, this.heat - CONFIG.TREND.HEAT_DECAY_PER_SECOND * (deltaMs / 1000));
    }
  }

  /** What grabbing a smoothie pays RIGHT NOW (before its heat is added). */
  payout(): { money: number; clout: number; cringe: number } {
    const p = CONFIG.TREND.PAYOUTS[this.stage];
    return { money: p.MONEY, clout: p.CLOUT, cringe: p.CRINGE };
  }
}
