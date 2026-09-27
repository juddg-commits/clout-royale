/**
 * AutomationSystem — timestamp-driven passive-income accrual (M5).
 * No per-frame bookkeeping and no heartbeat timer: accrual is folded forward
 * at explicit moments, each adjacent to a transaction or lifecycle event:
 *
 *   - boot (page load):       offline formula — elapsed clamped to the cap,
 *                             earning at OFFLINE_RATE_MULTIPLIER
 *   - opening the studio:     fold in-memory (display accuracy; NOT saved —
 *                             storage untouched until a real transaction)
 *   - purchase:               fold BEFORE the rank changes, so a new unit
 *                             never earns retroactively
 *   - collect:                fold, then transfer pending -> balances
 *   - match end:              fold into the save being banked
 *   - pagehide:               fold + save so closing the tab doesn't lose
 *                             the online tail (wired in main.ts)
 *
 * Elapsed time between folds within an open session earns at 100%; a gap the
 * page was closed for earns at 50% capped at 8h (both from CONFIG.AUTOMATION).
 */
import { CONFIG } from '../data/config';
import { computeAutomationRates, type AutomationRates } from '../data/automation';
import type { SaveData } from './ProgressionSystem';

export interface AccrualResult {
  money: number;
  clout: number;
  minutes: number;
}

export class AutomationSystem {
  static rates(save: SaveData): AutomationRates {
    return computeAutomationRates(save.automation.units);
  }

  /**
   * Fold accrual from lastTickAt up to `now` into pending, at `rateMultiplier`
   * of the online rate. Mutates the save (does NOT persist it).
   * Every fold is capped at the offline cap by default: legit online folds are
   * minutes apart so the cap never binds, but a pathological gap (laptop
   * asleep for days with the tab open, then pagehide) can't fold days at 100%.
   */
  static fold(
    save: SaveData,
    now: number,
    rateMultiplier: number,
    capMinutes: number = CONFIG.AUTOMATION.OFFLINE_CAP_HOURS * 60,
  ): AccrualResult {
    const auto = save.automation;
    const rawMinutes = auto.lastTickAt > 0 ? Math.max(0, now - auto.lastTickAt) / 60000 : 0;
    const minutes = Math.min(rawMinutes, capMinutes);
    const rates = this.rates(save);
    const money = rates.moneyPerMin * minutes * rateMultiplier;
    const clout = rates.cloutPerMin * minutes * rateMultiplier;
    auto.pendingMoney += money;
    auto.pendingClout += clout;
    auto.lastTickAt = now;
    return { money, clout, minutes };
  }

  /** Page-load accrual: offline rules (capped hours, reduced rate). */
  static bootAccrue(save: SaveData, now: number): AccrualResult {
    return this.fold(save, now, CONFIG.AUTOMATION.OFFLINE_RATE_MULTIPLIER, CONFIG.AUTOMATION.OFFLINE_CAP_HOURS * 60);
  }

  /**
   * Transfer pending income into spendable balances. Whole units move;
   * fractional remainders stay pending so no value is ever lost.
   * Mutates the save (does NOT persist it). Returns what was credited.
   */
  static collect(save: SaveData): { money: number; clout: number } {
    const auto = save.automation;
    const money = Math.floor(auto.pendingMoney);
    const clout = Math.floor(auto.pendingClout);
    auto.pendingMoney -= money;
    auto.pendingClout -= clout;
    save.money += money;
    save.totalClout += clout;
    return { money, clout };
  }
}
