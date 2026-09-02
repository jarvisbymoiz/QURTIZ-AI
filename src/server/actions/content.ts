"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { contentItems, contentVariants, publishingJobs } from "@/db/schema";
import { generateAndPersistContent } from "@/lib/ai/content";
import { approveItem, rejectItem, archiveItem, getItem } from "@/lib/content/lifecycle";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveContext } from "@/lib/workspace";

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

  const db = getDb();
  const [item] = await db
    .select({ status: contentItems.status })
    .from(contentItems)
    .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, ctx.workspaceId)));
  if (!item) return { ok: false, error: "Content item not found." };

  // Published content stays published: moving it back to a reviewable state
  // would re-enable a live post (and could re-post it). Archiving remains
  // allowed — it hides the item in-app without touching the live post.
  if (item.status === "published" && status !== "archived") {
    return { ok: false, error: "Published content cannot be moved back to a reviewable state." };
  }

  // Leaving approved/scheduled (draft, back-to-review, archive) must cancel
  // pending publish jobs — otherwise the item would still go live at its
  // scheduled time.
  const leavingPublishEnabled =
    (item.status === "approved" || item.status === "scheduled") &&
    !(["approved", "scheduled"] as readonly string[]).includes(status);
  if (leavingPublishEnabled) {
    await db
      .delete(publishingJobs)
      .where(and(
        eq(publishingJobs.contentItemId, itemId),
        eq(publishingJobs.workspaceId, ctx.workspaceId),
        eq(publishingJobs.status, "pending"),
      ));
  }

  await db
    .update(contentItems)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, ctx.workspaceId)));

  const variantStatus = status === "approved" ? "approved" : status === "archived" ? "archived" : "ready_for_review";
  await db
    .update(contentVariants)
    .set({ status: variantStatus, updatedAt: new Date() })
    .where(and(
      eq(contentVariants.contentItemId, itemId),
      eq(contentVariants.workspaceId, ctx.workspaceId),
      // A published variant (partial publish) is never flipped back.
      ne(contentVariants.status, "published"),
    ));

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
  await db
    .update(contentVariants)
    .set({ caption, updatedAt: new Date() })
    .where(and(eq(contentVariants.id, variantId), eq(contentVariants.workspaceId, ctx.workspaceId)));

  revalidatePath("/content-studio");
  return { ok: true };
}

export async function deleteContentAction(itemId: string): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const db = getDb();
  await db
    .delete(contentItems)
    .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, ctx.workspaceId)));

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
  await approveItem(ctx.workspaceId, itemId);
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
  await rejectItem(ctx.workspaceId, itemId, reason ?? null);
  revalidatePath("/content-studio");
  return { ok: true };
}

export async function regenerateContentAction(itemId: string): Promise<ActionResult & { newItemId?: string }> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const item = await getItem(ctx.workspaceId, itemId);
  if (!item) return { ok: false, error: "Content item not found." };
  await archiveItem(ctx.workspaceId, itemId);
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
    return { ok: true, newItemId: created.itemId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Regeneration failed";
    return { ok: false, error: message === "CONFIGURATION_REQUIRED" ? "AI is not configured for this workspace — add your provider + API key in Workspace Settings." : message };
  }
}
