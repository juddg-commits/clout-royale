/**
 * Upgrade registry — LIVE as of M4. Consumed by UpgradeScene (purchases) and
 * by Player/AbilitySystem via computeUpgradeMods() (the single source for
 * upgrade math applied to a run). New upgrades = a new CONFIG.UPGRADES block
 * + a new entry here; the shop UI and the mods helper are generic.
 * All numbers live in CONFIG.UPGRADES (single source of truth).
 */
import { CONFIG } from './config';

export type UpgradeCurrency = 'money' | 'clout';

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  currency: UpgradeCurrency;
  /** costs[i] = price of rank i+1; costs.length = max rank. */
  costs: number[];
  /** Per-rank effects — flat values add to base stats, pct values multiply. */
  modifiers: {
    maxHealthFlat?: number;
    attackDamageFlat?: number;
    moveSpeedPct?: number; // 0.04 = +4% per rank
    abilityCooldownPct?: number; // 0.08 = -8% per rank
  };
}

export const UPGRADE_REGISTRY: Record<string, UpgradeDef> = {
  proteinBudget: {
    id: 'proteinBudget',
    name: 'Protein Budget',
    description: 'More chicken and rice. The rice is optional. +Max HP.',
    currency: 'money',
    costs: CONFIG.UPGRADES.PROTEIN_BUDGET.COSTS,
    modifiers: { maxHealthFlat: CONFIG.UPGRADES.PROTEIN_BUDGET.HEALTH_PER_RANK },
  },
  gripStrength: {
    id: 'gripStrength',
    name: 'Grip Strength',
    description: 'Deadlift numbers are content. +Attack Damage.',
    currency: 'money',
    costs: CONFIG.UPGRADES.GRIP_STRENGTH.COSTS,
    modifiers: { attackDamageFlat: CONFIG.UPGRADES.GRIP_STRENGTH.DAMAGE_PER_RANK },
  },
  preworkoutStack: {
    id: 'preworkoutStack',
    name: 'Pre-Workout Stack',
    description: 'Three scoops. The label said one. -Ability cooldowns.',
    currency: 'money',
    costs: CONFIG.UPGRADES.PREWORKOUT_STACK.COSTS,
    modifiers: { abilityCooldownPct: CONFIG.UPGRADES.PREWORKOUT_STACK.COOLDOWN_REDUCTION_PER_RANK },
  },
  cardioCope: {
    id: 'cardioCope',
    name: 'Cardio Cope',
    description: 'Fine, ONE treadmill session. Paid in clout. +Move Speed.',
    currency: 'clout',
    costs: CONFIG.UPGRADES.CARDIO_COPE.COSTS,
    modifiers: { moveSpeedPct: CONFIG.UPGRADES.CARDIO_COPE.MOVE_SPEED_PCT_PER_RANK },
  },
};

/**
 * Aggregate upgrade effects for a save's owned ranks. THE single source for
 * how upgrades hit a run — Player and AbilitySystem both read this.
 * Stacking order (proven in the M4 test battery):
 *   damage  = (base + attackDamageBonus) * rageMult
 *   speed   =  base * moveSpeedMult * rageMult * cringeSlowMult
 *   cooldown = registryCooldown * abilityCooldownMult
 */
export interface UpgradeMods {
  maxHealthBonus: number; // flat, added to base max HP
  attackDamageBonus: number; // flat, added to base damage BEFORE rage multiplier
  moveSpeedMult: number; // >= 1
  abilityCooldownMult: number; // <= 1
}

export function computeUpgradeMods(owned: Record<string, number>): UpgradeMods {
  const mods: UpgradeMods = { maxHealthBonus: 0, attackDamageBonus: 0, moveSpeedMult: 1, abilityCooldownMult: 1 };
  for (const def of Object.values(UPGRADE_REGISTRY)) {
    const rank = Math.min(owned[def.id] ?? 0, def.costs.length);
    if (rank <= 0) continue;
    mods.maxHealthBonus += (def.modifiers.maxHealthFlat ?? 0) * rank;
    mods.attackDamageBonus += (def.modifiers.attackDamageFlat ?? 0) * rank;
    mods.moveSpeedMult += (def.modifiers.moveSpeedPct ?? 0) * rank;
    mods.abilityCooldownMult -= (def.modifiers.abilityCooldownPct ?? 0) * rank;
  }
  mods.abilityCooldownMult = Math.max(0.1, mods.abilityCooldownMult); // safety floor
  return mods;
}
