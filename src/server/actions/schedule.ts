"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { contentItems, contentVariants, publishingJobs, jobs } from "@/db/schema";

import { scheduleItem } from "@/lib/scheduling/engine";
import { rateLimit } from "@/lib/security/rate-limit";
import { ensureDefaultPillars } from "@/lib/content/pillars";
import { getActiveContext } from "@/lib/workspace";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Schedule an approved (or ready) content item: creates one publishing job
 * per variant at the requested slot and flips statuses to scheduled.
 * Approval gate: the item must be ready_for_review or approved — it cannot
 * jump from draft to scheduled (Manual mode safety).
 */
export async function scheduleContentAction(input: { itemId: string; dateIso: string; timeStr?: string }): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(input.dateIso);
  if (!dateOk) return { ok: false, error: "Invalid date." };

  const db = getDb();
  const [item] = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.id, input.itemId), eq(contentItems.workspaceId, ctx.workspaceId)));
  if (!item) return { ok: false, error: "Content item not found." };
  if (!["ready_for_review", "approved", "scheduled"].includes(item.status)) {
    return { ok: false, error: "Only content in review or approved can be scheduled. Review it first." };
  }

  const result = await scheduleItem({
    workspaceId: ctx.workspaceId,
    itemId: input.itemId,
    dateIso: input.dateIso,
    timeStr: input.timeStr || undefined,
    timezone: ctx.timezone,
  });
  if (!result.ok) return { ok: false, error: result.message };

  revalidatePath("/calendar");
  revalidatePath("/content-studio");
  revalidatePath("/");
  return { ok: true };
}

export async function unscheduleContentAction(itemId: string): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const db = getDb();
  const [item] = await db
    .select({ status: contentItems.status })
    .from(contentItems)
    .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, ctx.workspaceId)));
  if (!item) return { ok: false, error: "Content item not found." };

  // Only unpublished variants (approved/scheduled) are unscheduled — a
  // variant that is already published stays published and is never flipped
  // back to approved.
  const unscheduled = await db
    .select({ id: contentVariants.id })
    .from(contentVariants)
    .where(and(
      eq(contentVariants.contentItemId, itemId),
      eq(contentVariants.workspaceId, ctx.workspaceId),
      inArray(contentVariants.status, ["approved", "scheduled"]),
    ));
  const variantIds = unscheduled.map((v) => v.id);

  if (variantIds.length > 0) {
    await db
      .delete(publishingJobs)
      .where(and(
        eq(publishingJobs.contentItemId, itemId),
        eq(publishingJobs.workspaceId, ctx.workspaceId),
        inArray(publishingJobs.contentVariantId, variantIds),
        eq(publishingJobs.status, "pending"),
      ));
    await db
      .update(contentVariants)
      .set({ status: "approved", updatedAt: new Date() })
      .where(inArray(contentVariants.id, variantIds));
  }

  if (item.status === "scheduled" && variantIds.length > 0) {
    await db
      .update(contentItems)
      .set({ status: "approved", scheduledAt: null, updatedAt: new Date() })
      .where(eq(contentItems.id, itemId));
  }

  revalidatePath("/calendar");
  revalidatePath("/content-studio");
  return { ok: true };
}

/** Bulk approve everything currently Ready for Review. */
export async function bulkApproveReadyAction(): Promise<ActionResult & { count?: number }> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const db = getDb();
  const ready = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(and(eq(contentItems.workspaceId, ctx.workspaceId), eq(contentItems.status, "ready_for_review")));

  for (const item of ready) {
    await db
      .update(contentItems)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(contentItems.id, item.id));
    await db
      .update(contentVariants)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(contentVariants.contentItemId, item.id));
  }

  revalidatePath("/content-studio");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true, count: ready.length };
}

const bulkPlanSchema = z.object({
  count: z.number().int().min(4).max(30).default(12),
  niche: z.string().trim().max(300).optional().or(z.literal("")),
});

/**
 * Bulk content plan: enqueue a background job that generates posts spread
 * over upcoming weekdays and returns immediately. Progress is polled via
 * getJobStatusAction.
 */
export async function startBulkPlanAction(input: { count?: number; niche?: string }): Promise<ActionResult & { jobId?: string }> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("bulk:" + ctx.workspaceId, 3, 10 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Too many bulk plans. Try again in a few minutes." };

    const parsed = bulkPlanSchema.safeParse({ count: input.count ?? 12, niche: input.niche ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await ensureDefaultPillars(ctx.workspaceId);
  const { startBulkPlanCore } = await import("@/lib/jobs/bulk");
  const result = await startBulkPlanCore({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    count: parsed.data.count,
    niche: parsed.data.niche || undefined,
  });
  if (!result.ok) return { ok: false, error: result.error };

  try {
    const { getBoss, QUEUES } = await import("@/lib/jobs/boss");
    const boss = await getBoss();
    await boss.send(QUEUES.bulkGenerate, { jobId: result.jobId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Queue unavailable";
    const db = getDb();
    await db.update(jobs).set({ status: "failed", error: msg, updatedAt: new Date() }).where(eq(jobs.id, result.jobId));
    return { ok: false, error: "Could not queue the bulk plan: " + msg };
  }

  revalidatePath("/content-studio");
  revalidatePath("/calendar");
  return { ok: true, jobId: result.jobId };
}

export async function cancelBulkJobAction(jobId: string): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const db = getDb();
  const [job] = await db
    .select({ id: jobs.id, status: jobs.status })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.workspaceId, ctx.workspaceId)));
  if (!job) return { ok: false, error: "Job not found." };
  // Only non-terminal jobs can be cancelled — flipping a completed/failed job
  // to "cancelled" would rewrite real history.
  if (job.status !== "queued" && job.status !== "running") {
    return { ok: false, error: `A ${job.status} job cannot be cancelled.` };
  }
  await db
    .update(jobs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(jobs.id, jobId));
  revalidatePath("/content-studio");
  return { ok: true };
}

export async function retryBulkFailedAction(jobId: string): Promise<ActionResult & { jobId?: string }> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const db = getDb();
  const [prev] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.workspaceId, ctx.workspaceId)));
  if (!prev) return { ok: false, error: "Job not found." };
  const result = (prev.result ?? {}) as { createdCount?: number; failures?: string[] };
  const failedCount = (prev.total ?? 0) - (result.createdCount ?? 0);
  if (failedCount <= 0) return { ok: false, error: "Nothing to retry." };
  return startBulkPlanAction({ count: failedCount, niche: ((prev.input ?? {}) as { niche?: string }).niche });
}

export async function getJobStatusAction(jobId: string): Promise<{
  ok: boolean;
  status?: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress?: number;
  total?: number;
  stage?: string | null;
  error?: string;
}> {
  const ctx = await getActiveContext("brand:read");
  if ("error" in ctx) return { ok: false };

  const db = getDb();
  const [job] = await db
    .select({ status: jobs.status, progress: jobs.progress, total: jobs.total, error: jobs.error, result: jobs.result })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.workspaceId, ctx.workspaceId)));
  if (!job) return { ok: false };
  const stage = (job.result as { stage?: string } | null)?.stage ?? null;
  return { ok: true, status: job.status, progress: job.progress, total: job.total, stage, error: job.error ?? undefined };
}





