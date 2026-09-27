/**
 * Post/popup registry + bot voice lines + creator-feed templates — the
 * game's text content lives here.
 * LIVE as of M2: meme popups fire on their triggers, bots shout voice lines.
 * LIVE as of M6: FEED_POST_REGISTRY drives the post-match creator feed.
 * New popups/lines/posts are just new entries — no new code paths.
 * All parody, no real names/brands.
 */
import { MISSION_REGISTRY, type MissionObjective, type MissionResult } from './missions';

export type PostTrigger =
  | 'elimination' // player eliminates a bot
  | 'gotEliminated' // player dies
  | 'auraLow' // aura meter drops below CONFIG.METERS.AURA_LOW_THRESHOLD
  | 'cringeHigh' // cringe meter crosses CONFIG.METERS.CRINGE_SLOW_THRESHOLD
  | 'zoneBackyard' // player enters Touch Grass Backyard
  | 'zoneSmoothieShop' // player enters AirWon Smoothie Shop
  | 'smoothieGrab' // player collects a smoothie (M7)
  | 'trendViral' // trend heat crosses into Viral (M7)
  | 'trendMainstream' // ...into Mainstream (M7)
  | 'trendWashed' // ...into Washed (M7)
  | 'rageEnd' // Fake Plates Rage wears off
  | 'matchEnd';

export interface PostDef {
  id: string;
  text: string;
  trigger: PostTrigger;
}

export const POST_REGISTRY: PostDef[] = [
  { id: 'mogged', text: 'YOU GOT MOGGED', trigger: 'gotEliminated' },
  { id: 'negativeAura', text: 'NEGATIVE AURA DETECTED', trigger: 'auraLow' },
  { id: 'ratiod', text: "RATIO'D", trigger: 'elimination' },
  { id: 'cloutFarmed', text: 'CLOUT FARMED', trigger: 'elimination' },
  { id: 'touchGrass', text: 'TOUCH GRASS', trigger: 'cringeHigh' },
  { id: 'grassTouched', text: 'GRASS TOUCHED', trigger: 'zoneBackyard' },
  { id: 'smoothieSecured', text: 'AIRWON SMOOTHIE SECURED', trigger: 'smoothieGrab' }, // M7: fires on GRAB, not zone entry
  { id: 'trendViral', text: 'AIRWON IS GOING VIRAL', trigger: 'trendViral' },
  { id: 'trendMainstream', text: 'AIRWON HIT THE MAINSTREAM', trigger: 'trendMainstream' },
  { id: 'trendWashed', text: 'AIRWON IS WASHED. YOU DID THIS.', trigger: 'trendWashed' },
  { id: 'fakePlatesExposed', text: 'FAKE PLATES EXPOSED', trigger: 'rageEnd' },
];

export function postsFor(trigger: PostTrigger): PostDef[] {
  return POST_REGISTRY.filter((p) => p.trigger === trigger);
}

// ---------------------------------------------------------------------------
// Post-match creator feed (M6) — fake social posts reacting to the run.
// Conditions are declarative so templates stay pure data (Unreal-portable).
// ---------------------------------------------------------------------------

/** Extra context the feed can react to beyond the match result. */
export interface FeedContext {
  level: number;
  /** Uncollected automation income at feed time. */
  pendingMoney: number;
}

export interface FeedPostRequires {
  outcome?: MissionResult['outcome'];
  cleared?: boolean;
  minEliminations?: number;
  maxEliminations?: number;
  leveledUp?: boolean;
  minMoneyEarned?: number;
  minPendingMoney?: number;
  /** Highest trend stage reached during the match (M7). */
  peakTrendStage?: MissionResult['peakTrendStage'];
  /** Which victory condition fired (victories only). */
  victoryType?: MissionResult['victoryType'];
  /** Objective type of the mission that was played. */
  objectiveType?: MissionObjective['type'];
}

export interface FeedPostDef {
  id: string;
  author: string;
  handle: string;
  /** Placeholders: {elims} {pool} {money} {clout} {xp} {level} {pending} {collected} {target} */
  text: string;
  requires?: FeedPostRequires;
  /** Higher priority renders earlier when more posts match than fit. */
  priority: number;
}

export const FEED_POST_REGISTRY: FeedPostDef[] = [
  {
    id: 'cleared',
    author: 'Mansion Watch',
    handle: '@mansionwatch',
    text: 'THE AURA MANSION HAS BEEN FULLY CLEARED. all {pool} rivals evicted. brand sponsors have been notified.',
    requires: { cleared: true },
    priority: 12,
  },
  {
    id: 'defeatZero',
    author: 'Grindset Guru',
    handle: '@grindsetguru',
    text: 'a zero-elimination performance. some call it pacifism. sponsors call it unmarketable.',
    requires: { outcome: 'defeat', maxEliminations: 0 },
    priority: 11,
  },
  {
    id: 'defeatRoast',
    author: 'RatioBot 9000',
    handle: '@ratiobot9000',
    text: 'bro got MOGGED in his own mansion. unfollowing.',
    requires: { outcome: 'defeat' },
    priority: 10,
  },
  {
    id: 'timeup',
    author: 'Clock App Official',
    handle: '@clockapp',
    text: "time's up. {elims} eliminations. the content? mid. the effort? undeniable.",
    requires: { outcome: 'timeup' },
    priority: 10,
  },
  {
    id: 'survived',
    author: 'Stream Recap',
    handle: '@streamrecap',
    text: 'still live at the buzzer with {elims} eliminations on stream. chat has forgiven nothing.',
    requires: { victoryType: 'survived' },
    priority: 11,
  },
  {
    id: 'collectWin',
    author: 'AirWon Corporate',
    handle: '@airwon',
    text: 'someone secured {collected} smoothies mid-fight. legal says we cannot sponsor this. marketing already did.',
    requires: { objectiveType: 'collect', outcome: 'victory' },
    priority: 11,
  },
  {
    id: 'collectTimeup',
    author: 'Trend Forensics',
    handle: '@trendforensics',
    text: 'the trend died with {collected}/{target} secured. it was never about the smoothies.',
    requires: { objectiveType: 'collect', outcome: 'timeup' },
    priority: 11,
  },
  {
    id: 'victoryRatio',
    author: 'Aura Farm Daily',
    handle: '@aurafarmdaily',
    text: "local gymfluencer just RATIO'D {elims} creators in one afternoon. aura levels: unmeasurable.",
    requires: { outcome: 'victory' },
    priority: 9,
  },
  {
    id: 'levelUp',
    author: 'Level Up Alerts',
    handle: '@levelupalerts',
    text: 'GYMFLUENCER JUST HIT LV {level}. the grind is (checks notes) real.',
    requires: { leveledUp: true },
    priority: 8,
  },
  {
    id: 'bigMoney',
    author: 'Wallet Inspector',
    handle: '@walletinspector',
    text: '${money} in one lockdown?? the creator economy is healing.',
    requires: { minMoneyEarned: 150 },
    priority: 7,
  },
  {
    id: 'slopWatch',
    author: 'Slop Watch',
    handle: '@slopwatch',
    text: 'meanwhile: his AI farm has ${pending} of uncollected content nobody watched. the machines are winning.',
    requires: { minPendingMoney: 1 },
    priority: 6,
  },
  {
    id: 'trendMainstreamFeed',
    author: 'AirWon Corporate',
    handle: '@airwon',
    text: 'our smoothie hit MAINSTREAM during a home invasion. the algorithm is undefeated.',
    requires: { peakTrendStage: 'Mainstream' },
    priority: 7,
  },
  {
    id: 'trendWashedFeed',
    author: 'Trend Forensics',
    handle: '@trendforensics',
    text: 'AirWon went from underground to WASHED in a single afternoon. a cautionary tale in one man\'s smoothie intake.',
    requires: { peakTrendStage: 'Washed' },
    priority: 8,
  },
  {
    id: 'sponsored',
    author: 'Sponsored',
    handle: '@ad',
    text: 'this recap is brought to you by AirWon. AirWon: legally, a beverage.',
    priority: 2,
  },
  {
    id: 'npcW',
    author: 'NPC Comment',
    handle: '@justvibing',
    text: 'W',
    priority: 1,
  },
];

/** Posts whose conditions match, highest priority first, capped at `max`. */
export function pickFeedPosts(result: MissionResult, ctx: FeedContext, max: number): FeedPostDef[] {
  return FEED_POST_REGISTRY.filter((post) => {
    const r = post.requires;
    if (!r) return true;
    if (r.outcome !== undefined && result.outcome !== r.outcome) return false;
    if (r.cleared !== undefined && (result.victoryType === 'cleared') !== r.cleared) return false;
    if (r.minEliminations !== undefined && result.eliminations < r.minEliminations) return false;
    if (r.maxEliminations !== undefined && result.eliminations > r.maxEliminations) return false;
    if (r.leveledUp !== undefined && result.levelsGained > 0 !== r.leveledUp) return false;
    if (r.minMoneyEarned !== undefined && result.moneyEarned < r.minMoneyEarned) return false;
    if (r.minPendingMoney !== undefined && ctx.pendingMoney < r.minPendingMoney) return false;
    if (r.peakTrendStage !== undefined && result.peakTrendStage !== r.peakTrendStage) return false;
    if (r.victoryType !== undefined && result.victoryType !== r.victoryType) return false;
    if (r.objectiveType !== undefined && MISSION_REGISTRY[result.missionId]?.objective.type !== r.objectiveType) return false;
    return true;
  })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, max);
}

/** Short cringe lines each bot archetype shouts mid-match (keyed by archetype id). */
export const BOT_VOICE_LINES: Record<string, string[]> = {
  cryptoBro: [
    'have you heard of my coin?',
    'this is financial advice',
    "we're all gonna make it bro",
    'the chart only goes up',
  ],
  npcStreamer: [
    'ANOTHER ROSE? THANK YOU',
    'yes yes yes big W',
    'thank you for the gift!!',
    'W in the chat W in the chat',
  ],
  wellnessGuru: [
    "it's about gut health bro",
    'have you tried raw milk?',
    'your pineal gland is calcified',
    'seed oils did this to you',
  ],
  dropshipper: [
    'the course is in my bio',
    'this product changed my life',
    'only 3 left in stock',
    'engagement is engagement',
  ],
};
