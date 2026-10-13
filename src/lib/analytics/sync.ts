import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { platformConnections, postMetrics, publishingJobs, settings } from "@/db/schema";
import { decryptToken } from "@/lib/crypto/tokens";
import { fetchInsightMetrics, listInsightPosts, permalinkKey, InsightsError, type RemotePost, type SyncReason } from "./meta-insights";

export type SyncResult = { checked: number; synced: number; skipped: number; failed: number; warnings: Partial<Record<SyncReason, number>>; errors: string[]; remaining: number; busy?: boolean; nextDue?: number };
type Candidate = { platform: "facebook" | "instagram"; connectionId?: string; post: RemotePost; contentItemId: string | null; reason?: SyncReason };
type State = { owner?: string; leaseUntil: number; nextDue: number; index: number; candidates: Candidate[]; summary: SyncResult; retries: number; startedAt?: number; completedAt?: number; retryable?: boolean };
const KEY = "analytics_sync_v2";
const FOUR_HOURS = 4 * 60 * 60 * 1000;
const empty = (): SyncResult => ({ checked: 0, synced: 0, skipped: 0, failed: 0, warnings: {}, errors: [], remaining: 0 });
function warn(result: SyncResult, reason: SyncReason, workspaceId: string, platform?: string, postId?: string) {
  result.warnings[reason] = (result.warnings[reason] ?? 0) + 1;
  // Identifiers and typed reasons only. No Graph response, tokens or request URLs.
  console.warn("[analytics-sync]", { workspaceId, platform, postId, reason });
  if (result.errors.length < 50) result.errors.push(`${platform ?? "workspace"} ${postId ?? ""}: ${reason}`);
}

/** Manual and unattended sync share the same persisted checkpoints and atomic lease. */
export async function syncInsightsForWorkspace(workspaceId: string, options: { automatic?: boolean; limit?: number; budgetMs?: number } = {}): Promise<SyncResult> {
  const db = getDb();
  const owner = randomUUID(), now = Date.now();
  const initial: State = { owner, leaseUntil: now + 300000, nextDue: 0, index: 0, candidates: [], summary: empty(), retries: 0 };
  const claimed = await db.execute(sql`insert into settings (workspace_id,key,value,updated_at)
    values (${workspaceId},${KEY},${JSON.stringify(initial)}::jsonb,now())
    on conflict (workspace_id,key) do update set value = settings.value || jsonb_build_object('owner',${owner}::text,'leaseUntil',${now + 300000}::bigint), updated_at=now()
    where coalesce((settings.value->>'leaseUntil')::bigint,0) < ${now}
      and (${!options.automatic} or coalesce((settings.value->>'nextDue')::bigint,0) <= ${now}) returning value`);
  const state = claimed.rows[0]?.value as State | undefined;
  if (!state) return { ...empty(), busy: true };
  const persist = async () => {
    const saved = await db.update(settings).set({ value: state, updatedAt: new Date() }).where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, KEY), sql`${settings.value}->>'owner' = ${owner}`)).returning({ key: settings.key });
    if (!saved.length) throw new Error("analytics_sync_lease_lost");
  };
  try {
    const connections = await db.select().from(platformConnections).where(and(eq(platformConnections.workspaceId, workspaceId), eq(platformConnections.status, "connected")));
    const metas = connections.filter(c => c.provider === "meta");
    const tokens = new Map<string, string>();
    const blocked = new Map<string, InsightsError>();
    for (const conn of metas) { try { const token = conn.encryptedToken ? decryptToken(conn.encryptedToken) : null; if (token) tokens.set(conn.id, token); } catch { /* Report per post below; never log ciphertext. */ } }
    if (!state.candidates.length || state.index >= state.candidates.length) {
      state.candidates = []; state.index = 0; state.summary = empty(); state.startedAt = now;
      const jobs = await db.select().from(publishingJobs).where(and(eq(publishingJobs.workspaceId, workspaceId), eq(publishingJobs.status, "published")));
      const linkedJobs = new Set<string>(), seen = new Set<string>();
      const connectionErrors = new Map<string, SyncReason>();
      state.retryable = false;
      for (const conn of metas) {
        const meta = (conn.meta ?? {}) as Record<string, unknown>;
        const account = conn.platform === "facebook" ? meta.pageId : meta.igUserId;
        const token = tokens.get(conn.id);
        if (!token || typeof account !== "string" || !/^\d+$/.test(account)) { const reason = token ? "account_mismatch" : "token_expired"; connectionErrors.set(conn.platform, reason); warn(state.summary, reason, workspaceId, conn.platform); continue; }
        let remote: RemotePost[];
        try { remote = await listInsightPosts(conn.platform, account, token); }
        catch (error) { const reason = error instanceof InsightsError ? error.reason : "provider_error"; connectionErrors.set(conn.platform, reason); if (error instanceof InsightsError && error.transient) state.retryable = true; warn(state.summary, reason, workspaceId, conn.platform); continue; }
        for (const post of remote) {
          const key = `${conn.platform}:${post.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const matches = jobs.filter(job => {
            if (job.platform !== conn.platform) return false;
            const result = (job.result ?? {}) as Record<string, unknown>;
            // Buffer update IDs are not Meta platform IDs. Never send them to Graph.
            const id = typeof result.postId === "string" ? result.postId : job.provider === "meta" ? job.providerPostId : null;
            const matchingId = (id && post.mediaIds?.includes(id)) || id === post.id || (conn.platform === "facebook" && id && `${account}_${id}` === post.id);
            const link = permalinkKey(result.permalink ?? result.url);
            return Boolean(matchingId || (link && [post.permalink, ...(post.mediaPermalinks ?? [])].some(value => link === permalinkKey(value))));
          });
          for (const match of matches) linkedJobs.add(match.id);
          state.candidates.push({ platform: conn.platform, connectionId: conn.id, post, contentItemId: matches[0]?.contentItemId ?? null });
        }
      }
      // Keep unmappable historical deliveries visible; they cannot abort valid account posts.
      for (const job of jobs) {
        if (linkedJobs.has(job.id)) continue;
        const result = (job.result ?? {}) as Record<string, unknown>;
        const id = typeof result.postId === "string" ? result.postId : job.provider === "meta" ? job.providerPostId : null;
        const hasMeta = metas.some(c => c.platform === job.platform);
        const reason: SyncReason = connectionErrors.get(job.platform) ?? (!hasMeta || (job.provider === "buffer" && !id) ? "provider_not_supported" : !id ? "missing_external_id" : "post_not_found");
        state.candidates.push({ platform: job.platform, post: { id: id ?? job.id }, contentItemId: job.contentItemId, reason });
      }
      state.summary.remaining = state.candidates.length;
      await persist();
    }
    let processed = 0;
    while (state.index < state.candidates.length && processed < (options.limit ?? 250) && Date.now() - now < (options.budgetMs ?? 210000)) {
      const candidate = state.candidates[state.index];
      state.summary.checked++; processed++;
      if (candidate.reason) { if (["token_expired", "permission_missing", "rate_limited", "network_error", "provider_error", "account_mismatch"].includes(candidate.reason)) state.summary.failed++; else state.summary.skipped++; warn(state.summary, candidate.reason, workspaceId, candidate.platform, candidate.post.id); }
      else {
        try {
          const blockedError = blocked.get(candidate.connectionId ?? "");
          if (blockedError) throw blockedError;
          const token = tokens.get(candidate.connectionId ?? "");
          if (!token) throw new InsightsError("token_expired");
          const result = await fetchInsightMetrics(candidate.platform, candidate.post, token);
          const date = candidate.post.created_time ?? candidate.post.timestamp;
          const postedAt = date && Number.isFinite(Date.parse(date)) ? new Date(date) : null;
          await db.insert(postMetrics).values({ workspaceId, platform: candidate.platform, contentItemId: candidate.contentItemId, externalPostId: candidate.post.id, metrics: result.metrics, postedAt })
            .onConflictDoUpdate({ target: [postMetrics.workspaceId, postMetrics.platform, postMetrics.externalPostId],
              set: { metrics: sql`coalesce(${postMetrics.metrics}, '{}'::jsonb) || ${JSON.stringify(result.metrics)}::jsonb`, postedAt, collectedAt: new Date(), contentItemId: candidate.contentItemId } });
          state.summary.synced++;
          for (const reason of result.warnings) warn(state.summary, reason, workspaceId, candidate.platform, candidate.post.id);
        } catch (error) { if (!(error instanceof InsightsError)) throw error; if (error.transient) state.retryable = true; if (["token_expired", "permission_missing", "rate_limited"].includes(error.reason)) blocked.set(candidate.connectionId ?? "", error); state.summary.failed++; warn(state.summary, error.reason, workspaceId, candidate.platform, candidate.post.id); }
      }
      state.index++;
      state.summary.remaining = state.candidates.length - state.index;
      // A crash repeats at most this post; the unique upsert prevents duplicate data.
      await persist();
    }
    state.leaseUntil = 0;
    if (!state.summary.remaining) {
      const transient = Boolean(state.retryable);
      state.retries = transient ? state.retries + 1 : 0;
      state.nextDue = Date.now() + (transient && state.retries <= 3 ? 300000 * 2 ** (state.retries - 1) : FOUR_HOURS);
      state.completedAt = Date.now();
    } else state.nextDue = Date.now();
    state.summary.nextDue = state.nextDue;
    await persist();
    return state.summary;
  } catch (error) {
    state.leaseUntil = 0; state.nextDue = Date.now() + 300000;
    await persist();
    // Provider requests already return typed failures; database/configuration errors remain visible.
    throw error;
  }
}
export async function syncDueInsights(): Promise<SyncResult[]> {
  const db = getDb();
  const connections = await db.selectDistinct({ workspaceId: platformConnections.workspaceId }).from(platformConnections).where(eq(platformConnections.status, "connected"));
  const results: SyncResult[] = [], started = Date.now();
  for (const row of connections) {
    if (Date.now() - started > 180000) break;
    // Use the available serverless budget; larger accounts still checkpoint
    // and continue on the next wake rather than imposing 30-post-only cycles.
    results.push(await syncInsightsForWorkspace(row.workspaceId, { automatic: true, limit: 250, budgetMs: Math.max(1000, 180000 - (Date.now() - started)) }));
  }
  return results;
}
