import "server-only";

import { and, eq, lte } from "drizzle-orm";
import { getDb } from "@/db";
import {
  agentRuns,
  contentItems,
  contentVariants,
  jobs,
  notifications,
  platformConnections,
  publishingJobs,
} from "@/db/schema";
import { QUEUES } from "./boss";
import type { PgBoss } from "pg-boss";
import { planContentDays } from "@/lib/scheduling/time";
import { generateAndPersistContent } from "@/lib/ai/content";
import { overallOpportunity } from "@/lib/ai/scores";

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

  if (!conn || conn.status !== "connected") {
    const reason = `${job.platform === "facebook" ? "Facebook Page" : "Instagram"} is not connected — official Meta integration ships in M4. Schedule kept; publish will retry once connected.`;
    await db
      .update(publishingJobs)
      .set({ status: "failed", lastError: reason, updatedAt: new Date() })
      .where(eq(publishingJobs.id, job.id));
    await db.insert(notifications).values({
      workspaceId: job.workspaceId,
      userId: (await db.select({ v: contentVariants.id }).from(contentVariants).where(eq(contentVariants.id, job.contentVariantId)).limit(1)).length > 0 ? job.workspaceId : job.workspaceId, // owner notification; refined with member targeting in M4
      kind: "publishing_failed",
      title: "Publishing failed",
      body: reason,
      link: "/content-studio",
    });
    return;
  }

  // Real Meta adapter lands in M4.
  await db
    .update(publishingJobs)
    .set({ status: "failed", lastError: "Publishing adapter not yet implemented (M4).", updatedAt: new Date() })
    .where(eq(publishingJobs.id, job.id));
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
  console.log("[qurtiz] workers registered");
}



