/**
 * AI Automation registry — LIVE as of M5. The satire (AI slop, engagement
 * farming, faceless content mills) as a mechanic: units produce passive
 * money/clout over real time, online and offline. Consumed by
 * AutomationScene (purchases/collection) and AutomationSystem (accrual).
 * New units = a new CONFIG.AUTOMATION.UNITS block + an entry here.
 * All numbers live in CONFIG.AUTOMATION (single source of truth).
 */
import { CONFIG } from './config';

export type AutomationCurrency = 'money' | 'clout';

export interface AutomationUnitDef {
  id: string;
  name: string;
  description: string;
  currency: AutomationCurrency;
  /** costs[i] = price of rank i+1; costs.length = max rank. */
  costs: number[];
  /** Production per rank per real-time minute. */
  production: {
    moneyPerMin?: number;
    cloutPerMin?: number;
  };
}

export const AUTOMATION_REGISTRY: Record<string, AutomationUnitDef> = {
  motivationBot: {
    id: 'motivationBot',
    name: 'Motivation Bot',
    description: "Posts 'rise and grind' at 4 AM to 40,000 subscribers. None of them are up.",
    currency: 'money',
    costs: CONFIG.AUTOMATION.UNITS.MOTIVATION_BOT.COSTS,
    production: { moneyPerMin: CONFIG.AUTOMATION.UNITS.MOTIVATION_BOT.MONEY_PER_MIN_PER_RANK },
  },
  slopContentFarm: {
    id: 'slopContentFarm',
    name: 'Slop Content Farm',
    description: 'A thousand videos a day. None watchable. All monetized.',
    currency: 'money',
    costs: CONFIG.AUTOMATION.UNITS.SLOP_CONTENT_FARM.COSTS,
    production: { moneyPerMin: CONFIG.AUTOMATION.UNITS.SLOP_CONTENT_FARM.MONEY_PER_MIN_PER_RANK },
  },
  engagementBotSwarm: {
    id: 'engagementBotSwarm',
    name: 'Engagement Bot Swarm',
    description: "10,000 accounts replying 'so true bestie'.",
    currency: 'clout',
    costs: CONFIG.AUTOMATION.UNITS.ENGAGEMENT_BOT_SWARM.COSTS,
    production: { cloutPerMin: CONFIG.AUTOMATION.UNITS.ENGAGEMENT_BOT_SWARM.CLOUT_PER_MIN_PER_RANK },
  },
  aiPodcastNetwork: {
    id: 'aiPodcastNetwork',
    name: 'AI Podcast Network',
    description: 'Two AI hosts interview each other forever. Sponsors love it.',
    currency: 'money',
    costs: CONFIG.AUTOMATION.UNITS.AI_PODCAST_NETWORK.COSTS,
    production: {
      moneyPerMin: CONFIG.AUTOMATION.UNITS.AI_PODCAST_NETWORK.MONEY_PER_MIN_PER_RANK,
      cloutPerMin: CONFIG.AUTOMATION.UNITS.AI_PODCAST_NETWORK.CLOUT_PER_MIN_PER_RANK,
    },
  },
};

export interface AutomationRates {
  moneyPerMin: number;
  cloutPerMin: number;
}

/** Total production rate for a set of owned unit ranks. */
export function computeAutomationRates(owned: Record<string, number>): AutomationRates {
  const rates: AutomationRates = { moneyPerMin: 0, cloutPerMin: 0 };
  for (const def of Object.values(AUTOMATION_REGISTRY)) {
    const rank = Math.min(owned[def.id] ?? 0, def.costs.length);
    if (rank <= 0) continue;
    rates.moneyPerMin += (def.production.moneyPerMin ?? 0) * rank;
    rates.cloutPerMin += (def.production.cloutPerMin ?? 0) * rank;
  }
  return rates;
}
