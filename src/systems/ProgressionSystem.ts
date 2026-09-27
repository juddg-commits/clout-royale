/**
 * ProgressionSystem — level/XP/money/upgrades persisted in localStorage so
 * progression carries across matches (and page reloads).
 *
 * Level cap is CONFIG.XP.LEVEL_CAP (67). The prestige tier above the cap is
 * a hook only for now: `canPrestige()` exists, nothing consumes it yet.
 */
import { CONFIG } from '../data/config';

/** AI Automation state (M5) — accrual is timestamp-driven, see AutomationSystem. */
export interface AutomationSave {
  /** unitId -> rank owned. */
  units: Record<string, number>;
  /** Accrued-but-uncollected income (floats; collection floors them). */
  pendingMoney: number;
  pendingClout: number;
  /** Last time accrual was folded forward (epoch ms). 0 = never. */
  lastTickAt: number;
}

export interface SaveData {
  version: number;
  level: number;
  /** XP progress into the CURRENT level (resets on level-up). */
  xp: number;
  money: number;
  /** Lifetime clout banked across all matches (per-match clout resets). */
  totalClout: number;
  /** missionId -> victory count. Doubles as the future mission-unlock hook. */
  missionsCompleted: Record<string, number>;
  /** Prestige tier — always 0 until the prestige milestone ships. */
  prestige: number;
  /** upgradeId -> rank owned (Gains Shop). */
  upgrades: Record<string, number>;
  /** AI automation units + pending income (Content Studio). */
  automation: AutomationSave;
}

const STORAGE_KEY = 'clout-royale.save.v1';
const SAVE_VERSION = 1;

export class ProgressionSystem {
  static defaultSave(): SaveData {
    return {
      version: SAVE_VERSION,
      level: 1,
      xp: 0,
      money: 0,
      totalClout: 0,
      missionsCompleted: {},
      prestige: 0,
      upgrades: {},
      automation: { units: {}, pendingMoney: 0, pendingClout: 0, lastTickAt: 0 },
    };
  }

  static load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.defaultSave();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (parsed.version !== SAVE_VERSION) return this.defaultSave();
      // Merge over defaults so missing fields never crash the game.
      return { ...this.defaultSave(), ...parsed };
    } catch {
      return this.defaultSave();
    }
  }

  static save(data: SaveData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage unavailable (private mode, etc.) — play on without persistence.
    }
  }

  /** XP required to advance FROM `level` to `level + 1`. */
  static xpToNext(level: number): number {
    return Math.round(CONFIG.XP.BASE_TO_LEVEL * Math.pow(CONFIG.XP.GROWTH, level - 1));
  }

  /** Adds XP, applying level-ups up to the cap. Mutates `data`. */
  static addXp(data: SaveData, amount: number): { levelsGained: number } {
    let levelsGained = 0;
    data.xp += Math.max(0, Math.round(amount));
    while (data.level < CONFIG.XP.LEVEL_CAP && data.xp >= this.xpToNext(data.level)) {
      data.xp -= this.xpToNext(data.level);
      data.level += 1;
      levelsGained += 1;
    }
    if (data.level >= CONFIG.XP.LEVEL_CAP) {
      data.level = CONFIG.XP.LEVEL_CAP;
      data.xp = 0; // overflow XP is discarded until prestige ships
    }
    return { levelsGained };
  }

  /** Prestige hook — true at the level cap. Nothing consumes this yet. */
  static canPrestige(data: SaveData): boolean {
    return data.level >= CONFIG.PRESTIGE.UNLOCK_LEVEL;
  }
}
