import "server-only";

import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaigns,
  campaignItems,
  contentItems,
  contentVariants,
  workspaces,
  notifications,
  platformConnections,
  publishingJobs,
  visualAssets,
  researchItems,
  jobs,
  settings,
} from "@/db/schema";
import { QUEUES } from "./boss";
import { decryptToken } from "@/lib/crypto/tokens";
import { publishPost } from "@/lib/meta/publish";
import { syncInsightsForWorkspace } from "@/lib/analytics/sync";
import { researchTopics } from "@/lib/ai/research";
import { defaultSlotFor } from "@/lib/scheduling/time";
import type { PgBoss } from "pg-boss";
import { generateAndPersistContent } from "@/lib/ai/content";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_PUBLISH_ATTEMPTS = 3;
const PUBLISH_RETRY_BACKOFF_MS = 5 * 60_000; // requeue 5 minutes out
const STUCK_PROCESSING_MS = 10 * 60_000; // a claim older than this is treated as lost

/** Rate-limit / network-class platform errors are retryable; auth, content
 *  and permission errors are permanent. */
function isTransientPublishError(message: string): boolean {
  const m = message.toLowerCase();
  return /rate limit|too many requests|\b429\b|timeout|timed out|econnreset|socket|network|unavailable|temporar|internal server|bad gateway|\b5\d\d\b/.test(m);
}

/**
 * Attempt to publish one due publishing job through the connected platform
 * adapter (official Meta Graph API). Failures surface HONESTLY with a clear
 * reason so the UI shows a genuine failure state instead of pretending
 * success.
 */
async function attemptPublish(publishingJobId: string): Promise<void> {
  const db = getDb();

  // Atomic claim: the conditional UPDATE (status='pending') means only one
  // worker can win — a concurrent claim matches 0 rows and returns
  // immediately. Without it, two workers could both read "pending" and
  // publish the same variant twice.
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

  // Notification recipient is the workspace creator, never the workspace UUID
  // (M3: live rows had user_id polluted with the workspace id).
  const [ws] = await db
    .select({ createdBy: workspaces.createdBy })
    .from(workspaces)
    .where(eq(workspaces.id, job.workspaceId));
  const recipientId = ws?.createdBy ?? job.workspaceId;

  const [conn] = await db
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.workspaceId, job.workspaceId),
        eq(platformConnections.platform, job.platform),
      ),
    );

  if (!conn || conn.status !== "connected" || !conn.encryptedToken) {
    const reason = `${job.platform === "facebook" ? "Facebook Page" : "Instagram"} is not connected. Connect it on the Connections page${process.env.META_APP_ID ? "" : " (Meta app credentials missing in .env.local)"}.`;
    await db
      .update(publishingJobs)
      .set({ status: "failed", lastError: reason, updatedAt: new Date() })
      .where(eq(publishingJobs.id, job.id));
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: recipientId,
      kind: "publishing_failed",
      title: "Publishing failed",
      body: reason,
      link: "/connections",
    });
    return;
  }

  // Load variant + item + latest visual
  const [variant] = await db.select().from(contentVariants).where(eq(contentVariants.id, job.contentVariantId));
  if (!variant) {
    await db.update(publishingJobs).set({ status: "failed", lastError: "Variant not found.", updatedAt: new Date() }).where(eq(publishingJobs.id, job.id));
    return;
  }
  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, variant.contentItemId));

  // H2 guard: never post content that is no longer scheduled/approved. A
  // variant may already be published (partial publish + reschedule) or the
  // item may have been moved back to draft after the job was queued — both
  // would otherwise cause a silent double post.
  const variantPublishable = variant.status === "scheduled" || variant.status === "approved";
  const itemPublishable = item?.status === "scheduled" || item?.status === "approved";
  if (!item || !variantPublishable || !itemPublishable) {
    const reason = `Publish skipped: item "${item?.status ?? "deleted"}" / variant "${variant.status}" — content is no longer scheduled.`;
    await db
      .update(publishingJobs)
      .set({ status: "failed", lastError: reason, updatedAt: new Date() })
      .where(eq(publishingJobs.id, job.id));
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: recipientId,
      kind: "publishing_failed",
      title: "Publishing skipped",
      body: reason,
      link: "/content-studio",
    });
    return;
  }

  // Latest template or AI visual for this item
  const [visual] = await db
    .select()
    .from(visualAssets)
    .where(eq(visualAssets.contentItemId, variant.contentItemId))
    .orderBy(desc(visualAssets.createdAt))
    .limit(1);

  // Signed public URL for the image (IG requires a reachable URL). Uses the
  // service-role client: this worker runs outside any request scope, so the
  // cookies()-based client would throw here.
  let imageUrl: string | null = null;
  if (visual) {
    try {
      const { data } = await createServiceClient()
        .storage.from("brand-assets")
        .createSignedUrl(visual.storagePath, 60 * 60 * 24 * 6);
      imageUrl = data?.signedUrl ?? null;
    } catch {
      imageUrl = null;
    }
    if (!imageUrl) {
      const reason = "Could not generate a public URL for the attached visual (Supabase storage unreachable) — the post was not published.";
      await db
        .update(publishingJobs)
        .set({ status: "failed", lastError: reason, updatedAt: new Date() })
        .where(eq(publishingJobs.id, job.id));
      await db.insert(notifications).values({
        workspaceId: job.workspaceId,
        userId: recipientId,
        kind: "publishing_failed",
        title: "Publishing failed",
        body: reason,
        link: "/content-studio",
      });
      return;
    }
  }

  const token = decryptToken(conn.encryptedToken);
  if (!token) {
    const reason = "Stored access token could not be decrypted — reconnect the account.";
    await db.update(publishingJobs).set({ status: "failed", lastError: reason, updatedAt: new Date() }).where(eq(publishingJobs.id, job.id));
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: recipientId,
      kind: "auth_expired",
      title: "Reconnection required",
      body: reason,
      link: "/connections",
    });
    return;
  }

  const meta = (conn.meta ?? {}) as Record<string, string>;
  const message = [item?.caption ?? variant.caption, (variant.hashtags ?? []).map((h) => `#${h}`).join(" ")]
    .filter(Boolean)
    .join("\n\n");

  const result = await publishPost({
    pageToken: token,
    pageId: conn.platform === "instagram" ? String(meta.pageId ?? "") : String(meta.pageId ?? ""),
    igUserId: meta.igUserId ?? null,
    platform: job.platform,
    message,
    imageUrl,
  });

  if (result.ok) {
    await db
      .update(publishingJobs)
      .set({ status: "published", result: { postId: result.postId, permalink: result.permalink }, updatedAt: new Date() })
      .where(eq(publishingJobs.id, job.id));
    await db
      .update(contentVariants)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(contentVariants.id, variant.id));
    const allPublished = (await db
      .select({ status: contentVariants.status })
      .from(contentVariants)
      .where(eq(contentVariants.contentItemId, variant.contentItemId))).every((v) => v.status === "published");
    if (allPublished) {
      await db
        .update(contentItems)
        .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
        .where(eq(contentItems.id, variant.contentItemId));
    }
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: recipientId,
      kind: "publishing_completed",
      title: "Published successfully",
      body: `${job.platform === "facebook" ? "Facebook" : "Instagram"} post is live${result.permalink ? `: ${result.permalink}` : "."}`,
      link: "/content-studio",
    });
  } else {
    // Transient failures (rate limit / network) are requeued with a backoff
    // up to MAX_PUBLISH_ATTEMPTS; everything else fails permanently. Either
    // way the row leaves "processing" — never left running forever.
    if (isTransientPublishError(result.message) && job.attempts < MAX_PUBLISH_ATTEMPTS) {
      await db
        .update(publishingJobs)
        .set({
          status: "pending",
          scheduledAt: new Date(Date.now() + PUBLISH_RETRY_BACKOFF_MS),
          lastError: result.message,
          updatedAt: new Date(),
        })
        .where(eq(publishingJobs.id, job.id));
    } else {
      await db
        .update(publishingJobs)
        .set({ status: "failed", lastError: result.message, updatedAt: new Date() })
        .where(eq(publishingJobs.id, job.id));
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
}

/** Recover publish jobs stuck in "processing" (a worker died mid-publish):
 *  requeue them while attempts remain, otherwise fail them permanently. */
async function recoverStuckPublishJobs(): Promise<void> {
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

/** Scan for due publishing jobs (runs every minute via pg-boss cron). */
async function publishDueScan(): Promise<void> {
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
async function bulkGenerate(jobId: string): Promise<void> {
  const { runBulkPlan } = await import("@/lib/jobs/bulk");
  await runBulkPlan(jobId);
}

/**
 * Campaign generation: produce content for each day of the arc.
 */
async function generateCampaign(campaignId: string): Promise<void> {
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


/**
 * Daily autonomous loop for workspaces with autopilot enabled.
 * Guardrails: max posts per run (1-3), approval default on, one slot per day.
 */
async function autopilotLoop(): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ workspaceId: settings.workspaceId, value: settings.value })
    .from(settings)
    .where(eq(settings.key, "autopilot"));
  for (const row of rows) {
    const cfg = (row.value ?? {}) as { enabled?: boolean; requireApproval?: boolean; nicheFocus?: string; maxPostsPerRun?: number };
    if (!cfg.enabled) continue;
    try {
      const [ws] = await db.select({ createdBy: workspaces.createdBy, timezone: workspaces.timezone }).from(workspaces).where(eq(workspaces.id, row.workspaceId));
      if (!ws) continue;

      const research = await researchTopics({
        workspaceId: row.workspaceId,
        userId: ws.createdBy,
        niche: cfg.nicheFocus || "the brand's niche",
        notes: "Autopilot daily loop",
      });
      if (!research.ok) continue;

      const items = await db
        .select()
        .from(researchItems)
        .where(and(eq(researchItems.workspaceId, row.workspaceId), eq(researchItems.status, "new")));
      const top = items
        .map((i) => ({ item: i, score: ((i.scores ?? {}) as Record<string, number>).overall ?? 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, cfg.maxPostsPerRun ?? 1);

      for (const t of top) {
        const { itemId, qa } = await generateAndPersistContent({
          workspaceId: row.workspaceId,
          userId: ws.createdBy,
          input: { topic: t.item.topic, objective: "Autopilot daily plan", platforms: ["facebook", "instagram"], preferredFormat: null },
        });
        await db.update(researchItems).set({ status: "converted", updatedAt: new Date() }).where(eq(researchItems.id, t.item.id));

        // Even when approval is not required, content that failed QA must not
        // be auto-approved or published — it goes to review like everything
        // else until it is actually re-QA'd.
        if (cfg.requireApproval === false && qa.passed) {
          await db.update(contentItems).set({ status: "approved", updatedAt: new Date() }).where(eq(contentItems.id, itemId));
          await db.update(contentVariants).set({ status: "approved", updatedAt: new Date() }).where(eq(contentVariants.contentItemId, itemId));
          const slot = defaultSlotFor(new Date(Date.now() + 86400000).toISOString().slice(0, 10), ws.timezone);
          const variants = await db.select({ id: contentVariants.id, platform: contentVariants.platform }).from(contentVariants).where(eq(contentVariants.contentItemId, itemId));
          for (const v of variants) {
            await db.insert(publishingJobs).values({
              workspaceId: row.workspaceId,
              contentItemId: itemId,
              contentVariantId: v.id,
              platform: v.platform,
              scheduledAt: slot,
            });
          }
          await db.update(contentItems).set({ status: "scheduled", scheduledAt: slot, updatedAt: new Date() }).where(eq(contentItems.id, itemId));
          await db.insert(notifications).values({
            workspaceId: row.workspaceId,
            userId: ws.createdBy,
            kind: "content_ready",
            title: "Autopilot scheduled a post",
            body: "Tomorrow at 18:30: " + t.item.topic,
            link: "/calendar",
          });
        } else {
          await db.insert(notifications).values({
            workspaceId: row.workspaceId,
            userId: ws.createdBy,
            kind: "content_ready",
            title: "Autopilot created content for review",
            body: t.item.topic + (qa.passed ? "" : " (QA needs attention — review before approving)"),
            link: "/content-studio",
          });
        }
      }
    } catch (e) {
      console.error("[autopilot]", e instanceof Error ? e.message : e);
    }
  }
}


/** Register all workers. Called once at server start. */
export async function registerWorkers(boss: PgBoss): Promise<void> {
  await boss.work(QUEUES.publishScan, async () => {
    await publishDueScan();
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



