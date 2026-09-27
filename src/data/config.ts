/**
 * CLOUT ROYALE — CONFIG
 * ---------------------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH for every tunable number in the game:
 * stats, damage, cooldowns, durations, distances, trend thresholds, XP curve.
 *
 * Rules:
 *  - No magic numbers anywhere else in src/. If it's tunable, it lives here.
 *  - These values will be copied into the future Unreal build — keep them
 *    clean, labeled, and grouped.
 *  - Sections marked "Milestone N" are data staged for later milestones and
 *    are NOT consumed by gameplay code yet.
 */

export interface ZoneConfig {
  id: string;
  label: string;
  x: number; // top-left, px
  y: number; // top-left, px
  width: number;
  height: number;
  color: number;
  /** Texture key tiled across the zone (see data/art.ts). Missing = flat color fill. */
  floor?: string;
}

/** A decorative prop drawn under everything that moves. No collision. */
export interface DecorConfig {
  key: string; // texture key from data/art.ts
  x: number; // center, px
  y: number;
  /** Set both to tile the texture across a rectangle (e.g. pool water). */
  width?: number;
  height?: number;
  angle?: number; // degrees
  scale?: number; // multiplied with ART.TILE_SCALE
}

export interface SpawnPoint {
  x: number;
  y: number;
}

/** AirWon trend lifecycle — the whole satire is this arc. */
export type TrendStage = 'Underground' | 'Viral' | 'Mainstream' | 'Washed';

export interface HubInteractableConfig {
  id: string;
  label: string;
  x: number;
  y: number;
  color: number;
  /** Key into HubScene's action-handler map. */
  action: string;
  flavorText?: string;
}

export interface BotArchetypeConfig {
  id: string;
  label: string;
  color: number;
  maxHealth: number;
  moveSpeed: number; // px/sec chase speed
  attackDamage: number; // HP per melee hit on the player
  attackRangePx: number; // stops and swings inside this distance
  attackCooldownMs: number; // time between melee hits
  moneyDrop: number; // $ dropped on elimination
  cloutDrop: number; // Clout dropped on elimination
}

export const CONFIG = {
  // -------------------------------------------------------------------------
  // Canvas / presentation
  // -------------------------------------------------------------------------
  CANVAS: {
    WIDTH: 1280,
    HEIGHT: 720,
  },

  // -------------------------------------------------------------------------
  // Match rules — per-mission numbers live in MISSIONS below
  // -------------------------------------------------------------------------
  MATCH: {
    RESTART_INPUT_LOCK_MS: 600, // delay before end-screen accepts a click
  },

  // -------------------------------------------------------------------------
  // Missions — numbers only; the registry shape lives in data/missions.ts.
  // New missions = new entry here + new entry in MISSION_REGISTRY.
  // -------------------------------------------------------------------------
  MISSIONS: {
    // Objective: ELIMINATE — the on-ramp. Fixed pool, no respawns.
    MANSION_LOCKDOWN: {
      DURATION_SECONDS: 180, // match ends at 3:00
      TARGET: 5, // early victory at this many eliminations
      WAVE_MAX_INTERVAL_MS: 30000, // failsafe: next wave arrives even if current isn't cleared
      WAVES: [
        ['npcStreamer', 'cryptoBro', 'npcStreamer'], // wave 1: soft intro
        ['cryptoBro', 'wellnessGuru', 'dropshipper'], // wave 2: mixed
        ['dropshipper', 'wellnessGuru', 'npcStreamer'], // wave 3: closer
      ],
    },
    // Objective: SURVIVE — waves loop until the timer runs out; the timer IS the win.
    LIVESTREAM_MARATHON: {
      DURATION_SECONDS: 150, // stay live for 2:30
      WAVE_MAX_INTERVAL_MS: 35000, // slower failsafe: looping waves stack up otherwise
      WAVES: [
        ['npcStreamer', 'cryptoBro'],
        ['wellnessGuru', 'dropshipper'],
        ['cryptoBro', 'cryptoBro', 'npcStreamer'],
        ['wellnessGuru', 'wellnessGuru'],
      ],
      UNLOCK_WINS: 1, // wins on MANSION_LOCKDOWN required
    },
    // Objective: COLLECT — grab smoothies while the trend is hot. Chaining
    // grabs tips it into Washed (cringe -> slow), so pacing is the skill.
    TREND_CHASER: {
      DURATION_SECONDS: 180,
      TARGET: 8, // smoothies to collect (spawn cadence allows ~18 per match)
      WAVE_MAX_INTERVAL_MS: 30000,
      WAVES: [
        ['npcStreamer', 'npcStreamer'],
        ['dropshipper', 'cryptoBro'],
        ['wellnessGuru', 'npcStreamer'],
      ],
      UNLOCK_WINS: 1, // wins on LIVESTREAM_MARATHON required
    },
  },

  // -------------------------------------------------------------------------
  // Hub — the non-combat mansion between missions
  // -------------------------------------------------------------------------
  HUB: {
    PLAYER_SPAWN: { x: 640, y: 500 },
    INTERACT_RADIUS_PX: 64, // walk within this of an interactable to use it
    RESULT_BANNER_MS: 6000, // how long the last-run banner stays up
    INTERACTABLES: [
      // action = key into HubScene's handler map (registry pattern)
      { id: 'missionTerminal', label: 'MISSION TERMINAL', x: 1045, y: 180, color: 0xffe066, action: 'openMissionSelect' },
      {
        id: 'smoothieFridge',
        label: 'SMOOTHIE FRIDGE',
        x: 640,
        y: 140,
        color: 0x27ae60,
        action: 'flavor',
        flavorText: "LEGALLY, NONE OF THIS IS 'FOOD'",
      },
      { id: 'gainsShop', label: 'GAINS SHOP', x: 235, y: 180, color: 0xffa94d, action: 'openShop' }, // Aura Gym: grind for gains
      { id: 'grindShrine', label: 'GRIND SHRINE', x: 235, y: 545, color: 0xe74c3c, action: 'showStats' }, // moved to the Pool
      { id: 'contentStudio', label: 'AUTOMATION DESK', x: 560, y: 382, color: 0x8d99ae, action: 'openAutomation' }, // AI automation (idle layer)
    ],
  },

  // -------------------------------------------------------------------------
  // Arena: "Aura Mansion" — zones are cosmetic EXCEPT:
  //   touchGrassBackyard drains Cringe, smoothieShop grants Aura on entry
  // -------------------------------------------------------------------------
  ARENA: {
    NAME: 'AURA MANSION',
    WALL_PADDING: 10, // inset of playable physics bounds from the canvas edge
    ZONES: [
      { id: 'auraGym', label: 'AURA GYM', x: 70, y: 70, width: 330, height: 210, color: 0xe74c3c, floor: 'floor-gym' },
      { id: 'smoothieShop', label: 'AIRWON SMOOTHIE SHOP', x: 500, y: 60, width: 280, height: 150, color: 0x27ae60, floor: 'floor-kitchen' },
      { id: 'ringLightRoom', label: 'RING LIGHT ROOM', x: 880, y: 70, width: 330, height: 210, color: 0xff8fd6, floor: 'floor-lightwood' },
      { id: 'pool', label: 'POOL', x: 70, y: 430, width: 330, height: 220, color: 0x2e86de, floor: 'floor-deck' },
      { id: 'touchGrassBackyard', label: 'TOUCH GRASS BACKYARD', x: 760, y: 440, width: 450, height: 210, color: 0x7bb661, floor: 'floor-grass' },
      { id: 'contentStudio', label: 'CONTENT STUDIO', x: 440, y: 290, width: 240, height: 130, color: 0x8d99ae, floor: 'floor-studio' }, // added in M5 for the automation layer
    ] as ZoneConfig[],
    // Props are cosmetic only. Positions keep clear of zone headers and hub markers.
    DECOR: [
      // Aura Gym: four weight benches around the Gains Shop
      { key: 'decor-bench', x: 130, y: 150 },
      { key: 'decor-bench', x: 340, y: 150 },
      { key: 'decor-bench', x: 130, y: 240 },
      { key: 'decor-bench', x: 340, y: 240 },
      // Smoothie shop: counters flanking the fridge
      { key: 'decor-sink', x: 548, y: 116 },
      { key: 'decor-stove', x: 732, y: 116 },
      // Ring light room: ring lights, rug, and a couch along the bottom wall
      { key: 'decor-ringlight', x: 925, y: 128 },
      { key: 'decor-ringlight', x: 1165, y: 128 },
      { key: 'decor-rug', x: 1045, y: 180, scale: 1.3 },
      { key: 'decor-couch-left', x: 997, y: 250 },
      { key: 'decor-couch-mid', x: 1045, y: 250 },
      { key: 'decor-couch-right', x: 1093, y: 250 },
      // Pool: water inset inside the deck
      { key: 'floor-water', x: 235, y: 551, width: 294, height: 162 },
      // Backyard: greenery
      { key: 'decor-bush', x: 800, y: 612, scale: 1.1 },
      { key: 'decor-bush', x: 1172, y: 612, scale: 1.1 },
      { key: 'decor-bush-orange', x: 1172, y: 505 },
      { key: 'decor-bush-small', x: 990, y: 620 },
      { key: 'decor-plant', x: 800, y: 505 },
      // Content studio: a desk and a ring light
      { key: 'decor-desk', x: 490, y: 372 },
      { key: 'decor-ringlight', x: 640, y: 368 },
    ] as DecorConfig[],
  },

  // -------------------------------------------------------------------------
  // Playable classes — numbers only; the registry shape lives in data/classes.ts.
  // New classes = new entry here + new entry in CLASS_REGISTRY. No new code paths.
  // -------------------------------------------------------------------------
  CLASSES: {
    GYMFLUENCER: {
      COLOR: 0xffc93c,
      MAX_HEALTH: 100,
      MOVE_SPEED: 240, // px/sec
      ATTACK_DAMAGE: 18, // per basic-attack projectile hit
      ATTACK_COOLDOWN_MS: 320, // basic attack fire rate
      ATTACK_RANGE_PX: 420, // projectile max travel distance
      PROJECTILE_SPEED: 640, // px/sec
      STARTING_CLOUT: 0,
      STARTING_AURA: 50,
      STARTING_CRINGE: 0,
    },
  },

  // -------------------------------------------------------------------------
  // Bots (parody archetypes only — no real people/platforms)
  // Wave lineups are per-mission (see MISSIONS); a fixed pool spawns in
  // waves with no respawning — clearing the arena is a win condition.
  // -------------------------------------------------------------------------
  BOTS: {
    AGGRO: {
      MAX_ATTACKERS: 2, // at most this many bots push into melee at once
      STANDOFF_DISTANCE_PX: 170, // non-attackers hover at this range...
      STANDOFF_HYSTERESIS_PX: 30, // ...within this tolerance band
      ORBIT_SPEED: 70, // px/sec strafe while hovering
    },
    VOICE: {
      MIN_INTERVAL_MS: 5000, // bots shout a cringe line every 5–11s
      MAX_INTERVAL_MS: 11000,
      BUBBLE_DURATION_MS: 1700,
    },
    MIN_SPAWN_DISTANCE_PX: 320, // never spawn closer than this to the player
    SPAWN_POINTS: [
      { x: 110, y: 110 },
      { x: 1170, y: 110 },
      { x: 110, y: 610 },
      { x: 1170, y: 610 },
      { x: 640, y: 110 },
      { x: 640, y: 610 },
    ] as SpawnPoint[],
    ARCHETYPES: {
      // Retuned for M2: two simultaneous attackers deal ~10 HP/sec combined,
      // so a stationary player survives ~10s and a moving one wins on skill.
      cryptoBro: {
        id: 'cryptoBro',
        label: 'Crypto Bro',
        color: 0xf7931a,
        maxHealth: 45,
        moveSpeed: 150,
        attackDamage: 6,
        attackRangePx: 40,
        attackCooldownMs: 1200,
        moneyDrop: 25,
        cloutDrop: 3,
      },
      npcStreamer: {
        id: 'npcStreamer',
        label: 'NPC Streamer',
        color: 0x9b59b6,
        maxHealth: 30,
        moveSpeed: 190,
        attackDamage: 4,
        attackRangePx: 36,
        attackCooldownMs: 1000,
        moneyDrop: 12,
        cloutDrop: 2,
      },
      wellnessGuru: {
        id: 'wellnessGuru',
        label: 'Wellness Guru',
        color: 0x2ecc71,
        maxHealth: 60,
        moveSpeed: 120,
        attackDamage: 8,
        attackRangePx: 44,
        attackCooldownMs: 1400,
        moneyDrop: 18,
        cloutDrop: 4,
      },
      dropshipper: {
        id: 'dropshipper',
        label: 'Dropshipper',
        color: 0xff5e9c,
        maxHealth: 40,
        moveSpeed: 165,
        attackDamage: 5,
        attackRangePx: 40,
        attackCooldownMs: 1100,
        moneyDrop: 35,
        cloutDrop: 5,
      },
    } as Record<string, BotArchetypeConfig>,
  },

  // -------------------------------------------------------------------------
  // Loot pickups dropped by eliminated bots
  // -------------------------------------------------------------------------
  PICKUPS: {
    LIFETIME_MS: 10000, // uncollected drops despawn after this
    // On VICTORY, drops still on the ground are banked automatically — the
    // winning elimination ends the match instantly, so without this the final
    // kill's drop (and anything not yet walked over) would always be lost and
    // clean wins could pay $0. Defeat/timeup still lose uncollected drops.
    AUTO_COLLECT_ON_VICTORY: true,
  },

  // -------------------------------------------------------------------------
  // Shared combat feel — knockback + feedback
  // -------------------------------------------------------------------------
  COMBAT: {
    KNOCKBACK: {
      VELOCITY: 260, // impulse applied to bots hit by abilities/parries
      DURATION_MS: 130, // AI can't steer during this window
    },
    PROJECTILE_KNOCKBACK_VELOCITY: 180, // lighter shove from basic attacks
  },

  // -------------------------------------------------------------------------
  // XP / levels — level cap 67, prestige tier sits above it (hook only for now)
  // M4 retune: a solid run (5-elim win, drops collected) ≈ 100 XP, so early
  // levels are ~1 run each and level 20+ takes real grinding (curve does the rest).
  // -------------------------------------------------------------------------
  XP: {
    PER_ELIMINATION: 12,
    OUTCOME_BONUS: {
      victory: 40, // elimination target hit or arena cleared
      timeup: 15, // survived to the timer
      defeat: 10, // participation aura
    },
    CLEARED_BONUS: 35, // extra on top of victory when the FULL pool is cleared
    BASE_TO_LEVEL: 100, // XP needed to go level 1 -> 2
    GROWTH: 1.12, // per-level multiplier: xpToNext(n) = BASE * GROWTH^(n-1)
    LEVEL_CAP: 67,
  },

  // -------------------------------------------------------------------------
  // Prestige — Milestone: later. Hook only; nothing consumes this yet.
  // -------------------------------------------------------------------------
  PRESTIGE: {
    UNLOCK_LEVEL: 67, // prestige becomes available at the level cap
  },

  // -------------------------------------------------------------------------
  // AirWon Smoothie Trend Heat (LIVE as of M7)
  // Smoothies spawn in the shop; grabbing one pays out at the CURRENT stage,
  // then adds heat. Heat decays, so riding the trend means chaining grabs —
  // and overdoing it tips into Washed (cringe penalty, worthless payout).
  // Match-scoped: heat resets between missions.
  // -------------------------------------------------------------------------
  TREND: {
    STAGE_THRESHOLDS: {
      VIRAL: 25, // heat >= this => Viral
      MAINSTREAM: 60, // heat >= this => Mainstream
      WASHED: 90, // heat >= this => Washed
    },
    HEAT_MAX: 100,
    HEAT_PER_SMOOTHIE: 20, // net +12 per 10s spawn cycle after decay
    HEAT_DECAY_PER_SECOND: 0.8,
    FIRST_SPAWN_DELAY_MS: 5000,
    SPAWN_INTERVAL_MS: 10000,
    MAX_ON_FIELD: 2, // uncollected smoothies on the ground at once
    SMOOTHIE_LIFETIME_MS: 15000, // uncollected smoothies melt
    // Payout for grabbing a smoothie AT each stage. Lean by design: a
    // dedicated smoothie-farming run adds ~$40-60 — active, risk-gated income
    // (you cross the arena mid-fight), never rivaling eliminations.
    PAYOUTS: {
      Underground: { MONEY: 4, CLOUT: 1, CRINGE: 0 }, // early adopter, nobody cares
      Viral: { MONEY: 7, CLOUT: 3, CRINGE: 0 }, // peak cool: best clout
      Mainstream: { MONEY: 12, CLOUT: 2, CRINGE: 0 }, // sellout era: best money
      Washed: { MONEY: 2, CLOUT: 0, CRINGE: 10 }, // you're still drinking that?
    } as Record<TrendStage, { MONEY: number; CLOUT: number; CRINGE: number }>,
  },

  // -------------------------------------------------------------------------
  // Meter interactions (LIVE as of M2)
  // -------------------------------------------------------------------------
  METERS: {
    AURA_MAX: 100,
    CRINGE_MAX: 100,
    CRINGE_SLOW_THRESHOLD: 70, // Cringe at/above this slows the player...
    CRINGE_SLOW_MULTIPLIER: 0.7, // ...to this fraction of move speed
    AURA_MOG_BEAM_BONUS_PER_POINT: 0.005, // +0.5% Mog Beam damage per Aura point
    AURA_LOW_THRESHOLD: 10, // dropping below this fires "NEGATIVE AURA DETECTED"
    CRINGE_DECAY_IN_BACKYARD_PER_SECOND: 12, // touch grass to cleanse cringe
    SMOOTHIE_AURA_GAIN: 5, // aura granted on entering the smoothie shop
  },

  // -------------------------------------------------------------------------
  // Gymfluencer abilities (LIVE as of M2 — executor in systems/AbilitySystem.ts)
  // -------------------------------------------------------------------------
  ABILITIES: {
    MOG_BEAM: {
      // Q — cone stare; damage & width scale with Aura, hits steal Aura back
      COOLDOWN_MS: 6000,
      DAMAGE: 35, // base damage before the Aura bonus
      RANGE_PX: 320,
      CONE_HALF_ANGLE_DEG: 30, // base half-angle of the cone
      AURA_WIDTH_BONUS_PER_POINT: 0.006, // +0.6% cone width per Aura point
      AURA_COST: 15, // spent per cast (clamped at 0)
      AURA_STEAL_PER_HIT: 5, // aura gained per enemy caught in the beam
      VISUAL_FADE_MS: 280,
    },
    MEWING_PARRY: {
      // E — timed block; blocked hit reflects damage and grants Aura
      COOLDOWN_MS: 8000,
      WINDOW_MS: 600,
      REFLECT_MULTIPLIER: 3.0, // reflected damage = attacker's damage x this
      AURA_GAIN: 10, // aura granted per parried hit
    },
    DRY_SCOOP_DASH: {
      // Shift — fast damaging dash; dry scooping in public is cringe
      COOLDOWN_MS: 4000,
      DISTANCE_PX: 220,
      DURATION_MS: 180,
      DAMAGE: 20, // dealt to each bot passed through
      HIT_RADIUS_PX: 42,
      CRINGE_GAIN: 8, // cringe added when the dash ends
    },
    FAKE_PLATES_RAGE: {
      // R (ult) — temp buff; the plates turn out to be foam when it ends
      COOLDOWN_MS: 45000,
      DURATION_MS: 6000,
      DAMAGE_MULTIPLIER: 1.5,
      MOVE_SPEED_MULTIPLIER: 1.25,
      CRINGE_SPIKE_ON_END: 30, // everyone saw the plates were foam
    },
  },

  // -------------------------------------------------------------------------
  // Upgrades (LIVE as of M4) — numbers for data/upgrades.ts registry.
  // COSTS[i] = cost of rank i+1; array length = max rank. Explicit arrays so
  // the spending curve is readable at a glance (no growth-formula drift).
  // Economy anchor: a solid run pays ~$80 and ~13 clout.
  // -------------------------------------------------------------------------
  UPGRADES: {
    PROTEIN_BUDGET: { COSTS: [150, 225, 340, 505, 760], HEALTH_PER_RANK: 12 }, // first buy ≈ 2 runs
    GRIP_STRENGTH: { COSTS: [200, 300, 450, 675, 1010], DAMAGE_PER_RANK: 2 }, // first buy ≈ 2.5 runs
    PREWORKOUT_STACK: { COSTS: [450, 720, 1150, 1840], COOLDOWN_REDUCTION_PER_RANK: 0.08 }, // mid-tier ≈ 6 runs
    CARDIO_COPE: { COSTS: [30, 50, 85], MOVE_SPEED_PCT_PER_RANK: 0.04 }, // clout-priced sink
  },

  // -------------------------------------------------------------------------
  // AI Automation (LIVE as of M5) — passive income units bought at the
  // CONTENT STUDIO. Design guardrail: automation SUPPLEMENTS active play.
  // Active fighting earns ~$90/min + ~14 clout/min; a fully maxed build
  // produces $7.10/min + 0.50 clout/min (~1/13th money, ~1/28th clout).
  // Rates are per rank; a unit's output = rate x owned rank.
  // -------------------------------------------------------------------------
  AUTOMATION: {
    OFFLINE_CAP_HOURS: 8, // offline accrual stops after this long away
    OFFLINE_RATE_MULTIPLIER: 0.5, // offline earns at half the online rate
    UNITS: {
      MOTIVATION_BOT: { COSTS: [120, 200, 340, 570, 950], MONEY_PER_MIN_PER_RANK: 0.5 }, // r1 pays back in ~1 overnight
      SLOP_CONTENT_FARM: { COSTS: [450, 800, 1400], MONEY_PER_MIN_PER_RANK: 1.0 },
      ENGAGEMENT_BOT_SWARM: { COSTS: [25, 45, 80], CLOUT_PER_MIN_PER_RANK: 0.1 }, // clout-priced, clout-producing
      AI_PODCAST_NETWORK: { COSTS: [1200, 2000], MONEY_PER_MIN_PER_RANK: 0.8, CLOUT_PER_MIN_PER_RANK: 0.1 }, // late-game trophy
    },
  },

  // -------------------------------------------------------------------------
  // Art — sprite sizing and WebGL effects. Files are listed in data/art.ts.
  // -------------------------------------------------------------------------
  ART: {
    TILE_SCALE: 0.75, // 64px tiles drawn at 48px so rooms read at character scale
    PLAYER: { SIZE_PX: 38, BODY_RADIUS_PX: 14 }, // longest side on screen; circular hitbox
    BOT: { SIZE_PX: 34, BODY_RADIUS_PX: 13 },
    GROUND_RING_PAD_PX: 5, // team-color ring drawn this far outside the hitbox
    GLOW: { STRENGTH: 3, PADDING: 12 }, // preFX glow on pickups/projectiles (WebGL only)
    RAGE_GLOW_COLOR: 0xff4444,
    FLOOR_TINT: 0x7d6e66, // darkens the hallway wood so rooms, characters, and the HUD stand out
  },

  // -------------------------------------------------------------------------
  // UI / feedback
  // -------------------------------------------------------------------------
  UI: {
    /** Loaded from Google Fonts in index.html; BootScene waits for it (with a timeout). */
    FONT: '"Space Grotesk", "Helvetica Neue", Arial, sans-serif',
    SHOP: {
      PURCHASE_INPUT_LOCK_MS: 600, // the click that OPENED the shop can't also buy
    },
    FEED: {
      MAX_POSTS: 4, // posts rendered on the post-match creator feed
      // Fake engagement: likes = BASE + elims*PER_ELIM + clout*PER_CLOUT (±25% jitter)
      BASE_LIKES: 120,
      LIKES_PER_ELIM: 111,
      LIKES_PER_CLOUT: 37,
      DEFEAT_ENGAGEMENT_MULT: 3, // getting ratio'd is great content
    },
    HUD_DEPTH: 50,
    OVERLAY_DEPTH: 100,
    HEALTH_BAR: { X: 16, Y: 14, WIDTH: 220, HEIGHT: 18 },
    METER_BAR: { WIDTH: 140, HEIGHT: 10 }, // aura / cringe bars under the health bar
    ABILITY_BAR: {
      ICON_SIZE: 56,
      SPACING: 70, // center-to-center distance between icons
      Y_OFFSET_FROM_BOTTOM: 64,
    },
    POPUP: {
      Y: 150, // vertical position of big meme popups
      HOLD_MS: 900, // time at full opacity before fading
      MIN_REPEAT_MS: 2500, // same popup text won't re-fire within this window
    },
    HIT_SHAKE_DURATION_MS: 60,
    HIT_SHAKE_INTENSITY: 0.004,
    HIT_FLASH_MS: 70, // white/red flash on damage
    FLOAT_TEXT_RISE_PX: 34,
    FLOAT_TEXT_DURATION_MS: 800,
    BOT_HP_BAR: { WIDTH: 32, HEIGHT: 5, OFFSET_Y: -26 },
  },
};
