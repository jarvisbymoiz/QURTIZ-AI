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
  platformConnections,
  postMetrics,
  publishingJobs,
  visualAssets,
  researchItems,
  jobs,
  settings,
} from "@/db/schema";
import { QUEUES } from "./boss";
import { decryptToken } from "@/lib/crypto/tokens";
import { publishPost } from "@/lib/meta/publish";
import { publishViaBuffer } from "@/lib/publish/buffer-provider";
import { syncInsightsForWorkspace } from "@/lib/analytics/sync";
import { bestPostingHours, groupPerformance, sumTotals, type MetricsRow } from "@/lib/analytics/compute";
import { hasWorkspaceAIConfig } from "@/lib/ai/config";
import { researchTopics } from "@/lib/ai/research";
import { autopilotClaimKey, isAutopilotDue, pickEngagementSlot, sanitizeMaxPosts, sanitizeRunTimes } from "@/lib/autopilot/logic";
import { generateVisual, type VisualGenResult } from "@/lib/visuals/generate";
import { scheduleItem } from "@/lib/scheduling/engine";
import { dateIsoInTz, hmInTz, isValidTimezone, tomorrowIsoInTz } from "@/lib/scheduling/time";
import type { PgBoss } from "pg-boss";
import { generateAndPersistContent, type GenerateContentInput } from "@/lib/ai/content";
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

  // Connection lookup is provider-scoped: a workspace may hold both a "meta"
  // and a "buffer" row for the same platform, and each job must route to the
  // connection matching its snapshotted provider. For provider="meta" (the
  // default, and every pre-existing row) this resolves to the same row the
  // pre-provider code selected.
  const [conn] = await db
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.workspaceId, job.workspaceId),
        eq(platformConnections.platform, job.platform),
        eq(platformConnections.provider, job.provider),
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

/** Buffer-side retryable failures are transport/rate-limit/server-class
 *  (network, 429, 5xx / unparseable 2xx). Auth (401/403) and content
 *  rejections (other 4xx) are permanent. */
function isTransientBufferFailure(reason: string): boolean {
  return reason === "network" || reason === "rate_limited" || reason === "invalid_response";
}

/**
 * Attempt to publish one due publishing job through the Buffer queue
 * (provider="buffer", snapshotted at job creation). Mirrors attemptPublish:
 * atomic claim, honest statuses/attempts/lastError/result + notifications,
 * and the same H2 guards (never post content that is no longer scheduled).
 *
 * Publish model: the update is created NOW with scheduled_at ≈ now + 60s
 * (publish-at-due-time), so Buffer's free-plan queue cap (10 scheduled
 * updates/channel) never accumulates.
 */
async function attemptBufferPublish(publishingJobId: string): Promise<void> {
  const db = getDb();

  // Atomic claim — identical to attemptPublish: the conditional UPDATE
  // (status='pending') means only one worker can win per job.
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

  const [ws] = await db
    .select({ createdBy: workspaces.createdBy })
    .from(workspaces)
    .where(eq(workspaces.id, job.workspaceId));
  const recipientId = ws?.createdBy ?? job.workspaceId;

  // Buffer connection for this platform (provider-scoped).
  const [conn] = await db
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.workspaceId, job.workspaceId),
        eq(platformConnections.platform, job.platform),
        eq(platformConnections.provider, "buffer"),
      ),
    );

  if (!conn || conn.status !== "connected" || !conn.encryptedToken) {
    const reason = `Buffer is not connected for ${job.platform === "facebook" ? "Facebook" : "Instagram"}. Connect the Buffer account on the Connections page${process.env.BUFFER_CLIENT_ID ? "" : " (Buffer app credentials missing in .env.local)"}.`;
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

  const channelId = conn.channelRef;
  if (!channelId) {
    const reason = "Buffer connection is missing its channel reference — reconnect the Buffer account.";
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

  const token = decryptToken(conn.encryptedToken);
  if (!token) {
    const reason = "Stored Buffer token could not be decrypted — reconnect the account.";
    await db
      .update(publishingJobs)
      .set({ status: "failed", lastError: reason, updatedAt: new Date() })
      .where(eq(publishingJobs.id, job.id));
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

  // Load variant + item + latest visual — same data assembly as the Meta
  // path (attemptPublish) so both providers publish the same content.
  const [variant] = await db.select().from(contentVariants).where(eq(contentVariants.id, job.contentVariantId));
  if (!variant) {
    await db.update(publishingJobs).set({ status: "failed", lastError: "Variant not found.", updatedAt: new Date() }).where(eq(publishingJobs.id, job.id));
    return;
  }
  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, variant.contentItemId));

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

  const [visual] = await db
    .select({ storagePath: visualAssets.storagePath })
    .from(visualAssets)
    .where(eq(visualAssets.contentItemId, variant.contentItemId))
    .orderBy(desc(visualAssets.createdAt))
    .limit(1);

  const message = [item?.caption ?? variant.caption, (variant.hashtags ?? []).map((h) => `#${h}`).join(" ")]
    .filter(Boolean)
    .join("\n\n");

  const result = await publishViaBuffer({
    workspaceId: job.workspaceId,
    channelId,
    accessToken: token,
    text: message,
    visualStoragePath: visual?.storagePath ?? null,
  });

  if (result.ok) {
    // Buffer accepted the update — it is queued and will fire ~now + 60s.
    await db
      .update(publishingJobs)
      .set({
        status: "published",
        result: { updateId: result.updateId, status: result.status, scheduledAt: result.scheduledAt.toISOString() },
        updatedAt: new Date(),
      })
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
      title: "Published via Buffer",
      body: `${job.platform === "facebook" ? "Facebook" : "Instagram"} post queued in Buffer — it goes live within a minute.`,
      link: "/content-studio",
    });
  } else if (result.reason === "auth") {
    // Buffer rejected our token (expired/revoked) — permanent, like the Meta
    // path's auth handling: fail the job and ask for a reconnect.
    const reason = `Buffer authorization failed — ${result.message} Reconnect the Buffer account on the Connections page.`;
    await db
      .update(publishingJobs)
      .set({ status: "failed", lastError: reason, updatedAt: new Date() })
      .where(eq(publishingJobs.id, job.id));
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: recipientId,
      kind: "auth_expired",
      title: "Reconnection required",
      body: reason,
      link: "/connections",
    });
  } else if (isTransientBufferFailure(result.reason) && job.attempts < MAX_PUBLISH_ATTEMPTS) {
    // Transient failures (rate limit / network / server-class) are requeued
    // with a backoff up to MAX_PUBLISH_ATTEMPTS — same policy as the Meta path.
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
    // Permanent failure (content rejected by Buffer, or retries exhausted) —
    // surface the real reason, never pretend success.
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
    .select({ id: publishingJobs.id, provider: publishingJobs.provider })
    .from(publishingJobs)
    .where(and(eq(publishingJobs.status, "pending"), lte(publishingJobs.scheduledAt, new Date())))
    .limit(10);
  for (const j of due) {
    // Dispatch on the provider snapshotted at job creation: "meta" keeps the
    // EXACT legacy path (attemptPublish); "buffer" routes through Buffer.
    if (j.provider === "buffer") {
      await attemptBufferPublish(j.id);
    } else {
      await attemptPublish(j.id);
    }
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
async function autopilotLoop(): Promise<void> {
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
        const sched = await scheduleItem({ workspaceId, itemId, dateIso: slotDate, timeStr: slot, timezone });
        if (sched.ok) {
          await db.insert(notifications).values({
            workspaceId,
            userId,
            kind: "content_ready",
            title: "Autopilot scheduled a post",
            body: `Tomorrow at ${slot} (${timezone}): ${t.item.topic}. ${imageNote}`,
            link: "/calendar",
          });
        } else {
          console.error(`[autopilot] workspace ${workspaceId}: scheduling failed for "${t.item.topic}" — ${sched.message}`);
          await db.insert(notifications).values({
            workspaceId,
            userId,
            kind: "content_ready",
            title: "Autopilot post not scheduled",
            body: `${t.item.topic}: ${sched.message} Approve and schedule it manually in Content Studio.`,
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



