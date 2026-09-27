/**
 * Mission registry — data-driven so new missions are just new entries,
 * matching the CLASS_REGISTRY / ABILITY_REGISTRY pattern.
 * All numbers live in CONFIG.MISSIONS (single source of truth).
 *
 * Objectives (the win condition GameScene checks every frame):
 *   eliminate — reach `target` eliminations (or clear the whole fixed pool)
 *   survive   — outlast the timer; waves loop so the pressure never lets up
 *   collect   — grab `target` smoothies from the shop before time runs out
 */
import { CONFIG, type TrendStage } from './config';
import type { SaveData } from '../systems/ProgressionSystem';

export type MissionObjective =
  | { type: 'eliminate'; target: number }
  | { type: 'survive' }
  | { type: 'collect'; target: number };

export interface MissionDef {
  id: string;
  name: string;
  tagline: string;
  /**
   * Which arena the mission plays in. Only 'auraMansion' exists; a
   * proper arena registry arrives with the second arena.
   */
  arenaId: 'auraMansion';
  objective: MissionObjective;
  durationSeconds: number;
  /** Bot archetype lineups, spawned wave by wave. */
  waves: string[][];
  waveMaxIntervalMs: number;
  /** Cycle back to wave 1 after the last wave (endless pressure for timed objectives). */
  loopWaves: boolean;
  /** Unlock gate: wins required on another mission. Omitted = unlocked from the start. */
  unlockAfter?: { missionId: string; wins: number };
}

/** Result payload GameScene hands back to HubScene when a mission ends. */
export interface MissionResult {
  missionId: string;
  outcome: 'victory' | 'defeat' | 'timeup';
  /** Which victory condition fired (only set on victory). */
  victoryType?: 'target' | 'cleared' | 'survived';
  eliminations: number;
  /** Size of one full wave cycle (the whole enemy pool when waves don't loop). */
  totalPool: number;
  /** Smoothies grabbed this match (progress for the collect objective). */
  smoothiesCollected: number;
  durationMs: number;
  moneyEarned: number;
  cloutEarned: number;
  xpEarned: number;
  levelsGained: number;
  /** Highest AirWon trend stage reached during the match (M7). */
  peakTrendStage?: TrendStage;
}

export const MISSION_REGISTRY: Record<string, MissionDef> = {
  mansionLockdown: {
    id: 'mansionLockdown',
    name: 'MANSION LOCKDOWN',
    tagline: 'Rival creators moved into the mansion. Evict them.',
    arenaId: 'auraMansion',
    objective: { type: 'eliminate', target: CONFIG.MISSIONS.MANSION_LOCKDOWN.TARGET },
    durationSeconds: CONFIG.MISSIONS.MANSION_LOCKDOWN.DURATION_SECONDS,
    waves: CONFIG.MISSIONS.MANSION_LOCKDOWN.WAVES,
    waveMaxIntervalMs: CONFIG.MISSIONS.MANSION_LOCKDOWN.WAVE_MAX_INTERVAL_MS,
    loopWaves: false,
  },
  livestreamMarathon: {
    id: 'livestreamMarathon',
    name: 'LIVESTREAM MARATHON',
    tagline: 'Stay live until the timer hits zero. The whole feed is showing up.',
    arenaId: 'auraMansion',
    objective: { type: 'survive' },
    durationSeconds: CONFIG.MISSIONS.LIVESTREAM_MARATHON.DURATION_SECONDS,
    waves: CONFIG.MISSIONS.LIVESTREAM_MARATHON.WAVES,
    waveMaxIntervalMs: CONFIG.MISSIONS.LIVESTREAM_MARATHON.WAVE_MAX_INTERVAL_MS,
    loopWaves: true,
    unlockAfter: { missionId: 'mansionLockdown', wins: CONFIG.MISSIONS.LIVESTREAM_MARATHON.UNLOCK_WINS },
  },
  trendChaser: {
    id: 'trendChaser',
    name: 'TREND CHASER',
    tagline: 'AirWon is about to blow up. Grab smoothies before the trend dies.',
    arenaId: 'auraMansion',
    objective: { type: 'collect', target: CONFIG.MISSIONS.TREND_CHASER.TARGET },
    durationSeconds: CONFIG.MISSIONS.TREND_CHASER.DURATION_SECONDS,
    waves: CONFIG.MISSIONS.TREND_CHASER.WAVES,
    waveMaxIntervalMs: CONFIG.MISSIONS.TREND_CHASER.WAVE_MAX_INTERVAL_MS,
    loopWaves: true,
    unlockAfter: { missionId: 'livestreamMarathon', wins: CONFIG.MISSIONS.TREND_CHASER.UNLOCK_WINS },
  },
  // Future missions go here as data — no new code paths required.
};

export const DEFAULT_MISSION_ID = 'mansionLockdown';

/** Unlock check against the save (missionsCompleted doubles as the gate). */
export function isMissionUnlocked(mission: MissionDef, save: SaveData): boolean {
  if (!mission.unlockAfter) return true;
  return (save.missionsCompleted[mission.unlockAfter.missionId] ?? 0) >= mission.unlockAfter.wins;
}

/** Short objective text for cards, e.g. "eliminate 5" / "survive 2:30" / "collect 8 smoothies". */
export function objectiveLabel(mission: MissionDef): string {
  const objective = mission.objective;
  switch (objective.type) {
    case 'eliminate':
      return `eliminate ${objective.target}`;
    case 'survive':
      return `survive ${formatClock(mission.durationSeconds)}`;
    case 'collect':
      return `collect ${objective.target} smoothies`;
  }
}

export function formatClock(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Headline + color for an outcome, shared by the end overlay, the feed, and the hub banner. */
export function outcomePresentation(result: MissionResult): { title: string; color: string } {
  if (result.outcome === 'defeat') return { title: 'YOU GOT MOGGED', color: '#ff6b6b' };
  if (result.outcome === 'timeup') return { title: "TIME'S UP", color: '#8ecae6' };
  const gold = '#ffd700';
  if (result.victoryType === 'cleared') return { title: 'ARENA CLEARED', color: gold };
  if (result.victoryType === 'survived') return { title: 'STILL LIVE', color: gold };
  const objectiveType = MISSION_REGISTRY[result.missionId]?.objective.type;
  return { title: objectiveType === 'collect' ? 'TREND SECURED' : 'CLOUT CHAMPION', color: gold };
}

/** "5/9 elims" for fixed pools, "5 elims" when waves loop (no finite pool). */
export function elimsLabel(result: MissionResult): string {
  const loops = MISSION_REGISTRY[result.missionId]?.loopWaves ?? false;
  return loops ? `${result.eliminations} elims` : `${result.eliminations}/${result.totalPool} elims`;
}
