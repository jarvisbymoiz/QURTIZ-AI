import "server-only";

import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";

export type ContentQuotaPeriod = "day" | "month" | "lifetime";
export type ContentQuota = {
  type: "content_creation";
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAt: string | null;
  period: ContentQuotaPeriod;
  source: "workspace_settings" | "default_unlimited";
  plan: string | null;
};

type QueryExecutor = (query: SQL) => Promise<{ rows: Record<string, unknown>[] }>;

export class ContentQuotaExceededError extends Error {
  readonly quota: ContentQuota;
  constructor(quota: ContentQuota) {
    super(`Qurtiz content-creation limit reached: ${quota.used}/${quota.limit} posts used${quota.resetAt ? `; resets ${quota.resetAt}` : ""}.`);
    this.name = "ContentQuotaExceededError";
    this.quota = quota;
  }
}

/** Missing configuration means unlimited; only an explicit numeric limit can block creation. */
export function parseContentEntitlement(value: unknown): { limit: number | null; period: ContentQuotaPeriod } {
  if (value == null) return { limit: null, period: "month" };
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid content entitlement configuration.");
  const config = value as Record<string, unknown>;
  const period = config.period ?? "month";
  if (period !== "day" && period !== "month" && period !== "lifetime") throw new Error("Invalid content entitlement period.");
  const rawLimit = config.limit;
  if (rawLimit == null) return { limit: null, period };
  if (typeof rawLimit !== "number" || !Number.isSafeInteger(rawLimit) || rawLimit < 0) {
    throw new Error("Invalid content entitlement limit.");
  }
  return { limit: rawLimit, period };
}

export function quotaWindow(period: ContentQuotaPeriod, now: Date): { start: Date | null; resetAt: string | null } {
  if (period === "lifetime") return { start: null, resetAt: null };
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  const start = period === "day" ? new Date(Date.UTC(year, month, day)) : new Date(Date.UTC(year, month, 1));
  const reset = period === "day" ? new Date(Date.UTC(year, month, day + 1)) : new Date(Date.UTC(year, month + 1, 1));
  return { start, resetAt: reset.toISOString() };
}

export async function readContentQuota(workspaceId: string, execute: QueryExecutor = query => getDb().execute(query) as Promise<{ rows: Record<string, unknown>[] }>, now = new Date()): Promise<ContentQuota> {
  const configResult = await execute(sql`
    select (select value from settings where workspace_id = ${workspaceId} and key = 'content_creation_entitlement') as entitlement,
           (select plan from workspace_storage_quotas where workspace_id = ${workspaceId}) as plan
  `);
  const configured = configResult.rows[0]?.entitlement;
  const { limit, period } = parseContentEntitlement(configured);
  const { start, resetAt } = quotaWindow(period, now);
  const count = await execute(start
    ? sql`select count(*)::int as used from content_items where workspace_id = ${workspaceId} and created_at >= ${start}`
    : sql`select count(*)::int as used from content_items where workspace_id = ${workspaceId}`);
  const used = Number(count.rows[0]?.used ?? 0);
  return {
    type: "content_creation", limit, used, remaining: limit === null ? null : Math.max(0, limit - used),
    resetAt: limit === null ? null : resetAt, period,
    source: configured == null ? "default_unlimited" : "workspace_settings",
    plan: typeof configResult.rows[0]?.plan === "string" ? configResult.rows[0].plan : null,
  };
}

export async function assertContentCreationAllowed(workspaceId: string, execute?: QueryExecutor): Promise<ContentQuota> {
  const quota = await readContentQuota(workspaceId, execute);
  if (quota.limit !== null && quota.used >= quota.limit) throw new ContentQuotaExceededError(quota);
  return quota;
}
