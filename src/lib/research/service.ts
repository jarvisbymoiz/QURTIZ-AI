import "server-only";

import { createHash } from "node:crypto";
import { rateLimit } from "@/lib/security/rate-limit";
import { BraveSearchError, braveWebSearch, isBraveConfigured, type BraveResult } from "./brave";
import { asResearchStrategy, RESEARCH_STRATEGIES, type ResearchStrategy } from "./strategies";
import { braveCacheTtlSeconds, braveGlobalMaxQps, researchPlanLimits } from "./limits";
import {
  monthlyLiveSearchCount,
  recordResearchUsage,
  workspaceResearchPlan,
  type ResearchUsageStatus,
} from "./usage";

/**
 * ResearchService — the single gateway through which every Qurtiz user,
 * workspace, and agent tool reaches Brave Search.
 *
 *   User/Workspace → Qurtiz AI Agent → ResearchService → BraveSearchProvider
 *                                                            ↓
 *                                        BRAVE_SEARCH_API_KEY (server .env only)
 *
 * Isolation contract:
 * - The Brave credential is shared (one project key); the attribution is
 *   not. Every request must carry the authenticated workspaceId + userId,
 *   and every usage event is recorded against them.
 * - The shared result cache contains ONLY normalized public web results,
 *   keyed by (strategy, normalized query, region, language, freshness).
 *   It never keys on — and never contains — Brand Brain, memory, niche
 *   context, or any tenant identity. Two workspaces asking the same
 *   public question may share the anonymous cached answer; private
 *   context never crosses workspace boundaries.
 * - Tenant context (niche, brand summary) can shape the caller's query
 *   string upstream, but this service hashes only what it sends to Brave
 *   and caches only public results.
 */

export type ResearchFailureReason =
  | "invalid_request"
  | "provider_unavailable"
  | "rate_limited"
  | "plan_limit"
  | "quota"
  | "error";

export type ResearchRequest = {
  workspaceId: string;
  userId: string;
  query: string;
  /** Source-aware routing; unknown values degrade to "web". */
  strategy?: ResearchStrategy | string | null;
  /** 2-letter region for Brave `country` (default env/US). */
  region?: string | null;
  /** ISO language for Brave `search_lang` (default env/en). */
  language?: string | null;
  /** Freshness window pd|pw|pm|py; strategy default wins when omitted. */
  freshness?: string | null;
  /** Tenant context echo (niche) — NEVER part of the cache key/payload. */
  niche?: string | null;
  /** Desired result count (1-20, default 10). */
  count?: number;
  signal?: AbortSignal;
};

export type ResearchSuccess = {
  ok: true;
  provider: "brave";
  strategy: ResearchStrategy;
  strategyLabel: string;
  /** Echo of the caller's raw query (before strategy shaping). */
  query: string;
  results: BraveResult[];
  count: number;
  fromCache: boolean;
  /** True when a concurrent identical request already in flight was shared. */
  deduped: boolean;
};

export type ResearchFailure = {
  ok: false;
  reason: ResearchFailureReason;
  message: string;
  retryAfterSeconds?: number;
};

export type ResearchOutcome = ResearchSuccess | ResearchFailure;

/* ── Shared anonymous cache (public results only) ──────────────────── */

type CacheEntry = {
  expiresAt: number;
  results: BraveResult[];
};

const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, CacheEntry>();
/** cacheKey → in-flight live job; concurrent identical requests join it. */
const inflight = new Map<string, Promise<BraveResult[]>>();

/** Test/ops escape hatch: drop all cached results + join handles. */
export function clearResearchCaches(): void {
  cache.clear();
  inflight.clear();
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Collapse whitespace so trivially-equivalent queries share a bucket. */
function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Cache key — deliberately EXCLUDES workspaceId, userId, niche and any
 * tenant context. Public results only, keyed by public parameters.
 */
function cacheKeyFor(parts: {
  strategy: ResearchStrategy;
  preparedQuery: string;
  region: string | null;
  language: string | null;
  freshness: string | null;
}): string {
  return sha256(
    ["v1", parts.strategy, parts.preparedQuery.toLowerCase(), parts.region ?? "", parts.language ?? "", parts.freshness ?? ""].join(
      "\u001f",
    ),
  );
}

function cacheGet(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  // Refresh LRU position: re-insert at the end of iteration order.
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function cacheSet(key: string, entry: CacheEntry): void {
  cache.set(key, entry);
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function defaultRegion(): string {
  return process.env.BRAVE_SEARCH_DEFAULT_REGION?.trim() || "US";
}

function defaultLanguage(): string {
  return process.env.BRAVE_SEARCH_DEFAULT_LANGUAGE?.trim() || "en";
}

type TrackedFailure = {
  status: ResearchUsageStatus;
  reason: ResearchFailureReason;
  message: string;
  retryAfterSeconds?: number;
  httpStatus?: number;
};

/** A failure of the shared live job (qps guard / plan cap), shared with joiners. */
class ResearchSharedError extends Error {
  readonly failure: TrackedFailure;
  constructor(failure: TrackedFailure) {
    super(failure.message);
    this.name = "ResearchSharedError";
    this.failure = failure;
  }
}

function failureFromBraveError(error: BraveSearchError): TrackedFailure {
  switch (error.kind) {
    case "disabled":
      return {
        status: "provider_unavailable",
        reason: "provider_unavailable",
        message:
          "Live research is not configured on this Qurtiz deployment. Tell the user honestly that web research is temporarily unavailable — AI Chat and the rest of the app keep working.",
        httpStatus: error.httpStatus,
      };
    case "unauthorized":
      return {
        status: "provider_unavailable",
        reason: "provider_unavailable",
        message:
          "The shared research provider rejected its API key, so live research is temporarily unavailable. Tell the user honestly; a platform admin needs to check the key.",
        httpStatus: error.httpStatus,
      };
    case "quota":
      return {
        status: "quota",
        reason: "quota",
        message: error.retryAfterSeconds
          ? `The shared live-research quota is temporarily exhausted. Try again in about ${error.retryAfterSeconds} seconds.`
          : "The shared live-research quota is temporarily exhausted. Try again shortly.",
        retryAfterSeconds: error.retryAfterSeconds,
        httpStatus: error.httpStatus,
      };
    default:
      return {
        status: error.kind === "network" || error.kind === "timeout" ? "network_error" : "error",
        reason: "error",
        message: `Live research failed (${error.message.slice(0, 160)}). Try again or continue with AI knowledge.`,
        httpStatus: error.httpStatus,
      };
  }
}

/**
 * Handle one research request end-to-end. NEVER throws: every failure
 * mode returns a typed, agent-handleable ResearchFailure.
 */
export async function searchResearch(request: ResearchRequest): Promise<ResearchOutcome> {
  const startedAt = Date.now();
  try {
    if (!request?.workspaceId || !request?.userId) {
      return { ok: false, reason: "invalid_request", message: "Research requires an authenticated workspace and user." };
    }

    const query = normalizeQuery(request.query ?? "");
    if (query.length < 3 || query.length > 500) {
      return { ok: false, reason: "invalid_request", message: "Provide a research query between 3 and 500 characters." };
    }

    const strategy = asResearchStrategy(request.strategy) ?? "web";
    const definition = RESEARCH_STRATEGIES[strategy];
    const preparedQuery = definition.buildQuery(query);
    const region = request.region?.trim() || defaultRegion();
    const language = request.language?.trim() || defaultLanguage();
    const freshness = request.freshness?.trim() || definition.freshness || null;
    const count = request.count ?? 10;
    const cacheKey = cacheKeyFor({ strategy, preparedQuery, region, language, freshness });
    const queryHash = sha256(normalizeQuery(preparedQuery).toLowerCase());

    /** Telemetry for this request, capped + attributed to the tenant. */
    const track = (status: ResearchUsageStatus, opts?: { cacheHit?: boolean; httpStatus?: number | null }) =>
      recordResearchUsage({
        workspaceId: request.workspaceId,
        userId: request.userId,
        strategy,
        query: preparedQuery,
        queryHash,
        region,
        language,
        freshness,
        cacheHit: opts?.cacheHit ?? false,
        status,
        httpStatus: opts?.httpStatus ?? null,
        latencyMs: Date.now() - startedAt,
      });

    const fail = (failure: TrackedFailure): ResearchFailure => {
      void track(failure.status, { httpStatus: failure.httpStatus ?? null });
      return {
        ok: false,
        reason: failure.reason,
        message: failure.message,
        ...(failure.retryAfterSeconds !== undefined ? { retryAfterSeconds: failure.retryAfterSeconds } : {}),
      };
    };

    // 1. Short-term anonymous cache of normalized PUBLIC results.
    const cached = cacheGet(cacheKey);
    if (cached) {
      void track("ok", { cacheHit: true });
      return {
        ok: true,
        provider: "brave",
        strategy,
        strategyLabel: definition.label,
        query,
        results: cached.results,
        count: cached.results.length,
        fromCache: true,
        deduped: false,
      };
    }

    // 2. Missing key fails gracefully — never a crash, never a fake answer.
    if (!isBraveConfigured()) {
      return fail({
        status: "provider_unavailable",
        reason: "provider_unavailable",
        message:
          "Live research is not configured on this Qurtiz deployment (BRAVE_SEARCH_API_KEY). Tell the user honestly that web research is temporarily unavailable — AI Chat and the rest of the app keep working.",
      });
    }

    // 3. Per-workspace abuse protection (plan-scaled). Every caller —
    //    initiator or joiner — consumes its own workspace's window.
    const plan = await workspaceResearchPlan(request.workspaceId);
    const limits = researchPlanLimits(plan);
    const perMinute = rateLimit(`research:ws:${request.workspaceId}`, limits.perMinute, 60_000);
    if (!perMinute.allowed) {
      return fail({
        status: "rate_limited",
        reason: "rate_limited",
        message: `Too many research requests for this workspace. Try again in ${perMinute.retryAfterSeconds} seconds.`,
        retryAfterSeconds: perMinute.retryAfterSeconds,
      });
    }

    // 4. Request deduplication + live call. There is NO `await` between
    //    inflight.get() and inflight.set() on the initiator path, so a
    //    burst of concurrent identical requests can never fork the live
    //    call — exactly one Brave request leaves the process; the rest
    //    join the shared promise.
    const shared = inflight.get(cacheKey);
    const isInitiator = !shared;
    const job =
      shared ??
      (async () => {
        // Global shared-key guard (Brave plan QPS) — one slot per live call,
        // consumed only on the initiator's behalf.
        const globalQps = rateLimit("research:brave:global", braveGlobalMaxQps(), 1_000);
        if (!globalQps.allowed) {
          throw new ResearchSharedError({
            status: "rate_limited",
            reason: "rate_limited",
            message: "Research service is busy. Try again in a couple of seconds.",
            retryAfterSeconds: globalQps.retryAfterSeconds,
          });
        }
        // Monthly plan cap on LIVE calls (initiator only — joiners cost
        // the shared key nothing extra).
        const monthlyLive = await monthlyLiveSearchCount(request.workspaceId);
        if (monthlyLive >= limits.perMonthLive) {
          throw new ResearchSharedError({
            status: "plan_limit",
            reason: "plan_limit",
            message: `This workspace reached its live research allowance for the ${plan} plan this month. Cached answers may still return; live research resumes next month or on a higher plan.`,
          });
        }
        return braveWebSearch({
          query: preparedQuery,
          region,
          language,
          freshness: freshness ?? undefined,
          count,
          signal: request.signal,
        });
      })();
    if (isInitiator) {
      inflight.set(cacheKey, job);
      // The shared promise rejects for EVERY awaiter; this pre-emptive
      // catch only silences the "unhandled rejection" noise path.
      void job.catch(() => undefined);
    }

    try {
      const results = await job;
      if (isInitiator) {
        inflight.delete(cacheKey);
        const ttlSeconds = braveCacheTtlSeconds();
        if (ttlSeconds > 0 && results.length > 0) {
          cacheSet(cacheKey, { expiresAt: Date.now() + ttlSeconds * 1_000, results });
        }
      }
      void track("ok", { cacheHit: !isInitiator });
      return {
        ok: true,
        provider: "brave",
        strategy,
        strategyLabel: definition.label,
        query,
        results,
        count: results.length,
        fromCache: false,
        deduped: !isInitiator,
      };
    } catch (error) {
      if (isInitiator) inflight.delete(cacheKey);
      if (error instanceof ResearchSharedError) return fail(error.failure);
      if (error instanceof BraveSearchError) return fail(failureFromBraveError(error));
      return fail({ status: "error", reason: "error", message: "Live research failed unexpectedly. Try again shortly." });
    }
  } catch (error) {
    // Absolute last line of defense: research must never crash a request.
    console.warn("[research] unexpected failure:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "error", message: "Live research failed unexpectedly. Try again shortly." };
  }
}
