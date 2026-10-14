"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { contentItems, contentVariants, publishingJobs, visualAssets, mediaCleanupQueue } from "@/db/schema";
import { editContent } from "@/lib/content/edit";

import { generateAndPersistContent } from "@/lib/ai/content";
import { prepareContentIntelligence } from "@/lib/content/intelligence";
import { approveItem, rejectItem, archiveItem, getItem, transitionItem } from "@/lib/content/lifecycle";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveContext } from "@/lib/workspace";
import {
  evaluateCleanupEligibility,
  markCleanupDone,
  recordCleanupAttempt,
} from "@/lib/media/lifecycle";

import { createServiceClient } from "@/lib/supabase/service";

export type ActionResult = { ok: true; warning?: string } | { ok: false; error: string };

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
    const signal = AbortSignal.timeout(240_000);
    const intelligence = await prepareContentIntelligence({ workspaceId: ctx.workspaceId, userId: ctx.userId, topic: parsed.data.topic, signal });
    const { itemId, qa } = await generateAndPersistContent({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      abortSignal: signal,
      input: {
        topic: parsed.data.topic,
        objective: parsed.data.objective || null,
        platforms: parsed.data.platforms,
        preferredFormat: parsed.data.preferredFormat ?? null,
        planningContext: intelligence.planningContext,
        researchContext: intelligence.researchContext,
        researchEvidence: intelligence.evidence,
      },
    });
    revalidatePath("/content-studio");
    revalidatePath("/dashboard");
    const warnings = [
      ...intelligence.evidence.warnings.map(w => `Research ${w.strategy}: ${w.reason}`),
      ...(!qa.passed ? ["Saved as a draft: quality checks need attention."] : []),
    ];
    return { ok: true, itemId, qaScore: qa.score, ...(warnings.length ? { warning: warnings.join(" · ") } : {}) };
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
  revalidatePath("/dashboard");
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
  if (!z.string().uuid().safeParse(itemId).success) return { ok: false, error: "Invalid post ID." };
  const db = getDb();
  let cleanup: Array<{ id: string; storagePath: string; sourceRowId: string | null; bytes: number }>;
  try {
    cleanup = await db.transaction(async tx => {
      const [item] = await tx.select().from(contentItems)
        .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, ctx.workspaceId))).for("update");
      if (!item) throw new Error("Content item not found.");
      const active = await tx.select({ id: publishingJobs.id }).from(publishingJobs).where(and(
        eq(publishingJobs.workspaceId, ctx.workspaceId), eq(publishingJobs.contentItemId, itemId), eq(publishingJobs.status, "processing")));
      if (active.length || item.status === "scheduled" || item.status === "generating") {
        throw new Error("Stop generation or unschedule this post and wait for active publishing to finish before deleting it.");
      }
      if (item.status === "published") throw new Error("Published content is delivery history. Archive it instead.");
      const variants = await tx.select({ status: contentVariants.status }).from(contentVariants)
        .where(and(eq(contentVariants.contentItemId, itemId), eq(contentVariants.workspaceId, ctx.workspaceId))).for("update");
      if (variants.some(variant => ["published", "scheduled", "generating"].includes(variant.status))) {
        throw new Error("A platform variant is published, scheduled or generating. Archive or unschedule it before deleting.");
      }
      const media = await tx.select().from(visualAssets)
        .where(and(eq(visualAssets.contentItemId, itemId), eq(visualAssets.workspaceId, ctx.workspaceId))).for("update");
      if (media.some(asset => !asset.storagePath.startsWith(ctx.workspaceId + "/"))) {
        throw new Error("Media ownership could not be verified. Post was not deleted.");
      }
      // Persist cleanup before cascading records away; queue failure rolls back deletion.
      const queued = media.length ? await tx.insert(mediaCleanupQueue).values(media.map(asset => ({
        workspaceId: ctx.workspaceId, storagePath: asset.storagePath, sourceTable: "visual_assets",
        sourceRowId: asset.id, sourceKind: "post_deleted", reason: "post_deleted",
        bytes: typeof (asset.meta as { sizeBytes?: number })?.sizeBytes === "number" ? (asset.meta as { sizeBytes: number }).sizeBytes : 0,
        graceUntil: new Date(0), createdBy: ctx.userId,
      }))).returning({ id: mediaCleanupQueue.id, storagePath: mediaCleanupQueue.storagePath,
        sourceRowId: mediaCleanupQueue.sourceRowId, bytes: mediaCleanupQueue.bytes }) : [];
      await tx.delete(contentItems).where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, ctx.workspaceId)));
      return queued;
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete content." };
  }
  let pendingFiles = 0;
  for (const asset of cleanup) {
    try {
      const decision = await evaluateCleanupEligibility({ sourceTable: "visual_assets", sourceRowId: asset.sourceRowId,
        workspaceId: ctx.workspaceId, storagePath: asset.storagePath });
      if (decision === "delete") {
        const { error } = await createServiceClient().storage.from("brand-assets").remove([asset.storagePath]);
        if (error && !/not\s*found/i.test(error.message)) throw new Error(error.message);
        await markCleanupDone({ queueId: asset.id, cleanedBytes: asset.bytes });
      } else if (decision === "rowonly") {
        // Shared media stays available to the other post which still owns it.
        await markCleanupDone({ queueId: asset.id, cleanedBytes: 0 });
      } else {
        pendingFiles++;
      }
    } catch (error) {
      pendingFiles++;
      try { await recordCleanupAttempt({ queueId: asset.id, errorMessage: error instanceof Error ? error.message : "Storage cleanup failed" }); }
      catch (queueError) { console.error("[content-delete] cleanup retry update failed", queueError); }
    }
  }
  revalidatePath("/content-studio");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { ok: true, ...(pendingFiles ? { warning: pendingFiles + " file(s) could not be removed yet. Cleanup is queued for retry." } : {}) };
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
