/**
 * Ability registry — LIVE as of M2. Consumed by systems/AbilitySystem.ts,
 * which maps each entry's id to an executor. New abilities = a new entry
 * here + one executor function; the HUD/cooldown plumbing is generic.
 * All numbers live in CONFIG.ABILITIES (single source of truth).
 */
import { CONFIG } from './config';

export type AbilitySlot = 'Q' | 'E' | 'SHIFT' | 'R';

export interface AbilityDef {
  id: string;
  name: string;
  /** Short label shown on the HUD icon. */
  shortName: string;
  slot: AbilitySlot;
  description: string;
  cooldownMs: number;
  /** Free-form tuning payload; every value references CONFIG.ABILITIES. */
  numbers: Record<string, number>;
}

export const ABILITY_REGISTRY: Record<string, AbilityDef> = {
  mogBeam: {
    id: 'mogBeam',
    name: 'Mog Beam',
    shortName: 'MOG',
    slot: 'Q',
    description: 'Cone stare: light damage, steals Aura from everyone caught in it. Higher Aura = stronger and wider.',
    cooldownMs: CONFIG.ABILITIES.MOG_BEAM.COOLDOWN_MS,
    numbers: {
      damage: CONFIG.ABILITIES.MOG_BEAM.DAMAGE,
      rangePx: CONFIG.ABILITIES.MOG_BEAM.RANGE_PX,
      coneHalfAngleDeg: CONFIG.ABILITIES.MOG_BEAM.CONE_HALF_ANGLE_DEG,
      auraCost: CONFIG.ABILITIES.MOG_BEAM.AURA_COST,
      auraStealPerHit: CONFIG.ABILITIES.MOG_BEAM.AURA_STEAL_PER_HIT,
    },
  },
  mewingParry: {
    id: 'mewingParry',
    name: 'Mewing Parry',
    shortName: 'MEW',
    slot: 'E',
    description: 'Lock in. Briefly block; a blocked hit reflects damage back at the hater and grants Aura.',
    cooldownMs: CONFIG.ABILITIES.MEWING_PARRY.COOLDOWN_MS,
    numbers: {
      windowMs: CONFIG.ABILITIES.MEWING_PARRY.WINDOW_MS,
      reflectMultiplier: CONFIG.ABILITIES.MEWING_PARRY.REFLECT_MULTIPLIER,
      auraGain: CONFIG.ABILITIES.MEWING_PARRY.AURA_GAIN,
    },
  },
  dryScoopDash: {
    id: 'dryScoopDash',
    name: 'Dry Scoop Dash',
    shortName: 'SCOOP',
    slot: 'SHIFT',
    description: 'Down a dry scoop of pre-workout and burst forward, damaging everyone in the way. +Cringe after (it was public).',
    cooldownMs: CONFIG.ABILITIES.DRY_SCOOP_DASH.COOLDOWN_MS,
    numbers: {
      distancePx: CONFIG.ABILITIES.DRY_SCOOP_DASH.DISTANCE_PX,
      durationMs: CONFIG.ABILITIES.DRY_SCOOP_DASH.DURATION_MS,
      damage: CONFIG.ABILITIES.DRY_SCOOP_DASH.DAMAGE,
      cringeGain: CONFIG.ABILITIES.DRY_SCOOP_DASH.CRINGE_GAIN,
    },
  },
  fakePlatesRage: {
    id: 'fakePlatesRage',
    name: 'Fake Plates Rage',
    shortName: 'RAGE',
    slot: 'R',
    description: 'ULT: the plates were foam all along. Damage and speed boost; massive Cringe spike when it wears off.',
    cooldownMs: CONFIG.ABILITIES.FAKE_PLATES_RAGE.COOLDOWN_MS,
    numbers: {
      durationMs: CONFIG.ABILITIES.FAKE_PLATES_RAGE.DURATION_MS,
      damageMultiplier: CONFIG.ABILITIES.FAKE_PLATES_RAGE.DAMAGE_MULTIPLIER,
      moveSpeedMultiplier: CONFIG.ABILITIES.FAKE_PLATES_RAGE.MOVE_SPEED_MULTIPLIER,
      cringeSpikeOnEnd: CONFIG.ABILITIES.FAKE_PLATES_RAGE.CRINGE_SPIKE_ON_END,
    },
  },
};
