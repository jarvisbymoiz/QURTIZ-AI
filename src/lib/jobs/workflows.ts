import "server-only";

import { and, desc, eq, lte } from "drizzle-orm";
import { getDb } from "@/db";
import {
  agentRuns,
  contentItems,
  contentVariants,
  jobs,
  notifications,
  platformConnections,
  publishingJobs,
  visualAssets,
} from "@/db/schema";
import { QUEUES } from "./boss";
import { decryptToken } from "@/lib/crypto/tokens";
import { publishPost } from "@/lib/meta/publish";
import { campaigns, campaignItems } from "@/db/schema";
import { QUEUES as Q } from "./boss";
import type { PgBoss } from "pg-boss";
import { planContentDays } from "@/lib/scheduling/time";
import { generateAndPersistContent } from "@/lib/ai/content";

/**
 * Attempt to publish one due publishing job. M4 will provide the real Meta
 * adapters; until then this fails HONESTLY with a clear reason so the UI
 * shows a genuine failure state instead of pretending success.
 */
async function attemptPublish(publishingJobId: string): Promise<void> {
  const db = getDb();
  const [job] = await db.select().from(publishingJobs).where(eq(publishingJobs.id, publishingJobId));
  if (!job || job.status !== "pending") return;

  await db
    .update(publishingJobs)
    .set({ status: "processing", attempts: job.attempts + 1, updatedAt: new Date() })
    .where(eq(publishingJobs.id, job.id));

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
      userId: job.workspaceId,
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

  // Latest template or AI visual for this item
  const [visual] = await db
    .select()
    .from(visualAssets)
    .where(eq(visualAssets.contentItemId, variant.contentItemId))
    .orderBy(desc(visualAssets.createdAt))
    .limit(1);

  // Signed public URL for the image (IG requires a reachable URL)
  let imageUrl: string | null = null;
  if (visual) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase.storage.from("brand-assets").createSignedUrl(visual.storagePath, 60 * 60 * 24 * 6);
    imageUrl = data?.signedUrl ?? null;
  }

  const token = decryptToken(conn.encryptedToken);
  if (!token) {
    const reason = "Stored access token could not be decrypted — reconnect the account.";
    await db.update(publishingJobs).set({ status: "failed", lastError: reason, updatedAt: new Date() }).where(eq(publishingJobs.id, job.id));
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: job.workspaceId,
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
      userId: job.workspaceId,
      kind: "publishing_completed",
      title: "Published successfully",
      body: `${job.platform === "facebook" ? "Facebook" : "Instagram"} post is live${result.permalink ? `: ${result.permalink}` : "."}`,
      link: "/content-studio",
    });
  } else {
    await db
      .update(publishingJobs)
      .set({ status: "failed", lastError: result.message, updatedAt: new Date() })
      .where(eq(publishingJobs.id, job.id));
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: job.workspaceId,
      kind: "publishing_failed",
      title: "Publishing failed",
      body: result.message,
      link: "/content-studio",
    });
  }
}

/** Scan for due publishing jobs (runs every minute via pg-boss cron). */
async function publishDueScan(): Promise<void> {
  const db = getDb();
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
 * Bulk content plan: generate posts spread over planned days with a
 * pillar-aware mix, updating progress on the jobs row.
 */
async function bulkGenerate(jobId: string): Promise<void> {
  const db = getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job || job.status !== "queued") return;

  await db.update(jobs).set({ status: "running", updatedAt: new Date() }).where(eq(jobs.id, jobId));

  try {
    const input = job.input as { count?: number; days?: string[]; niche?: string };
    const count = Math.min(Math.max(input.count ?? 12, 1), 30);
    const days = input.days ?? planContentDays(new Date(), count);

    const [run] = await db
      .insert(agentRuns)
      .values({ workspaceId: job.workspaceId, userId: job.userId, kind: "bulk_generation", model: null })
      .returning();

    const created: string[] = [];
    for (let i = 0; i < count; i++) {
      const day = days[i] ?? days[days.length - 1] ?? new Date().toISOString().slice(0, 10);
      const niche = input.niche ? `${input.niche}` : "the brand's niche";
      try {
        const { itemId } = await generateAndPersistContent({
          workspaceId: job.workspaceId,
          userId: job.userId,
          input: {
            topic: `Bulk plan day ${day}: pick the next strong ${niche} topic not yet covered (variation ${i + 1} of ${count})`,
            objective: "Bulk content plan",
            platforms: ["facebook", "instagram"],
            preferredFormat: i % 4 === 0 ? "carousel" : i % 4 === 1 ? "reel" : "single_image",
          },
        });
        created.push(itemId);
        // Link planned day for the calendar
        await db
          .update(contentItems)
          .set({ scheduledAt: null, updatedAt: new Date() })
          .where(eq(contentItems.id, itemId));
      } catch (e) {
        console.error("[bulk-generate] item failed", e instanceof Error ? e.message : e);
      }
      await db
        .update(jobs)
        .set({ progress: i + 1, total: count, updatedAt: new Date() })
        .where(eq(jobs.id, jobId));
    }

    await db
      .update(jobs)
      .set({ status: "completed", result: { createdCount: created.length, days: days.length }, updatedAt: new Date() })
      .where(eq(jobs.id, jobId));
    await db
      .update(agentRuns)
      .set({ status: "completed", finishedAt: new Date() })
      .where(eq(agentRuns.id, run.id));
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: job.userId,
      kind: "job_completed",
      title: "Bulk content plan ready",
      body: `${created.length} posts generated. Review them in the Calendar and Content Studio.`,
      link: "/calendar",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bulk generation failed";
    await db.update(jobs).set({ status: "failed", error: message, updatedAt: new Date() }).where(eq(jobs.id, jobId));
  }
}

/**
 * Campaign generation: produce content for each day of the arc.
 */
async function generateCampaign(campaignId: string): Promise<void> {
  const db = getDb();
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campaign || campaign.status !== "generating") return;

  const days = await db
    .select()
    .from(campaignItems)
    .where(eq(campaignItems.campaignId, campaignId));
  const pending = days.filter((d) => !d.contentItemId).sort((a, b) => a.dayIndex - b.dayIndex);

  const platforms = (campaign.platforms ?? ["facebook", "instagram"]) as ("facebook" | "instagram")[];

  for (const day of pending) {
    try {
      const { itemId } = await generateAndPersistContent({
        workspaceId: campaign.workspaceId,
        userId: (campaign.createdBy ?? campaign.workspaceId),
        input: {
          topic: `Campaign "${campaign.name}" — Day ${day.dayIndex}: ${day.theme}${campaign.offer ? ` (offer: ${campaign.offer})` : ""}`,
          objective: `Campaign day ${day.dayIndex}/${campaign.durationDays}: ${day.theme}`,
          platforms,
          preferredFormat: null,
        },
      });
      await db
        .update(campaignItems)
        .set({ contentItemId: itemId })
        .where(eq(campaignItems.id, day.id));
    } catch (e) {
      console.error("[campaign] day failed", e instanceof Error ? e.message : e);
    }
  }

  await db.update(campaigns).set({ status: "active", updatedAt: new Date() }).where(eq(campaigns.id, campaignId));
  await db.insert(notifications).values({
    workspaceId: campaign.workspaceId,
    userId: campaign.createdBy ?? campaign.workspaceId,
    kind: "job_completed",
    title: "Campaign content ready",
    body: `${campaign.name}: ${pending.length} posts generated.`,
    link: "/campaigns",
  });
}

/** Register all workers. Called once at server start. */
export async function registerWorkers(boss: PgBoss): Promise<void> {
  await boss.work(QUEUES.publishScan, async () => {
    await publishDueScan();
  });
  await boss.work(QUEUES.bulkGenerate, async (job) => {
    const data = (job as { data?: { jobId?: string } }).data;
    const jobId = data?.jobId;
    if (jobId) await bulkGenerate(jobId);
  });
  await boss.work(Q.campaignGenerate, async (job) => {
    const data = (job as { data?: { campaignId?: string } }).data;
    if (data?.campaignId) await generateCampaign(data.campaignId);
  });
  console.log("[qurtiz] workers registered");
}



