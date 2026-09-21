import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { researchUsageEvents, workspaceStorageQuotas } from "@/db/schema";

/**
 * Usage persistence + reporting for the shared Brave integration.
 *
 * Attribution model: every research request the ResearchService handles
 * is recorded against its authenticated workspace + user, even though the
 * Brave credential itself is the single shared project key. These rows
 * are the data source for analytics today and SaaS plan enforcement
 * tomorrow (Free → limited live research, etc.).
 *
 * Resilience model: usage rows are telemetry, not a gate. Recording
 * failures (including "table missing while migration 0027 is pending")
 * are logged and swallowed so research availability never depends on
 * analytics writes. Count-based plan enforcement fails OPEN for the
 * same reason.
 * reason — a broken telemetry table must not break the Research tool.
 */

export type ResearchUsageStatus =
  | "ok"
  | "provider_unavailable"
  | "rate_limited"
  | "plan_limit"
  | "quota"
  | "network_error"
  | "error";

export type ResearchUsageEventInput = {
  workspaceId: string;
  userId: string | null;
  provider?: string;
  strategy: string;
  /** The effective prepared query actually sent (or cache key's query). */
  query: string;
  queryHash: string;
  region: string | null;
  language: string | null;
  freshness: string | null;
  cacheHit: boolean;
  status: ResearchUsageStatus;
  httpStatus?: number | null;
  latencyMs: number;
};

/** Best-effort insert; never throws, never blocks the research result. */
export async function recordResearchUsage(event: ResearchUsageEventInput): Promise<void> {
  try {
    const db = getDb();
    await db.insert(researchUsageEvents).values({
      workspaceId: event.workspaceId,
      userId: event.userId,
      provider: event.provider ?? "brave",
      strategy: event.strategy,
      query: event.query.slice(0, 300),
      queryHash: event.queryHash,
      region: event.region,
      language: event.language,
      freshness: event.freshness,
      cacheHit: event.cacheHit,
      status: event.status,
      httpStatus: event.httpStatus ?? null,
      latencyMs: Math.max(0, Math.floor(event.latencyMs)),
    });
  } catch (error) {
    console.warn("[research-usage] failed to record usage event:", error instanceof Error ? error.message : error);
  }
}

/**
 * Live Brave calls this workspace consumed in the current UTC month.
 * Live = cache_hit=false AND status='ok': cache hits, dedupe joins, and
 * failed upstream calls (401/429/5xx) don't burn the plan allowance.
 * Fails open (0) when the table is unavailable.
 */
export async function monthlyLiveSearchCount(workspaceId: string): Promise<number> {
  try {
    const db = getDb();
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(researchUsageEvents)
      .where(
        and(
          eq(researchUsageEvents.workspaceId, workspaceId),
          eq(researchUsageEvents.provider, "brave"),
          eq(researchUsageEvents.cacheHit, false),
          eq(researchUsageEvents.status, "ok"),
          gte(researchUsageEvents.createdAt, monthStart),
        ),
      );
    return row?.n ?? 0;
  } catch (error) {
    console.warn("[research-usage] monthly count unavailable:", error instanceof Error ? error.message : error);
    return 0;
  }
}

/**
 * The workspace's plan tier (drives research limits). Reads the shared
 * plan column introduced with storage quotas; any read failure degrades
 * to "free" — the most conservative tier.
 */
export async function workspaceResearchPlan(workspaceId: string): Promise<string> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ plan: workspaceStorageQuotas.plan })
      .from(workspaceStorageQuotas)
      .where(eq(workspaceStorageQuotas.workspaceId, workspaceId))
      .limit(1);
    return row?.plan ?? "free";
  } catch {
    return "free";
  }
}

export type ResearchUsageSummary = {
  days: number;
  totalRequests: number;
  liveRequests: number;
  cacheHits: number;
  byStatus: Record<string, number>;
  byStrategy: Record<string, number>;
  byDay: Record<string, number>;
  uniqueUsers: number;
};

/**
 * Per-workspace usage rollup for the reporting API. Workspace-scoped
 * strictly — one workspace can never read another's attribution data.
 */
export async function researchUsageSummary(workspaceId: string, days = 30): Promise<ResearchUsageSummary> {
  const clampedDays = Math.max(1, Math.min(Math.floor(days), 90));
  const summary: ResearchUsageSummary = {
    days: clampedDays,
    totalRequests: 0,
    liveRequests: 0,
    cacheHits: 0,
    byStatus: {},
    byStrategy: {},
    byDay: {},
    uniqueUsers: 0,
  };
  const db = getDb();
  const since = new Date(Date.now() - clampedDays * 86_400_000);
  const rows = await db
    .select({
      status: researchUsageEvents.status,
      strategy: researchUsageEvents.strategy,
      cacheHit: researchUsageEvents.cacheHit,
      userId: researchUsageEvents.userId,
      createdAt: researchUsageEvents.createdAt,
    })
    .from(researchUsageEvents)
    .where(and(eq(researchUsageEvents.workspaceId, workspaceId), gte(researchUsageEvents.createdAt, since)))
    .limit(10_000);

  const users = new Set<string>();
  for (const row of rows) {
    summary.totalRequests += 1;
    if (row.cacheHit) summary.cacheHits += 1;
    else summary.liveRequests += 1;
    summary.byStatus[row.status] = (summary.byStatus[row.status] ?? 0) + 1;
    summary.byStrategy[row.strategy] = (summary.byStrategy[row.strategy] ?? 0) + 1;
    const day = row.createdAt.toISOString().slice(0, 10);
    summary.byDay[day] = (summary.byDay[day] ?? 0) + 1;
    if (row.userId) users.add(row.userId);
  }
  summary.uniqueUsers = users.size;
  return summary;
}
