import "server-only";

import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  aiInsights,
  campaigns,
  campaignItems,
  competitorSnapshots,
  competitors,
  contentItems,
  contentVariants,
  workspaces,
  notifications,
  postMetrics,
  publishingJobs,
  researchItems,
  jobs,
  settings,
} from "@/db/schema";
import { QUEUES } from "./boss";
import { syncInsightsForWorkspace } from "@/lib/analytics/sync";
import { bestPostingHours, groupPerformance, sumTotals, type MetricsRow } from "@/lib/analytics/compute";
import { hasWorkspaceAIConfig } from "@/lib/ai/config";
import { researchTopics } from "@/lib/ai/research";
import { autopilotClaimKey, isAutopilotDue, pickEngagementSlot, sanitizeMaxPosts, sanitizeRunTimes } from "@/lib/autopilot/logic";
import { generateVisual, type VisualGenResult } from "@/lib/visuals/generate";
import { dateIsoInTz, hmInTz, isValidTimezone, tomorrowIsoInTz } from "@/lib/scheduling/time";
import type { PgBoss } from "pg-boss";
import { generateAndPersistContent, type GenerateContentInput } from "@/lib/ai/content";
import { createServiceClient } from "@/lib/supabase/service";
import { publishNow } from "@/lib/publishing/service";
import { resolvePublishProviderForPlatform } from "@/lib/publish/provider";

const MAX_PUBLISH_ATTEMPTS = 3;
const PUBLISH_RETRY_BACKOFF_MS = 5 * 60_000; // requeue 5 minutes out
const STUCK_PROCESSING_MS = 10 * 60_000; // a claim older than this is treated as lost

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
    .where(and(eq(publishingJobs.id, publishingJobId), eq(publishingJobs.status, "pending")))
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
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: recipientId,
      kind: "publishing_completed",
      title: result.provider === "buffer" ? "Published via Buffer" : "Published successfully",
      body: `${job.platform === "facebook" ? "Facebook" : "Instagram"} post is live${
        result.provider === "buffer" ? " — queued in Buffer, will go live within a minute." : "."
      }${result.firstCommentSkipped ? "\n\nFirst Comment: Skipped (unavailable on current Buffer plan)." : ""}`,
      link: "/content-studio",
    });
    return;
  }

  // Failure classification: transient (network/429/5xx) requeue up to
  // MAX_PUBLISH_ATTEMPTS; everything else fails permanently.
  const transient = /rate limit|too many requests|\b429\b|timeout|timed out|econnreset|socket|network|unavailable|temporar|internal server|bad gateway|\b5\d\d\b/.test(
    result.message.toLowerCase(),
  );
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
    });
  } else {
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: recipientId,
      kind: "publishing_failed",
      title: "Publishing failed",
      body: result.message,
      link: "/content-studio",
    });
  }
}

/** Recover publish jobs stuck in "processing" (a worker died mid-publish):
 *  requeue them while attempts remain, otherwise fail them permanently. */
export async function recoverStuckPublishJobs(): Promise<void> {
  const db = getDb();
  const stale = await db
    .select({ id: publishingJobs.id, attempts: publishingJobs.attempts, workspaceId: publishingJobs.workspaceId })
    .from(publishingJobs)
    .where(
      and(
        eq(publishingJobs.status, "processing"),
        lte(publishingJobs.updatedAt, new Date(Date.now() - STUCK_PROCESSING_MS)),
      ),
    )
    .limit(10);
  for (const job of stale) {
    if (job.attempts >= MAX_PUBLISH_ATTEMPTS) {
      const reason = "Publish job was stuck in processing (worker lost) and exceeded the attempt limit.";
      await db
        .update(publishingJobs)
        .set({ status: "failed", lastError: reason, updatedAt: new Date() })
        .where(eq(publishingJobs.id, job.id));
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
      });
    } else {
      // Requeue; the claim on the next pick-up counts another attempt, so the
      // stuck/recover cycle is bounded by MAX_PUBLISH_ATTEMPTS.
      await db
        .update(publishingJobs)
        .set({
          status: "pending",
          scheduledAt: new Date(),
          lastError: "Recovered from a stuck processing state; requeued.",
          updatedAt: new Date(),
        })
        .where(eq(publishingJobs.id, job.id));
    }
  }
}

/** Scan for due publishing jobs (runs every minute via pg-boss cron or vercel cron).
 *  All providers (Meta + Buffer) now route through the unified `attemptPublish`
 *  entry — the per-provider adapter lives inside the publishing service. */
export async function publishDueScan(): Promise<void> {
  const db = getDb();
  await recoverStuckPublishJobs();
  const due = await db
    .select({ id: publishingJobs.id })
    .from(publishingJobs)
    .where(and(eq(publishingJobs.status, "pending"), lte(publishingJobs.scheduledAt, new Date())))
    .limit(10);
  for (const j of due) {
    await attemptPublish(j.id);
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

  const days = await db
    .select()
    .from(campaignItems)
    .where(eq(campaignItems.campaignId, campaignId));
  const pending = days.filter((d) => !d.contentItemId).sort((a, b) => a.dayIndex - b.dayIndex);

  const platforms = (campaign.platforms ?? ["facebook", "instagram"]) as ("facebook" | "instagram")[];

  // Honest accounting: count real successes, not attempts. The run/job row is
  // updated so the UI shows real progress and a truthful terminal state.
  let generated = 0;
  let failed = 0;
  if (campaign.jobId) {
    await db.update(jobs).set({ status: "running", progress: 0, updatedAt: new Date() }).where(eq(jobs.id, campaign.jobId));
  }

  for (const day of pending) {
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

  if (campaign.jobId) {
    await db.update(jobs).set({ status: "completed", progress: generated, result: { generated, failed }, updatedAt: new Date() }).where(eq(jobs.id, campaign.jobId));
  }
  await db.update(campaigns).set({ status: "active", updatedAt: new Date() }).where(eq(campaigns.id, campaignId));
  await db.insert(notifications).values({
    workspaceId: campaign.workspaceId,
    userId: campaign.createdBy ?? campaign.workspaceId,
    kind: "job_completed",
    title: "Campaign content ready",
    body: generated + " of " + pending.length + " posts generated" + (failed > 0 ? " — " + failed + " failed." : "."),
    link: "/campaigns",
  });
}


/** Content formats the AI content engine can produce (contentFormatEnum). */
const CONTENT_FORMATS = new Set(["single_image", "carousel", "reel", "story", "text_post"]);
/** How many synced posts feed the measured-performance context + best-hour pick. */
const AUTOPILOT_METRICS_WINDOW = 30;
/** Cap each recent-topic entry in the research avoid-list. */
const AUTOPILOT_AVOID_TOPICS = 8;

type AutopilotCfg = {
  enabled?: boolean;
  requireApproval?: boolean;
  nicheFocus?: unknown;
  maxPostsPerRun?: unknown;
  runTimes?: unknown;
  lastRunKey?: string | null;
};

type AutopilotRunContext = {
  text: string;
  metricsCount: number;
  bestHours: { hour: number; avgEngagement: number; posts: number }[];
};

/** First recommended format when it is one the content engine can produce. */
function preferredFormatOf(recommended: string[] | null | undefined): GenerateContentInput["preferredFormat"] {
  const first = recommended?.[0];
  return first && CONTENT_FORMATS.has(first) ? (first as GenerateContentInput["preferredFormat"]) : null;
}

/** "No AI image (reason)." or a positive note — honest either way. */
function autopilotImageNote(result: VisualGenResult): string {
  if (result.ok) return "AI image attached.";
  const reason =
    result.message === "CONFIGURATION_REQUIRED"
      ? "the image provider is not configured"
      : (result.message || "generation failed").slice(0, 160);
  return `No AI image (${reason}).`;
}

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
async function buildAutopilotRunContext(workspaceId: string, timezone: string): Promise<AutopilotRunContext> {
  const db = getDb();
  const parts: string[] = [];

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
  return { text, metricsCount: metricRows.length, bestHours: hours };
}

/**
 * Autopilot loop — pg-boss cron fires this every minute. Each workspace with
 * autopilot enabled runs at every configured local run time (up to 6/day):
 * analytics + competitor context, research, content generation with an AI
 * visual, then approval + high-engagement scheduling (auto-approve mode) or
 * a for-review notification. Scheduling only ever targets TOMORROW or later
 * in the workspace timezone.
 *
 * Occurrences are claimed BEFORE the work via an atomic lastRunKey update
 * (the conditional UPDATE matches 0 rows for a concurrent scan), so two
 * minute scans can never double-fire one occurrence. The claim also survives
 * partial failures — the scan stays a no-op until the next configured time.
 */
export async function autopilotLoop(): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ workspaceId: settings.workspaceId, value: settings.value })
    .from(settings)
    .where(eq(settings.key, "autopilot"));
  for (const row of rows) {
    const cfg = (row.value ?? {}) as AutopilotCfg;
    if (!cfg.enabled) continue;
    try {
      const [ws] = await db
        .select({ createdBy: workspaces.createdBy, timezone: workspaces.timezone })
        .from(workspaces)
        .where(eq(workspaces.id, row.workspaceId));
      if (!ws) continue;

      const runTimes = sanitizeRunTimes(cfg.runTimes);
      if (runTimes.length === 0) {
        console.warn(`[autopilot] workspace ${row.workspaceId}: enabled with no run times — add run times in Settings`);
        continue;
      }
      if (!isValidTimezone(ws.timezone)) {
        console.warn(`[autopilot] workspace ${row.workspaceId}: invalid timezone "${ws.timezone}" — fix it in Workspace Settings`);
        continue;
      }

      const now = new Date();
      const localDate = dateIsoInTz(ws.timezone, now);
      const localHm = hmInTz(ws.timezone, now);
      if (!isAutopilotDue(cfg, localDate, localHm)) continue;

      if (!(await hasWorkspaceAIConfig(row.workspaceId))) {
        console.warn(`[autopilot] workspace ${row.workspaceId}: run due at ${localHm} ${ws.timezone} but AI is not configured — add provider + keys in Workspace Settings`);
        continue;
      }

      // Atomic claim of this occurrence (date + local time). jsonb_set keeps
      // any concurrent Settings save intact; the enabled check prevents
      // processing a workspace that was disabled after the row was read.
      const claimKey = autopilotClaimKey(localDate, localHm);
      const claimed = await db
        .update(settings)
        .set({
          value: sql`jsonb_set(${settings.value}, '{lastRunKey}', ${JSON.stringify(claimKey)}::jsonb, true)`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(settings.workspaceId, row.workspaceId),
            eq(settings.key, "autopilot"),
            sql`${settings.value}->>'enabled' = 'true'`,
            sql`${settings.value}->>'lastRunKey' IS DISTINCT FROM ${claimKey}`,
          ),
        )
        .returning({ workspaceId: settings.workspaceId });
      if (claimed.length === 0) continue; // another scan claimed it first

      await runAutopilotForWorkspace({
        workspaceId: row.workspaceId,
        userId: ws.createdBy,
        timezone: ws.timezone,
        cfg,
        localHm,
      });
    } catch (e) {
      console.error("[autopilot]", e instanceof Error ? e.message : e);
    }
  }
}

/** One due run for one workspace. Never throws for item-level failures. */
async function runAutopilotForWorkspace(args: {
  workspaceId: string;
  userId: string;
  timezone: string;
  cfg: AutopilotCfg;
  localHm: string;
}): Promise<void> {
  const db = getDb();
  const { workspaceId, userId, timezone, cfg, localHm } = args;
  const limit = sanitizeMaxPosts(cfg.maxPostsPerRun);

  const runCtx = await buildAutopilotRunContext(workspaceId, timezone);
  const niche = typeof cfg.nicheFocus === "string" && cfg.nicheFocus.trim().length > 0 ? cfg.nicheFocus : "the brand's niche";
  const research = await researchTopics({
    workspaceId,
    userId,
    niche,
    notes: `Autopilot run at ${localHm} (${timezone})`,
    context: runCtx.text || null,
  });
  if (!research.ok) {
    // The occurrence is already claimed — no per-minute retry storm. The
    // next configured run time retries with a fresh research call.
    console.warn(`[autopilot] workspace ${workspaceId}: research failed at ${localHm} — ${research.message}`);
    return;
  }
  const ids = research.insertedIds ?? [];
  if (ids.length === 0) return;

  const candidates = await db
    .select()
    .from(researchItems)
    .where(and(eq(researchItems.workspaceId, workspaceId), eq(researchItems.status, "new"), inArray(researchItems.id, ids)));
  const top = candidates
    .map((item) => ({ item, score: ((item.scores ?? {}) as Record<string, number>).overall ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  if (top.length === 0) {
    console.warn(`[autopilot] workspace ${workspaceId}: no research items persisted for the ${localHm} run`);
    return;
  }
  console.log(`[autopilot] workspace ${workspaceId}: ${localHm} ${timezone} run — up to ${top.length} post(s)`);

  // One slot per run: the analytics best local hour (18:30 while there are
  // fewer than 3 measured posts), always TOMORROW in the workspace timezone.
  const slot = pickEngagementSlot(runCtx.bestHours, runCtx.metricsCount);
  const slotDate = tomorrowIsoInTz(timezone);

  // Service-role storage client for image upload. Resolution is hoisted so a
  // missing SUPABASE_SERVICE_ROLE_KEY degrades per item to an honest
  // "No AI image" note instead of throwing mid-run and silently dropping the
  // auto-approve/schedule + notification for an otherwise-created post.
  let storage: ReturnType<typeof createServiceClient> | null = null;
  try {
    storage = createServiceClient();
  } catch (e) {
    console.error(`[autopilot] workspace ${workspaceId}: service-role storage unavailable — AI images skipped (${e instanceof Error ? e.message : e})`);
  }

  for (const t of top) {
    try {
      const { itemId, qa } = await generateAndPersistContent({
        workspaceId,
        userId,
        input: {
          topic: t.item.topic,
          objective: "Autopilot run " + localHm,
          platforms: ["facebook", "instagram"],
          preferredFormat: preferredFormatOf(t.item.recommendedFormats),
        },
      });
      await db.update(researchItems).set({ status: "converted", updatedAt: new Date() }).where(eq(researchItems.id, t.item.id));

      // AI visual — the same pipeline as Content Studio's "Generate AI
      // visual" (mode "ai"), but with the service-role storage client:
      // this worker has no request scope, so the cookies()-based client
      // would throw. Non-fatal: the notification says so honestly.
      const visual = storage
        ? await generateVisual({
            workspaceId,
            userId,
            contentItemId: itemId,
            mode: "ai",
            storage,
          })
        : { ok: false as const, reason: "config_error" as const, message: "Supabase service-role key is not configured" };
      const imageNote = autopilotImageNote(visual);

      // QA-gate: content that failed QA is NEVER auto-approved or
      // auto-scheduled — it goes to review like everything else.
      if (cfg.requireApproval === false && qa.passed) {
        await db.update(contentItems).set({ status: "approved", updatedAt: new Date() }).where(eq(contentItems.id, itemId));
        await db.update(contentVariants).set({ status: "approved", updatedAt: new Date() }).where(eq(contentVariants.contentItemId, itemId));
        const { schedulePost } = await import("@/lib/publishing/service");
        // Resolve UTC slot once (workspace-local slot on slotDate → UTC).
        const { parseZonedDateTime } = await import("@/lib/scheduling/time");
        const scheduledAt = parseZonedDateTime(slotDate, slot, timezone);
        const variants = await db.select({ id: contentVariants.id, platform: contentVariants.platform }).from(contentVariants).where(eq(contentVariants.contentItemId, itemId));
        let scheduledCount = 0;
        for (const v of variants) {
          const sched = await schedulePost({
            workspaceId,
            contentItemId: itemId,
            contentVariantId: v.id,
            platform: v.platform as "facebook" | "instagram",
            scheduledAt,
          });
          if (sched.ok) scheduledCount++;
        }
        if (scheduledCount > 0) {
          await db.insert(notifications).values({
            workspaceId,
            userId,
            kind: "content_ready",
            title: "Autopilot scheduled a post",
            body: `Tomorrow at ${slot} (${timezone}): ${t.item.topic}. ${imageNote}`,
            link: "/calendar",
          });
        } else {
          console.error(`[autopilot] workspace ${workspaceId}: scheduling failed for "${t.item.topic}" — no variants could be scheduled.`);
          await db.insert(notifications).values({
            workspaceId,
            userId,
            kind: "content_ready",
            title: "Autopilot post not scheduled",
            body: `${t.item.topic}: no platform connection routed the job. Approve and schedule it manually in Content Studio.`,
            link: "/content-studio",
          });
        }
      } else {
        await db.insert(notifications).values({
          workspaceId,
          userId,
          kind: "content_ready",
          title: "Autopilot created content for review",
          body: `${t.item.topic}${qa.passed ? "" : " (QA needs attention — review before approving)"}. ${imageNote}`,
          link: "/content-studio",
        });
      }
    } catch (e) {
      // One item must not sink the rest of the run.
      console.error(`[autopilot] workspace ${workspaceId}: item "${t.item.topic}" failed`, e instanceof Error ? e.message : e);
    }
  }
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
  await boss.work(QUEUES.campaignGenerate, async (job) => {
    const data = (job as { data?: { campaignId?: string } }).data;
    if (data?.campaignId) await generateCampaign(data.campaignId);
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
  console.log("[qurtiz] workers registered");
}
