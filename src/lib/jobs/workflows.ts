import { CORE_AGENT_IDENTITY } from "@/lib/ai/identity";
import { retrieveAgentMemory } from "@/lib/ai/persistent-memory";
import { boundedAgentReference } from "@/lib/ai/memory-policy";
import "server-only";

import { and, asc, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  aiInsights,
  campaigns,
  campaignItems,
  competitorSnapshots,
  competitors,
  contentItems,
  workspaces,
  notifications,
  postMetrics,
  publishingJobs,
  jobs,
} from "@/db/schema";
import { QUEUES } from "./boss";
import { syncInsightsForWorkspace } from "@/lib/analytics/sync";
import { bestPostingHours, groupPerformance, sumTotals, type MetricsRow } from "@/lib/analytics/compute";
import type { PgBoss } from "pg-boss";
import { generateAndPersistContent } from "@/lib/ai/content";
import { publishNow, reconcileBufferDeliveries, type PublishResult } from "@/lib/publishing/service";
import { resolvePublishProviderForPlatform } from "@/lib/publish/provider";
import { buildPublishedNotification, buildPublishFailedNotification, type PublishedDestination } from "@/lib/notifications/payload";

const MAX_PUBLISH_ATTEMPTS = 3;
const PUBLISH_RETRY_BACKOFF_MS = 5 * 60_000; // requeue 5 minutes out
const STUCK_PROCESSING_MS = 10 * 60_000; // a claim older than this is treated as lost
const STUCK_GENERATION_MS = 30 * 60_000;

/**
 * Attempt to publish one due publishing job. The worker's only job is to
 * claim the row, fire the job through the centralized publishing service
 * (`publishNow`), and persist the outcome — never reaching into provider
 * APIs directly. Provider-specific logic (Buffer vs Meta), refresh-on-401,
 * media handling, and idempotency all live in `lib/publishing/service.ts`.
 *
 * `attemptPublish` is the single entry point: the per-platform provider is
 * resolved inside the service via resolvePublishConnection, and the job row's
 * provider stamp is re-resolved from the ACTIVE connection at fire time.
 *
 * Exported for the hermetic worker tests — production entry is
 * publishDueScan/registerWorkers.
 */
export async function attemptPublish(publishingJobId: string): Promise<void> {
  const db = getDb();

  // Atomic claim — conditional UPDATE (status='pending') means only one
  // worker wins; a concurrent claim matches 0 rows and returns immediately.
  const [job] = await db
    .update(publishingJobs)
    .set({
      status: "processing",
      attempts: sql`${publishingJobs.attempts} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(publishingJobs.id, publishingJobId), eq(publishingJobs.status, "pending"), isNull(publishingJobs.providerPostId)))
    .returning();
  if (!job) return;

  // Notification recipient: the workspace creator, never the workspace UUID.
  const [ws] = await db
    .select({ createdBy: workspaces.createdBy })
    .from(workspaces)
    .where(eq(workspaces.id, job.workspaceId));
  const recipientId = ws?.createdBy ?? job.workspaceId;

  // Provider re-resolution at fire time: job.provider is a creation-time
  // snapshot and goes stale when the workspace reconnects under a different
  // provider (live evidence: Sept-2 rows stamped "meta" while facebook was
  // live on Buffer). publishNow routes through the ACTIVE connection
  // regardless — the stamp is updated here so the row tells the truth for
  // history/reporting. An honest failure when no connection exists stays.
  const activeProvider = await resolvePublishProviderForPlatform(job.workspaceId, job.platform);
  if (activeProvider !== job.provider) {
    await db
      .update(publishingJobs)
      .set({ provider: activeProvider, updatedAt: new Date() })
      .where(eq(publishingJobs.id, job.id));
  }

  const result = await publishNow({
    workspaceId: job.workspaceId,
    contentItemId: job.contentItemId,
    contentVariantId: job.contentVariantId,
    platform: job.platform,
    jobId: job.id,
  });

  if (result.ok) {
    await recordPublishedNotification({ job, recipientId, result });
    return;
  }

  // Failure classification: transient (network/429/5xx) requeue up to
  // MAX_PUBLISH_ATTEMPTS; everything else fails permanently.
  // Retry only a confirmed rejection. A lost response may mean the provider
  // accepted the post; replaying that mutation could publish it twice.
  const transient = result.reason === "rate_limited";
  if (transient && job.attempts < MAX_PUBLISH_ATTEMPTS) {
    await db
      .update(publishingJobs)
      .set({
        status: "pending",
        scheduledAt: new Date(Date.now() + PUBLISH_RETRY_BACKOFF_MS),
        lastError: result.message,
        updatedAt: new Date(),
      })
      .where(eq(publishingJobs.id, job.id));
    return;
  }

  await db
    .update(publishingJobs)
    .set({ status: "failed", lastError: result.message, updatedAt: new Date() })
    .where(eq(publishingJobs.id, job.id));

  // Auth-class failures deserve a distinct notification kind so the user is
  // asked to reconnect (matches the pre-refactor Buffer behavior). The
  // service surfaces a dead Buffer session as `auth_expired` — it already
  // refreshed + retried once and marked the connection expired.
  if (
    result.reason === "auth" ||
    result.reason === "auth_expired" ||
    result.reason === "decrypt_failed" ||
    result.reason === "missing_channel"
  ) {
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: recipientId,
      kind: "auth_expired",
      title: "Reconnection required",
      body: `${result.message} Reconnect the account on the Connections page.`,
      link: "/connections",
      meta: { type: "auth_expired", contentItemId: job.contentItemId, platform: job.platform as "facebook" | "instagram", publishStatus: "failed" },
    });
  } else {
    const [failedItem] = await db
      .select({ topic: contentItems.topic })
      .from(contentItems)
      .where(eq(contentItems.id, job.contentItemId))
      .limit(1);
    const failed = buildPublishFailedNotification({
      contentItemId: job.contentItemId,
      platform: job.platform as "facebook" | "instagram",
      topic: failedItem?.topic ?? undefined,
      error: result.message,
    });
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: recipientId,
      kind: failed.kind,
      title: failed.title,
      body: failed.body,
      link: failed.link,
      meta: failed.meta,
    });
  }
}

/**
 * Record the "published" notification for a successful platform job. Both the
 * Facebook and Instagram sides of one content item land on ONE consolidated
 * notification, enriched with every real platform permalink captured so far —
 * so the UI can offer "View on Facebook" / "View on Instagram" buttons that
 * open the LIVE platform post, never Content Studio. When no platform
 * returned a permalink (Buffer: none officially reliable), the notification
 * keeps the internal Content Studio link — we never fabricate URLs from IDs.
 */
async function recordPublishedNotification(args: {
  job: typeof publishingJobs.$inferSelect;
  recipientId: string;
  result: Extract<PublishResult, { ok: true }>;
}): Promise<void> {
  const db = getDb();
  const { job, recipientId, result } = args;

  const [item] = await db
    .select({ topic: contentItems.topic })
    .from(contentItems)
    .where(eq(contentItems.id, job.contentItemId))
    .limit(1);

  // Every sibling platform job that already reached "published" contributes
  // its stored permalink (flipToPublished persisted it to the job result row
  // before publishNow returned — the current job is included here).
  const publishedSiblings = await db
    .select({ platform: publishingJobs.platform, result: publishingJobs.result })
    .from(publishingJobs)
    .where(and(eq(publishingJobs.contentItemId, job.contentItemId), eq(publishingJobs.status, "published"), eq(publishingJobs.workspaceId, job.workspaceId)));

  const destinations: PublishedDestination[] = [];
  for (const row of publishedSiblings) {
    if (row.platform !== "facebook" && row.platform !== "instagram") continue;
    const result = (row.result ?? {}) as Record<string, unknown>;
    const permalink = typeof result.permalink === "string" && /^https?:\/\//i.test(result.permalink) ? result.permalink : null;
    if (!permalink || destinations.some((d) => d.platform === row.platform && d.permalink === permalink)) continue;
    destinations.push({ platform: row.platform, permalink });
  }

  const platforms = [...new Set([...publishedSiblings.map((s) => s.platform), job.platform])] as Array<"facebook" | "instagram">;

  const commentNote = result.firstCommentSkipped
    ? "Skipped (unavailable on current Buffer plan)."
    : result.comment
      ? `${result.comment.status}${
          result.comment.status === "published" && result.comment.providerCommentId
            ? ` (id ${result.comment.providerCommentId})`
            : result.comment.error
              ? ` - ${result.comment.error}`
              : ""
        }.`
      : null;

  const note = buildPublishedNotification({
    contentItemId: job.contentItemId,
    topic: item?.topic ?? "Post",
    publishedPlatforms: platforms,
    destinations,
    pendingDelivery: result.pendingDelivery === true,
    commentNote,
  });

  // One notification per content item — a second platform publishing updates
  // (and resurfaces) the existing row instead of spamming a duplicate.
  const [existing] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, job.workspaceId),
        eq(notifications.kind, "publishing_completed"),
        sql`${notifications.meta}->>'contentItemId' = ${job.contentItemId}`,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1);

  if (existing) {
    await db
      .update(notifications)
      .set({
        title: note.title,
        body: note.body,
        link: note.link,
        meta: note.meta,
        // Resurface as unread — the post just gained a new live destination.
        read: false,
      })
      .where(eq(notifications.id, existing.id));
  } else {
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: recipientId,
      kind: note.kind,
      title: note.title,
      body: note.body,
      link: note.link,
      meta: note.meta,
    });
  }
}

/** Recover publish jobs stuck in "processing" (a worker died mid-publish):
 *  requeue them while attempts remain, otherwise fail them permanently. */
export async function recoverStuckPublishJobs(): Promise<void> {
  const db = getDb();
  const stale = await db
    .select({ id: publishingJobs.id, attempts: publishingJobs.attempts, workspaceId: publishingJobs.workspaceId, contentItemId: publishingJobs.contentItemId, platform: publishingJobs.platform })
    .from(publishingJobs)
    .where(
      and(
        eq(publishingJobs.status, "processing"),
        isNull(publishingJobs.providerPostId),
        lte(publishingJobs.updatedAt, new Date(Date.now() - STUCK_PROCESSING_MS)),
      ),
    )
    .limit(10);
  for (const job of stale) {
    {
      const reason = "The worker stopped before delivery was confirmed. Check the connected account before retrying to avoid a duplicate post.";
      await db
        .update(publishingJobs)
        .set({ status: "failed", lastError: reason,
          result: sql`coalesce(${publishingJobs.result}, '{}'::jsonb) || '{"reconciliationRequired":true}'::jsonb`, updatedAt: new Date() })
        .where(and(eq(publishingJobs.id, job.id), eq(publishingJobs.status, "processing"), isNull(publishingJobs.providerPostId),
          lte(publishingJobs.updatedAt, new Date(Date.now() - STUCK_PROCESSING_MS))));
      const [ws] = await db
        .select({ createdBy: workspaces.createdBy })
        .from(workspaces)
        .where(eq(workspaces.id, job.workspaceId));
      await db.insert(notifications).values({
        workspaceId: job.workspaceId,
        userId: ws?.createdBy ?? job.workspaceId,
        kind: "publishing_failed",
        title: "Publishing failed",
        body: reason,
        link: "/content-studio",
        meta: { type: "publish_failed", contentItemId: job.contentItemId, platform: job.platform as "facebook" | "instagram", publishStatus: "failed" },
      });
    }
  }
}

/** Scan for due publishing jobs (runs every minute via pg-boss cron or vercel cron).
 *  All providers (Meta + Buffer) now route through the unified `attemptPublish`
 *  entry — the per-provider adapter lives inside the publishing service. */
export async function publishDueScan(): Promise<void> {
  const db = getDb();
  await reconcileBufferDeliveries();
  await recoverStuckPublishJobs();
  await recoverStuckGenerationJobs();
  const due = await db
    .select({ id: publishingJobs.id })
    .from(publishingJobs)
    .where(and(eq(publishingJobs.status, "pending"), lte(publishingJobs.scheduledAt, new Date())))
    .limit(10);
  for (const j of due) {
    await attemptPublish(j.id);
  }
}

/** Long AI jobs must reach a terminal state after a worker/process loss. We do
 * not automatically replay them because the last AI call may have persisted a
 * content item before the process stopped. The UI retry creates only the
 * remaining count and therefore cannot silently duplicate a full plan. */
export async function recoverStuckGenerationJobs(): Promise<void> {
  const db = getDb();
  const cutoff = new Date(Date.now() - STUCK_GENERATION_MS);
  const stale = await db.select().from(jobs).where(and(
    inArray(jobs.type, ["bulk_plan", "campaign"]),
    eq(jobs.status, "running"),
    lte(jobs.updatedAt, cutoff),
  )).limit(20);
  for (const job of stale) {
    const prior = (job.result ?? {}) as Record<string, unknown>;
    const message = "The background worker stopped before this job completed. Review the saved results, then retry the remaining items.";
    const [recovered] = await db.update(jobs).set({ status: "failed", error: message,
      result: { ...prior, stage: "Failed", recoveryRequired: true }, updatedAt: new Date() })
      .where(and(eq(jobs.id, job.id), eq(jobs.status, "running"), lte(jobs.updatedAt, cutoff)))
      .returning({ id: jobs.id });
    if (!recovered) continue;

    if (job.type === "campaign") {
      const campaignId = (job.input as { campaignId?: unknown } | null)?.campaignId;
      if (typeof campaignId === "string") {
        await db.update(campaigns).set({ status: "cancelled", updatedAt: new Date() })
          .where(and(eq(campaigns.id, campaignId), eq(campaigns.workspaceId, job.workspaceId), eq(campaigns.status, "generating")));
      }
    }
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: job.userId,
      kind: "system",
      title: job.type === "campaign" ? "Campaign generation stopped" : "Bulk generation stopped",
      body: message,
      link: job.type === "campaign" ? "/campaigns" : "/bulk-creation",
    });
  }
}

/**
 * Bulk content plan: delegates to the staged pipeline in lib/jobs/bulk.ts.
 */
export async function bulkGenerate(jobId: string): Promise<void> {
  const { runBulkPlan } = await import("@/lib/jobs/bulk");
  await runBulkPlan(jobId);
}

/**
 * Campaign generation: produce content for each day of the arc.
 */
export async function generateCampaign(campaignId: string): Promise<void> {
  const db = getDb();
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campaign) return;
  if (campaign.status !== "generating") {
    // The worker ran after the campaign left "generating" (e.g. the user
    // cancelled it). Finalize the app job row so it never sits in "queued"
    // forever — but never downgrade an already-terminal row.
    if (campaign.jobId) {
      const [jobRow] = await db.select({ status: jobs.status }).from(jobs).where(eq(jobs.id, campaign.jobId));
      if (jobRow && jobRow.status === "queued") {
        await db
          .update(jobs)
          .set({
            status: "cancelled",
            error: `Campaign was ${campaign.status} when the worker ran — no content was generated.`,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, campaign.jobId));
      }
    }
    return;
  }

  if (!campaign.jobId) throw new Error("Campaign has no durable job record.");
  const [claimed] = await db.update(jobs).set({ status: "running", updatedAt: new Date() })
    .where(and(eq(jobs.id, campaign.jobId), eq(jobs.workspaceId, campaign.workspaceId), eq(jobs.status, "queued"))).returning();
  if (!claimed) return;

  const days = await db
    .select()
    .from(campaignItems)
    .where(eq(campaignItems.campaignId, campaignId));
  const pending = days.filter((d) => !d.contentItemId).sort((a, b) => a.dayIndex - b.dayIndex);

  const platforms = (campaign.platforms ?? ["facebook", "instagram"]) as ("facebook" | "instagram")[];

  // Honest accounting: count real successes, not attempts. The run/job row is
  // updated so the UI shows real progress and a truthful terminal state.
  let generated = days.length - pending.length;
  let failed = 0;
  if (campaign.jobId) {
    await db.update(jobs).set({ progress: generated, updatedAt: new Date() }).where(eq(jobs.id, campaign.jobId));
  }

  for (const day of pending) {
    const [current] = await db.select({ status: campaigns.status }).from(campaigns).where(eq(campaigns.id, campaignId));
    if (!current || current.status !== "generating") {
      await db.update(jobs).set({ status: "cancelled", progress: generated, result: { generated, failed }, updatedAt: new Date() })
        .where(eq(jobs.id, campaign.jobId));
      return;
    }
    try {
      const { itemId } = await generateAndPersistContent({
        workspaceId: campaign.workspaceId,
        userId: campaign.createdBy ?? campaign.workspaceId,
        input: {
          topic: "Campaign \"" + campaign.name + "\" - Day " + day.dayIndex + ": " + day.theme + (campaign.offer ? " (offer: " + campaign.offer + ")" : ""),
          objective: "Campaign day " + day.dayIndex + "/" + campaign.durationDays + ": " + day.theme,
          platforms,
          preferredFormat: null,
        },
      });
      await db.update(campaignItems).set({ contentItemId: itemId }).where(eq(campaignItems.id, day.id));
      generated++;
      if (campaign.jobId) {
        await db.update(jobs).set({ progress: generated, updatedAt: new Date() }).where(eq(jobs.id, campaign.jobId));
      }
    } catch (e) {
      failed++;
      console.error("[campaign] day failed", e instanceof Error ? e.message : e);
    }
  }

  if (generated === 0) {
    // Nothing was created — never claim an active campaign. The campaign enum
    // has no "failed" state, so "cancelled" is the honest terminal state; the
    // job row carries the failure and the notification explains it.
    const reason = `All ${failed} campaign day${failed === 1 ? "" : "s"} failed to generate. No content was created.`;
    if (campaign.jobId) {
      await db.update(jobs).set({ status: "failed", error: reason, updatedAt: new Date() }).where(eq(jobs.id, campaign.jobId));
    }
    await db.update(campaigns).set({ status: "cancelled", updatedAt: new Date() }).where(eq(campaigns.id, campaignId));
    await db.insert(notifications).values({
      workspaceId: campaign.workspaceId,
      userId: campaign.createdBy ?? campaign.workspaceId,
      kind: "job_completed",
      title: "Campaign generation failed",
      body: reason,
      link: "/campaigns",
    });
    return;
  }

  const [currentCampaign] = await db.select({ status: campaigns.status }).from(campaigns).where(eq(campaigns.id, campaignId));
  if (!currentCampaign || currentCampaign.status !== "generating") {
    await db.update(jobs).set({ status: "cancelled", progress: generated, result: { generated, failed }, updatedAt: new Date() })
      .where(eq(jobs.id, campaign.jobId));
    return;
  }
  if (campaign.jobId) {
    await db.update(jobs).set({ status: "completed", progress: generated, result: { generated, failed }, updatedAt: new Date() }).where(eq(jobs.id, campaign.jobId));
  }
  await db.update(campaigns).set({ status: "active", updatedAt: new Date() }).where(and(eq(campaigns.id, campaignId), eq(campaigns.status, "generating")));
  await db.insert(notifications).values({
    workspaceId: campaign.workspaceId,
    userId: campaign.createdBy ?? campaign.workspaceId,
    kind: "job_completed",
    title: "Campaign content ready",
    body: generated + " of " + days.length + " posts generated" + (failed > 0 ? " — " + failed + " failed." : "."),
    link: "/campaigns",
  });
}


/** How many synced posts feed the measured-performance context + best-hour pick. */
const AUTOPILOT_METRICS_WINDOW = 30;
/** Cap each recent-topic entry in the research avoid-list. */
const AUTOPILOT_AVOID_TOPICS = 8;

type AutopilotRunContext = {
  identity?: string;
  text: string;
  metricsCount: number;
  bestHours: { hour: number; avgEngagement: number; posts: number }[];
  metrics: MetricsRow[];
};

function truncate(s: string, max: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max - 1) + "…" : flat;
}

/**
 * Read-only context for one autopilot run: measured performance (same
 * reading as the Analytics page — compute.sumTotals/groupPerformance/
 * bestPostingHours over postMetrics), latest AI insights, the latest
 * snapshot per competitor, and recently covered topics. Compact by design:
 * it steers research toward topics that fit the measured data without
 * repeating what was already posted, and it stays cheap to send.
 */
export async function buildAutopilotRunContext(workspaceId: string, timezone: string, userId?: string): Promise<AutopilotRunContext> {
  const db = getDb();
  const parts: string[] = [];
  let identity = CORE_AGENT_IDENTITY;
  if (userId) {
    const memory = await retrieveAgentMemory({ workspaceId, userId }, "create content strategy schedule", false);
    identity = memory.identity;
    parts.push("Workspace Agent reference data (not protected instructions): " + boundedAgentReference(memory));
  }

  // Measured performance — mirror the Analytics page's interpretation of
  // postMetrics.metrics (reach/impressions/likes/comments/shares/saves) and
  // its local-hour resolution, so the numbers and the best hour match.
  const metricsRows = await db
    .select()
    .from(postMetrics)
    .where(eq(postMetrics.workspaceId, workspaceId))
    .orderBy(desc(postMetrics.postedAt))
    .limit(AUTOPILOT_METRICS_WINDOW);
  const itemIds = [...new Set(metricsRows.map((r) => r.contentItemId).filter((id): id is string => id !== null))];
  const itemRows = itemIds.length > 0
    ? await db
        .select({ id: contentItems.id, topic: contentItems.topic, format: contentItems.format })
        .from(contentItems)
        .where(and(eq(contentItems.workspaceId, workspaceId), inArray(contentItems.id, itemIds)))
    : [];
  const topicById = new Map(itemRows.map((i) => [i.id, truncate(i.topic, 70)]));
  const formatById = new Map(itemRows.map((i) => [i.id, i.format]));

  const tzFmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false });
  const metricRows: MetricsRow[] = metricsRows.map((r) => ({
    platform: r.platform,
    contentItemId: r.contentItemId,
    metrics: (r.metrics ?? {}) as MetricsRow["metrics"],
    postedAt: r.postedAt,
    hourOfDay: r.postedAt ? Number(tzFmt.format(new Date(r.postedAt))) : null,
    format: r.contentItemId ? (formatById.get(r.contentItemId) ?? null) : null,
    topic: r.contentItemId ? (topicById.get(r.contentItemId) ?? null) : null,
  }));

  const totals = sumTotals(metricRows);
  if (totals.posts > 0) {
    const lines = [
      `Measured performance (${totals.posts} synced posts, ${timezone}): reach ${totals.reach}, ${totals.engagement} engagements, ER ${totals.engagementRate}%.`,
    ];
    const byPlatform = groupPerformance(metricRows, (r) => r.platform);
    if (byPlatform.length > 0) {
      lines.push(
        "Per platform: " +
          byPlatform
            .map((g) => `${g.key}: ${g.totals.posts} posts, ${g.totals.engagement} engagements`)
            .join("; ") +
          ".",
      );
    }
    const byFormat = groupPerformance(metricRows, (r) => r.format ?? "unknown").filter((g) => g.key !== "unknown");
    if (byFormat.length > 0) {
      lines.push(
        "Best formats: " +
          byFormat
            .slice(0, 3)
            .map((g) => `${g.key}: ${g.totals.engagement} engagements over ${g.totals.posts} posts`)
            .join("; ") +
          ".",
      );
    }
    const byTopic = groupPerformance(metricRows, (r) => r.topic ?? "unknown").filter((g) => g.key !== "unknown");
    if (byTopic.length > 0) {
      lines.push(
        "Best topics: " +
          byTopic
            .slice(0, 3)
            .map((g) => `"${g.key}": ${g.totals.engagement} engagements`)
            .join("; ") +
          ".",
      );
    }
    parts.push(lines.join("\n"));
  } else {
    parts.push("No synced post metrics yet — no measured performance data.");
  }

  const hours = bestPostingHours(metricRows);
  const calendar = await db.select({ platform: publishingJobs.platform, scheduledAt: publishingJobs.scheduledAt }).from(publishingJobs)
    .where(and(eq(publishingJobs.workspaceId, workspaceId), inArray(publishingJobs.status, ["pending", "processing"]), sql`${publishingJobs.scheduledAt} >= now()`))
    .orderBy(asc(publishingJobs.scheduledAt)).limit(30);
  parts.push(calendar.length ? "Existing Calendar (avoid overlaps; times UTC): " + calendar.map(j => `${j.platform} ${new Date(j.scheduledAt).toISOString()}`).join("; ") : "No upcoming Calendar publishing jobs.");
  if (hours.length > 0) {
    // %24: the analytics hour reading can emit "24" for a local midnight.
    parts.push(
      "Best hours (local): " +
        hours
          .slice(0, 3)
          .map((h) => `${String(h.hour % 24).padStart(2, "0")}:00 (avg ${h.avgEngagement} engagements/post)`)
          .join("; ") +
        ".",
    );
  }

  const insights = await db
    .select({ kind: aiInsights.kind, content: aiInsights.content })
    .from(aiInsights)
    .where(eq(aiInsights.workspaceId, workspaceId))
    .orderBy(desc(aiInsights.createdAt))
    .limit(5);
  if (insights.length > 0) {
    parts.push(
      "Latest AI insights:\n" + insights.map((i) => `- [${i.kind}] ${truncate(i.content, 300)}`).join("\n"),
    );
  }

  // Latest snapshot per competitor (followers, avg engagement, analysis,
  // top recent captions) — the competitor check side of the run.
  const comps = await db
    .select({ id: competitors.id, name: competitors.name, handle: competitors.handle })
    .from(competitors)
    .where(eq(competitors.workspaceId, workspaceId))
    .orderBy(asc(competitors.name));
  if (comps.length > 0) {
    const snaps = await db
      .select()
      .from(competitorSnapshots)
      .where(eq(competitorSnapshots.workspaceId, workspaceId))
      .orderBy(desc(competitorSnapshots.capturedAt))
      .limit(200);
    const latestByComp = new Map<string, (typeof snaps)[number]>();
    for (const s of snaps) {
      if (!latestByComp.has(s.competitorId)) latestByComp.set(s.competitorId, s);
    }
    const lines: string[] = [];
    for (const c of comps) {
      const s = latestByComp.get(c.id);
      if (!s) {
        lines.push(`- ${c.name} (@${c.handle}): no competitor snapshot yet.`);
        continue;
      }
      const recent = (Array.isArray(s.recentPosts) ? s.recentPosts : []) as { caption?: string; likes?: number; comments?: number }[];
      const top3 = [...recent]
        .sort((a, b) => (b.likes ?? 0) + (b.comments ?? 0) - ((a.likes ?? 0) + (a.comments ?? 0)))
        .slice(0, 3)
        .map((p) => truncate(p.caption ?? "", 90));
      const analysis = s.analysis ? truncate(s.analysis, 240) : "no AI analysis yet";
      lines.push(
        `- ${c.name} (@${c.handle}): ${s.followers ?? "?"} followers, avg engagement ${s.avgEngagement ?? "?"} per recent post. Analysis: ${analysis}` +
          (top3.length > 0 ? ` Recent posts: ${top3.map((t) => `"${t}"`).join(" | ")}` : ""),
      );
    }
    parts.push("Competitor check:\n" + lines.join("\n"));
  }

  // Recently covered topics — research must not repeat these.
  const recentItems = await db
    .select({ topic: contentItems.topic })
    .from(contentItems)
    .where(
      and(
        eq(contentItems.workspaceId, workspaceId),
        inArray(contentItems.status, ["published", "scheduled"] as ("published" | "scheduled")[]),
      ),
    )
    .orderBy(desc(contentItems.createdAt))
    .limit(10);
  const covered = new Set<string>();
  for (const t of topicById.values()) covered.add(t);
  for (const i of recentItems) {
    if (i.topic) covered.add(truncate(i.topic, 120));
    if (covered.size >= AUTOPILOT_AVOID_TOPICS * 2) break;
  }
  const coveredList = [...covered].slice(0, AUTOPILOT_AVOID_TOPICS);
  if (coveredList.length > 0) {
    parts.push("Recently covered topics — do NOT choose these again:\n" + coveredList.map((t) => `- ${t}`).join("\n"));
  }

  let text = parts.join("\n\n");
  if (text.length > 4500) text = text.slice(0, 4499) + "\n…(context truncated)";
  return { identity, text, metricsCount: metricRows.length, bestHours: hours, metrics: metricRows };
}

/** Scan durable Auto Run occurrences; AI executes in the existing pg-boss worker. */
export async function autopilotLoop(): Promise<void> {
  const { scanAutoRuns } = await import("@/lib/autopilot/run");
  await scanAutoRuns();
}

/** Register all workers. Called once at server start. */
export async function registerWorkers(boss: PgBoss): Promise<void> {
  await boss.work(QUEUES.publishScan, async () => {
    await publishDueScan();
  });
  await boss.work(QUEUES.chatRunSweep, async () => {
    // Recover chat-kind agent_runs that are stuck in `running` (server
    // restart, dropped SSE, dead worker). The route's onFinish/onAbort
    // never ran for those — without this sweep the DB would carry
    // phantom "running" rows forever.
    const { recoverStaleChatRuns } = await import("@/lib/ai/chat-persistence");
    const recovered = await recoverStaleChatRuns();
    if (recovered > 0) {
      console.log(`[chat-run-sweep] recovered ${recovered} stale chat run(s)`);
    }
  });
  await boss.work(QUEUES.bulkGenerate, async () => {
    // Payload-independent: process every queued bulk_plan row (oldest first).
    // This survives any handler-payload shape differences across pg-boss versions.
    const db = getDb();
    const queued = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.type, "bulk_plan"), eq(jobs.status, "queued")))
      .orderBy(asc(jobs.createdAt))
      .limit(5);
    for (const row of queued) {
      await bulkGenerate(row.id);
    }
  });
  await boss.work<{ campaignId?: string; jobId?: string }>(QUEUES.campaignGenerate, async (batch) => {
    for (const job of batch) {
      if (!job.data.campaignId) throw new Error("Campaign job is missing campaignId");
      try {
        await generateCampaign(job.data.campaignId);
      } catch (error) {
        if (job.data.jobId) {
          await getDb().update(jobs).set({ status: "queued", error: error instanceof Error ? error.message : "Campaign worker failed",
            updatedAt: new Date() }).where(and(eq(jobs.id, job.data.jobId), eq(jobs.status, "running")));
        }
        throw error;
      }
    }
  });
  await boss.work(QUEUES.syncInsights, async () => {
    // The cron schedule passes workspace scoping by iterating all connected
    // workspaces via platform_connections (service-style scan).
    const { getDb } = await import("@/db");
    const { platformConnections } = await import("@/db/schema");
    const db = getDb();
    const conns = await db
      .selectDistinct({ workspaceId: platformConnections.workspaceId })
      .from(platformConnections)
      .where(eq(platformConnections.status, "connected"));
    for (const row of conns) {
      try {
        const result = await syncInsightsForWorkspace(row.workspaceId);
        if (result.errors.length > 0) {
          console.error(`[sync-insights] workspace ${row.workspaceId}: ${result.synced} synced, ${result.errors.length} failed — ${result.errors.slice(0, 3).join("; ")}`);
        } else if (result.synced > 0) {
          console.log(`[sync-insights] workspace ${row.workspaceId}: ${result.synced} post(s) synced`);
        }
      } catch (e) {
        console.error("[sync-insights]", e instanceof Error ? e.message : e);
      }
    }
  });
  await boss.work(QUEUES.autopilotLoop, async () => {
    await autopilotLoop();
  });
  await boss.work(QUEUES.mediaCleanup, async () => {
    const { mediaCleanupTick } = await import("@/lib/media/cleanup-worker");
    await mediaCleanupTick();
  });
  await boss.work<{ jobId: string }>(QUEUES.autopilotRun, async batch => {
    const { executeAutoRun } = await import("@/lib/autopilot/run");
    for (const job of batch) await executeAutoRun(job.data.jobId);
  });
  console.log("[qurtiz] workers registered");
}
