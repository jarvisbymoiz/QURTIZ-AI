/**
 * Source-aware research strategies for the shared Brave integration.
 *
 * Each strategy shapes the user's raw query toward a source class
 * (Google Trends signals, official sources, current news, product/company
 * announcements, Reddit/community, YouTube/creators) and can pin a
 * freshness window. Every strategy ultimately runs through the SAME
 * shared Brave web endpoint with the SAME project-level key — strategies
 * are query shaping, never different credentials.
 */

export type ResearchStrategy =
  | "web"
  | "trends"
  | "official"
  | "news"
  | "announcements"
  | "community"
  | "creators";

export type ResearchStrategyDefinition = {
  /** Agent-facing label, used in result summaries. */
  label: string;
  /** Brave freshness default when the caller doesn't specify one. */
  freshness?: string;
  /** Shape the raw query toward this source class. */
  buildQuery: (query: string) => string;
};

export const RESEARCH_STRATEGIES: Record<ResearchStrategy, ResearchStrategyDefinition> = {
  web: {
    label: "broad web",
    buildQuery: (q) => q,
  },
  trends: {
    label: "Google Trends / search-interest signals",
    freshness: "pm",
    buildQuery: (q) => `${q} (Google Trends OR "search interest" OR trending topics)`,
  },
  official: {
    label: "official sources",
    buildQuery: (q) => `${q} official (documentation OR blog OR press release OR statement)`,
  },
  news: {
    label: "current news",
    freshness: "pw",
    buildQuery: (q) => `${q} latest news`,
  },
  announcements: {
    label: "product & company announcements",
    freshness: "pm",
    buildQuery: (q) => `${q} (launch OR release OR announcement OR "what's new")`,
  },
  community: {
    label: "Reddit & community signals",
    buildQuery: (q) => `site:reddit.com ${q}`,
  },
  creators: {
    label: "YouTube & creator content",
    buildQuery: (q) => `site:youtube.com ${q}`,
  },
};

export const RESEARCH_STRATEGY_IDS = Object.keys(RESEARCH_STRATEGIES) as ResearchStrategy[];

/** Safe coercion of untrusted input (agent tool args) into a strategy id. */
export function asResearchStrategy(value: unknown): ResearchStrategy | null {
  return typeof value === "string" && value in RESEARCH_STRATEGIES ? (value as ResearchStrategy) : null;
}
