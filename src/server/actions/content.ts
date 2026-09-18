"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { contentItems, contentVariants, publishingJobs, visualAssets } from "@/db/schema";
import { editContent } from "@/lib/content/edit";

import { generateAndPersistContent } from "@/lib/ai/content";
import { approveItem, rejectItem, archiveItem, getItem, transitionItem } from "@/lib/content/lifecycle";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveContext } from "@/lib/workspace";
import {
  DEFAULT_SOFT_DELETE_GRACE_HOURS,
  queueMediaCleanup,
} from "@/lib/media/lifecycle";

export type ActionResult = { ok: true } | { ok: false; error: string };

const createContentSchema = z.object({
  topic: z.string().trim().min(4, "Topic is too short").max(500),
  objective: z.string().trim().max(300).optional().or(z.literal("")),
  platforms: z.array(z.enum(["facebook", "instagram"])).min(1),
  preferredFormat: z.enum(["single_image", "carousel", "reel", "story", "text_post"]).optional(),
});

export async function createContentAction(input: {
  topic: string;
  objective?: string;
  platforms: ("facebook" | "instagram")[];
  preferredFormat?: "single_image" | "carousel" | "reel" | "story" | "text_post";
}): Promise<ActionResult & { itemId?: string; qaScore?: number }> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("content:" + ctx.workspaceId, 10, 10 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Generation limit reached. Try again in a few minutes." };

  const parsed = createContentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const { ensureDefaultPillars } = await import("@/lib/content/pillars");
    await ensureDefaultPillars(ctx.workspaceId);
    const { itemId, qa } = await generateAndPersistContent({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      input: {
        topic: parsed.data.topic,
        objective: parsed.data.objective || null,
        platforms: parsed.data.platforms,
        preferredFormat: parsed.data.preferredFormat ?? null,
      },
    });
    revalidatePath("/content-studio");
    revalidatePath("/");
    return { ok: true, itemId, qaScore: qa.score };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    return { ok: false, error: message === "CONFIGURATION_REQUIRED" ? "AI is not configured for this workspace — add your provider + API key in Workspace Settings." : message };
  }
}

export async function setContentStatusAction(
  itemId: string,
  status: "ready_for_review" | "approved" | "archived" | "draft",
): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  try { await transitionItem(ctx.workspaceId, itemId, status); }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not change status." }; }

  revalidatePath("/content-studio");
  revalidatePath("/");
  return { ok: true };
}

export async function updateVariantCaptionAction(
  variantId: string,
  caption: string,
): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  if (caption.trim().length === 0 || caption.length > 3000) {
    return { ok: false, error: "Caption must be 1-3000 characters." };
  }

  const db = getDb();
  const [variant] = await db.select().from(contentVariants).where(and(eq(contentVariants.id, variantId), eq(contentVariants.workspaceId, ctx.workspaceId)));
  if (!variant) return { ok: false, error: "Variant not found." };
  try { await editContent(ctx, { itemId: variant.contentItemId, variants: [{ variantId, caption }] }); }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not save caption." }; }

  revalidatePath("/content-studio");
  return { ok: true };
}

export async function updateReviewFieldAction(
  variantId: string,
  field: "firstComment" | "visualConcept" | "slidePrompt",
  value: string,
  slideIndex?: number,
): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = z.object({ variantId: z.string().uuid(), field: z.enum(["firstComment", "visualConcept", "slidePrompt"]),
    value: z.string().max(10000), slideIndex: z.number().int().min(0).max(19).optional() }).safeParse({ variantId, field, value, slideIndex });
  if (!parsed.success) return { ok: false, error: "Invalid review field." };
  if (field === "firstComment" && value.length > 2200) return { ok: false, error: "First comment must be at most 2200 characters." };
  try {
    const db = getDb();
    const [variant] = await db.select().from(contentVariants).where(and(eq(contentVariants.id, variantId), eq(contentVariants.workspaceId, ctx.workspaceId)));
    if (!variant) throw new Error("Variant not found.");
    if (field === "visualConcept") await editContent(ctx, { itemId: variant.contentItemId, visualConcept: value });
    else if (field === "firstComment") await editContent(ctx, { itemId: variant.contentItemId, variants: [{ variantId, firstComment: value }] });
    else {
      const slides = (variant.slides ?? []) as { index: number }[];
      const position = slides.findIndex(slide => slide.index === slideIndex);
      if (position < 0) throw Error("Carousel slide not found.");
      await editContent(ctx, { itemId: variant.contentItemId, variants: [{ variantId, slideEdits: [{ slideNumber: position + 1, visualPrompt: value }] }] });
    }
    revalidatePath("/content-studio");
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not save review field." }; }
}

export async function deleteContentAction(itemId: string): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const db = getDb();
  // Soft-delete path: instead of immediately removing Storage objects, we
  // drop the post row, mark the visual_assets rows for cleanup (ref count
  // decremented), and queue each storage path for purging after the
  // configured grace period. The published content is part of the delivery
  // history and is still rejected (archive instead).
  let queuedPaths: Array<{ path: string; bytes: number; rowId: string }> = [];
  try {
    queuedPaths = await db.transaction(async tx => {
      const [item] = await tx.select().from(contentItems)
        .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, ctx.workspaceId)))
        .for("update");
      if (!item) throw new Error("Content item not found.");
      const active = await tx.select({ id: publishingJobs.id }).from(publishingJobs).where(and(
        eq(publishingJobs.contentItemId, itemId),
        eq(publishingJobs.status, "processing"),
      ));
      if (active.length > 0 || item.status === "scheduled") {
        throw new Error("Unschedule this post and wait for active publishing to finish before deleting it.");
      }
      if (item.status === "published") {
        throw new Error("Published content is part of your delivery history and cannot be deleted. Archive it instead.");
      }
      const media = await tx
        .select({ id: visualAssets.id, path: visualAssets.storagePath, meta: visualAssets.meta })
        .from(visualAssets)
        .where(and(eq(visualAssets.contentItemId, itemId), eq(visualAssets.workspaceId, ctx.workspaceId)))
        .for("update");
      // Decrement ref count, mark soft-deleted, set eligibility. Deleting the
      // contentItems row cascades visual_assets.contentItemId to NULL? No —
      // visual_assets.contentItemId is NOT NULL + CASCADE, so the row gets
      // deleted along with the post. We don't want that: we want the visual
      // rows to live until the cleanup worker purges them. So we keep the
      // post row existence intact long enough to read storage paths, then
      // soft-delete the visual rows in the same transaction.
      // Strategy: delete the content_items row FIRST (cascade deletes
      // visual_assets). That defeats our lifecycle. Instead, we delete
      // content_items but bypass the FK cascade by deleting visual_assets
      // ourselves BEFORE the post row. That preserves our planned
      // cleanup-queue inserts.
      //
      // Concretely:
      //   1. Collect visual_assets rows with metadata.
      //   2. Delete content_items + content_variants (CASCADE clears
      //      visual_assets in turn, but at this point we have already
      //      queued every path for cleanup in step 3 below).
      //   3. Insert cleanup queue rows for each path; the worker will
      //      purge Storage at grace_until.
      //
      // Because visual_assets is FK-CASCADE from content_items, deleting
      // the post would also delete the visual rows. We want them gone
      // from the DB RIGHT NOW (otherwise the post deletion leaves dangling
      // visual rows pointing at a non-existent contentItemId). The cleanup
      // queue row + storage path is enough to know what to delete later.
      const txPaths = media.map(m => {
        const meta = (m.meta ?? {}) as { sizeBytes?: number };
        return { path: m.path, bytes: typeof meta.sizeBytes === "number" ? meta.sizeBytes : 0, rowId: m.id };
      });
      await tx.delete(contentItems).where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, ctx.workspaceId)));
      return txPaths;
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete content." };
  }

  // Outside the transaction: queue the storage paths for cleanup. Each
  // cleanup row references the storage path and the workspace; the worker
  // resolves it against Storage + cleans up. We use the post-deletion
  // workspace + actor (the user who clicked Delete) as the queue owner.
  if (queuedPaths.length > 0) {
    for (const p of queuedPaths) {
      try {
        await queueMediaCleanup({
          workspaceId: ctx.workspaceId,
          storagePath: p.path,
          sourceTable: "visual_assets",
          sourceRowId: p.rowId,
          bytes: p.bytes,
          reason: "post_deleted",
          graceHours: DEFAULT_SOFT_DELETE_GRACE_HOURS,
          createdBy: ctx.userId,
        });
      } catch (error) {
        // A failed queue insert means we'll leave the storage object on
        // the server — not ideal, but not corrupting. Logged for follow-up.
        console.error("[content-delete] failed to queue media cleanup", error);
      }
    }
  }

  revalidatePath("/content-studio");
  revalidatePath("/");
  return { ok: true };
}




export async function approveContentAction(itemId: string): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const item = await getItem(ctx.workspaceId, itemId);
  if (!item) return { ok: false, error: "Content item not found." };
  if (!["ready_for_review", "rejected"].includes(item.status)) {
    return { ok: false, error: "Only content waiting for review can be approved." };
  }
  try { await approveItem(ctx.workspaceId, itemId); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Approval failed." }; }
  revalidatePath("/content-studio");
  return { ok: true };
}

export async function rejectContentAction(itemId: string, reason?: string): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const item = await getItem(ctx.workspaceId, itemId);
  if (!item) return { ok: false, error: "Content item not found." };
  if (item.status === "published" || item.status === "scheduled") {
    return { ok: false, error: "Published or scheduled content cannot be rejected — unschedule first." };
  }
  try { await rejectItem(ctx.workspaceId, itemId, reason ?? null); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Rejection failed." }; }
  revalidatePath("/content-studio");
  return { ok: true };
}

export async function regenerateContentAction(itemId: string): Promise<ActionResult & { newItemId?: string }> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const item = await getItem(ctx.workspaceId, itemId);
  if (!item) return { ok: false, error: "Content item not found." };
  try {
    const created = await generateAndPersistContent({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      input: {
        topic: item.topic,
        objective: item.objective,
        platforms: ["facebook", "instagram"],
        preferredFormat: item.format,
      },
    });
    revalidatePath("/content-studio");
    await archiveItem(ctx.workspaceId, itemId);
    return { ok: true, newItemId: created.itemId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Regeneration failed";
    return { ok: false, error: message === "CONFIGURATION_REQUIRED" ? "AI is not configured for this workspace — add your provider + API key in Workspace Settings." : message };
  }
}
