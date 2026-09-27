/**
 * Playable class registry — data-driven so new classes are just new entries.
 * All numbers reference CONFIG (single source of truth).
 *
 * Milestone 1 ships only the Gymfluencer. A second class is a later
 * milestone: add its numbers to CONFIG.CLASSES, add an entry here, done.
 */
import { CONFIG } from './config';

export interface CreatorClassDef {
  id: string;
  displayName: string;
  tagline: string;
  color: number;
  baseStats: {
    maxHealth: number;
    moveSpeed: number;
    attackDamage: number;
    attackCooldownMs: number;
    attackRangePx: number; // basic-attack projectile max travel
    projectileSpeed: number;
  };
  startingMeters: {
    clout: number;
    aura: number;
    cringe: number;
  };
  /** Resolved against ABILITY_REGISTRY — wired into gameplay in Milestone 2. */
  abilityIds: string[];
}

export const CLASS_REGISTRY: Record<string, CreatorClassDef> = {
  gymfluencer: {
    id: 'gymfluencer',
    displayName: 'Gymfluencer',
    tagline: 'Every rep is content.',
    color: CONFIG.CLASSES.GYMFLUENCER.COLOR,
    baseStats: {
      maxHealth: CONFIG.CLASSES.GYMFLUENCER.MAX_HEALTH,
      moveSpeed: CONFIG.CLASSES.GYMFLUENCER.MOVE_SPEED,
      attackDamage: CONFIG.CLASSES.GYMFLUENCER.ATTACK_DAMAGE,
      attackCooldownMs: CONFIG.CLASSES.GYMFLUENCER.ATTACK_COOLDOWN_MS,
      attackRangePx: CONFIG.CLASSES.GYMFLUENCER.ATTACK_RANGE_PX,
      projectileSpeed: CONFIG.CLASSES.GYMFLUENCER.PROJECTILE_SPEED,
    },
    startingMeters: {
      clout: CONFIG.CLASSES.GYMFLUENCER.STARTING_CLOUT,
      aura: CONFIG.CLASSES.GYMFLUENCER.STARTING_AURA,
      cringe: CONFIG.CLASSES.GYMFLUENCER.STARTING_CRINGE,
    },
    abilityIds: ['mogBeam', 'mewingParry', 'dryScoopDash', 'fakePlatesRage'],
  },
  // Future classes go here as data — no new code paths required.
};

export const DEFAULT_CLASS_ID = 'gymfluencer';
