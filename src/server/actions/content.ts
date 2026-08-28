"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { contentItems, contentVariants } from "@/db/schema";
import { generateAndPersistContent } from "@/lib/ai/content";
import { can, type Capability } from "@/lib/permissions";
import { getSessionUser, getMembership } from "@/lib/workspace";

export type ActionResult = { ok: true } | { ok: false; error: string };

const createContentSchema = z.object({
  topic: z.string().trim().min(4, "Topic is too short").max(500),
  objective: z.string().trim().max(300).optional().or(z.literal("")),
  platforms: z.array(z.enum(["facebook", "instagram"])).min(1),
  preferredFormat: z.enum(["single_image", "carousel", "reel", "story", "text_post"]).optional(),
});

type ActiveContext = { error: string } | { userId: string; workspaceId: string };

async function activeContext(capability: Capability): Promise<ActiveContext> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("qurtiz_workspace")?.value;
  if (!workspaceId) return { error: "No active workspace." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership) return { error: "You are not a member of this workspace." };
  if (!can(membership.role, capability)) {
    return { error: "You do not have permission for this action." };
  }
  return { userId: user.id, workspaceId };
}
export async function createContentAction(input: {
  topic: string;
  objective?: string;
  platforms: ("facebook" | "instagram")[];
  preferredFormat?: "single_image" | "carousel" | "reel" | "story" | "text_post";
}): Promise<ActionResult & { itemId?: string; qaScore?: number }> {
  const ctx = await activeContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

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
    return { ok: false, error: message === "CONFIGURATION_REQUIRED" ? "AI is not configured (GEMINI_API_KEY missing)." : message };
  }
}

export async function setContentStatusAction(
  itemId: string,
  status: "ready_for_review" | "approved" | "archived" | "draft",
): Promise<ActionResult> {
  const ctx = await activeContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const db = getDb();
  await db
    .update(contentItems)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, ctx.workspaceId)));

  const variantStatus = status === "approved" ? "approved" : status === "archived" ? "archived" : "ready_for_review";
  await db
    .update(contentVariants)
    .set({ status: variantStatus, updatedAt: new Date() })
    .where(and(eq(contentVariants.contentItemId, itemId), eq(contentVariants.workspaceId, ctx.workspaceId)));

  revalidatePath("/content-studio");
  revalidatePath("/");
  return { ok: true };
}

export async function updateVariantCaptionAction(
  variantId: string,
  caption: string,
): Promise<ActionResult> {
  const ctx = await activeContext("brand:write");
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
  const ctx = await activeContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const db = getDb();
  await db
    .delete(contentItems)
    .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, ctx.workspaceId)));

  revalidatePath("/content-studio");
  revalidatePath("/");
  return { ok: true };
}



