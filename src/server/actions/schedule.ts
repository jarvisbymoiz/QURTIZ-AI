"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { contentItems, contentVariants, publishingJobs, jobs, visualAssets } from "@/db/schema";

import { scheduleItem } from "@/lib/scheduling/engine";
import { publishNow } from "@/lib/publishing/service";
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

/**
 * Reschedule an already-scheduled (or approved) content item to a new date
 * and/or time. H2 guard: only `scheduled`/`approved` items may move —
 * published items are live and never receive a new slot (that would
 * double-post). Pending publish jobs are deleted by scheduleItem and
 * re-created at the new time, so no stale job can fire at the old slot.
 */
export async function rescheduleContentAction(input: {
  itemId: string;
  dateIso: string;
  timeStr: string;
  timezone?: string;
}): Promise<ActionResult & { scheduledAt?: string; variants?: number }> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateIso)) return { ok: false, error: "Invalid date." };
  if (!input.timeStr || !/^\d{2}:\d{2}$/.test(input.timeStr)) return { ok: false, error: "Invalid time — use HH:MM." };

  const db = getDb();
  const [item] = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.id, input.itemId), eq(contentItems.workspaceId, ctx.workspaceId)));
  if (!item) return { ok: false, error: "Content item not found." };
  if (item.status === "published") {
    return { ok: false, error: "This item is already published and cannot be rescheduled." };
  }
  if (item.status !== "scheduled" && item.status !== "approved") {
    return { ok: false, error: "Only scheduled or approved content can be rescheduled." };
  }

  const result = await scheduleItem({
    workspaceId: ctx.workspaceId,
    itemId: input.itemId,
    dateIso: input.dateIso,
    timeStr: input.timeStr,
    timezone: input.timezone ?? ctx.timezone,
  });
  if (!result.ok) return { ok: false, error: result.message };

  revalidatePath("/calendar");
  revalidatePath("/content-studio");
  revalidatePath("/");
  return { ok: true, scheduledAt: result.scheduledAt.toISOString(), variants: result.variants };
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
    // Cancel (NOT delete) the pending jobs so publish history persists; the
    // worker claims only status='pending' rows and retryFailedPublish refuses
    // cancelled ones, so a cancelled job can never fire.
    await db
      .update(publishingJobs)
      .set({ status: "cancelled", updatedAt: new Date() })
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

    // Every schedulable variant was just returned to approved, so no pending
    // job remains for this item: clear the grid anchor unconditionally. (With
    // the MIN(scheduledAt) rule in schedulePost, a partially scheduled item
    // can carry scheduledAt while its status is still "approved" — clearing
    // only on status === "scheduled" would leave a ghost on the calendar.)
    // Status flips only scheduled → approved; published items are untouched.
    await db
      .update(contentItems)
      .set({
        ...(item.status === "scheduled" ? { status: "approved" as const } : {}),
        scheduledAt: null,
        updatedAt: new Date(),
      })
      .where(eq(contentItems.id, itemId));
  }

  revalidatePath("/calendar");
  revalidatePath("/content-studio");
  return { ok: true };
}

const publishNowSchema = z.object({
  itemId: z.uuid("Invalid content item id."),
  variantId: z.uuid("Invalid content variant id."),
  platform: z.enum(["facebook", "instagram"]),
});

/**
 * Pre-mint a 6-day signed URL for the item's latest visual using the USER'S
 * session (request scope). Mirrors getAssetSignedUrl (src/server/actions/
 * visuals.ts): server Supabase client + workspace-scoped storage-path guard,
 * but with the service's 6-day visual expiry. The query matches
 * loadPublishContext's (latest visual by createdAt) so the override targets
 * exactly the visual the service will attach.
 *
 * Returns undefined on ANY failure — the publishing service then runs its own
 * signing chain (service key → user-JWT → public-URL HEAD) and fails honestly
 * if none works. This pre-mint is what lets Calendar "Publish now" attach
 * visuals WITHOUT SUPABASE_SERVICE_ROLE_KEY: the action runs with the user's
 * cookies, the worker/retry paths never do.
 */
async function premintVisualSignedUrl(workspaceId: string, contentItemId: string): Promise<string | undefined> {
  try {
    const db = getDb();
    const [visual] = await db
      .select({ storagePath: visualAssets.storagePath })
      .from(visualAssets)
      .where(eq(visualAssets.contentItemId, contentItemId))
      .orderBy(desc(visualAssets.createdAt))
      .limit(1);
    if (!visual?.storagePath || !visual.storagePath.startsWith(`${workspaceId}/`)) return undefined;
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase.storage.from("brand-assets").createSignedUrl(visual.storagePath, 60 * 60 * 24 * 6);
    return data?.signedUrl ?? undefined;
  } catch {
    // No session, storage misconfigured, or the mint failed — degrade to the
    // service's own chain instead of blocking the publish here.
    return undefined;
  }
}

/**
 * Publish ONE approved/scheduled variant immediately (Calendar "Publish now").
 * Zod-validated, workspace-scoped + rate-limited; the actual publish funnels
 * through the centralized publishing service (`publishNow`), so provider
 * routing, token refresh and honest failure surfacing are identical to the
 * scheduled path. On failure the service's real error message is returned
 * verbatim. `firstCommentSkipped` threads the Buffer paid-plan fallback
 * (post live, first comment dropped) so the client can disclose it.
 * The visual's signed URL is pre-minted HERE with the user's session and
 * passed as `mediaUrlOverride` — the interactive path never depends on the
 * service key.
 */
export async function publishNowAction(input: {
  itemId: string;
  variantId: string;
  platform: "facebook" | "instagram";
}): Promise<ActionResult & { providerPostId?: string; firstCommentSkipped?: boolean }> {
  const parsed = publishNowSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid publish request." };
  }

  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("publish-now:" + ctx.workspaceId, 10, 60_000);
  if (!rl.allowed) return { ok: false, error: "Too many publish attempts. Try again in a minute." };

  const db = getDb();
  const [variant] = await db
    .select({
      id: contentVariants.id,
      status: contentVariants.status,
      platform: contentVariants.platform,
    })
    .from(contentVariants)
    .where(
      and(
        eq(contentVariants.id, parsed.data.variantId),
        eq(contentVariants.contentItemId, parsed.data.itemId),
        eq(contentVariants.workspaceId, ctx.workspaceId),
      ),
    );
  if (!variant) return { ok: false, error: "Content variant not found." };
  if (variant.status !== "approved" && variant.status !== "scheduled") {
    return { ok: false, error: `Only approved or scheduled content can be published now (this variant is ${variant.status.replaceAll("_", " ")}).` };
  }
  if (variant.platform !== parsed.data.platform) {
    return { ok: false, error: "Variant platform mismatch." };
  }

  // Pre-mint the visual's signed URL with the user's session (request scope)
  // BEFORE publishing — the interactive path must not depend on the service
  // key. undefined → the service's own signing chain decides.
  const mediaUrlOverride = await premintVisualSignedUrl(ctx.workspaceId, parsed.data.itemId);

  const result = await publishNow({
    workspaceId: ctx.workspaceId,
    contentItemId: parsed.data.itemId,
    contentVariantId: parsed.data.variantId,
    platform: parsed.data.platform,
    ...(mediaUrlOverride ? { mediaUrlOverride } : {}),
  });
  if (!result.ok) return { ok: false, error: result.message };

  revalidatePath("/calendar");
  revalidatePath("/content-studio");
  revalidatePath("/");
  return {
    ok: true,
    providerPostId: result.providerPostId,
    ...(result.firstCommentSkipped ? { firstCommentSkipped: true } : {}),
  };
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
    if (!process.env.VERCEL) {
      const { getBoss, QUEUES } = await import("@/lib/jobs/boss");
      const boss = await getBoss();
      await boss.send(QUEUES.bulkGenerate, { jobId: result.jobId });
    } else {
      const { runBulkPlan } = await import("@/lib/jobs/bulk");
      void runBulkPlan(result.jobId).catch((err) => {
        console.error("[bulk-plan serverless execution failed]", err);
      });
    }
  } catch (error) {
    // If pg-boss fails or is unavailable, fallback to direct background execution
    try {
      const { runBulkPlan } = await import("@/lib/jobs/bulk");
      void runBulkPlan(result.jobId).catch((err) => {
        console.error("[bulk-plan fallback execution failed]", err);
      });
    } catch {
      const msg = error instanceof Error ? error.message : "Queue unavailable";
      const db = getDb();
      await db.update(jobs).set({ status: "failed", error: msg, updatedAt: new Date() }).where(eq(jobs.id, result.jobId));
      return { ok: false, error: "Could not queue the bulk plan: " + msg };
    }
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





