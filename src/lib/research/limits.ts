import "server-only";

/**
 * Centralized usage-control plan limits for the shared Brave integration.
 *
 * Qurtiz funds ONE Brave key on behalf of every workspace; these limits
 * decide how much of that shared quota each plan tier may consume. They
 * are enforcement defaults today and become user-facing SaaS plan rules
 * (Free → limited live research, Pro → higher, Business → higher/shared)
 * when the billing surface lands.
 *
 * live = a request that actually hit the Brave API. Cache hits and
 * deduped joins are free worldwide and never consume plan allowance.
 */

export type ResearchPlanLimits = {
  /** Per-workspace requests per rolling minute (abuse protection). */
  perMinute: number;
  /** Live Brave calls per workspace per UTC month. */
  perMonthLive: number;
};

export const DEFAULT_RESEARCH_PLAN_LIMITS: Record<string, ResearchPlanLimits> = {
  free: { perMinute: 6, perMonthLive: 300 },
  pro: { perMinute: 20, perMonthLive: 3000 },
  business: { perMinute: 60, perMonthLive: 15000 },
  enterprise: { perMinute: 120, perMonthLive: Number.MAX_SAFE_INTEGER },
};

/** Global shared-key guard: Brave's free tier is 1 query/second. */
export function braveGlobalMaxQps(): number {
  const raw = Number(process.env.BRAVE_SEARCH_MAX_QPS ?? "1");
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.min(Math.floor(raw), 50);
}

/** Short-lived anonymous result cache TTL (seconds), default 15 min. */
export function braveCacheTtlSeconds(): number {
  const raw = Number(process.env.BRAVE_SEARCH_CACHE_TTL_SECONDS ?? "900");
  if (!Number.isFinite(raw) || raw < 0) return 900;
  return Math.min(Math.floor(raw), 86_400);
}

function coerceLimit(value: unknown, max: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(Math.floor(n), max);
}

/**
 * Resolve limits for one workspace plan. Unknown plans degrade to `free`.
 * QURTIZ_RESEARCH_LIMITS_JSON (server env) may override per plan, e.g.
 * {"free":{"perMinute":4,"perMonthLive":150}} — malformed JSON or values
 * are ignored defensively; resolution never throws.
 */
export function researchPlanLimits(plan: string | null | undefined): ResearchPlanLimits {
  const key = (plan ?? "free").toLowerCase();
  const base = DEFAULT_RESEARCH_PLAN_LIMITS[key] ?? DEFAULT_RESEARCH_PLAN_LIMITS.free;

  const raw = process.env.QURTIZ_RESEARCH_LIMITS_JSON?.trim();
  if (!raw) return { ...base };
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<Record<keyof ResearchPlanLimits, unknown>>>;
    const override = parsed?.[key];
    if (!override || typeof override !== "object") return { ...base };
    const perMinute = coerceLimit(override.perMinute, 1000) ?? base.perMinute;
    const perMonthLive = coerceLimit(override.perMonthLive, Number.MAX_SAFE_INTEGER) ?? base.perMonthLive;
    return { perMinute, perMonthLive };
  } catch {
    return { ...base };
  }
}
