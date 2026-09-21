"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { researchItems } from "@/db/schema";
import { researchTopics } from "@/lib/ai/research";
import { generateAndPersistContent } from "@/lib/ai/content";
import { getActiveContext } from "@/lib/workspace";
import { rateLimit } from "@/lib/security/rate-limit";

export type ActionResult = { ok: true } | { ok: false; error: string };

const runSchema = z.object({
  niche: z.string().trim().min(4, "Describe your niche or topic (min 4 chars)").max(300),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function runResearchAction(input: {
  niche: string;
  notes?: string;
}): Promise<ActionResult & { count?: number; sourced?: boolean; note?: string }> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("research:" + ctx.workspaceId, 6, 10 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Research limit reached. Try again in a few minutes." };

  const parsed = runSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const result = await researchTopics({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      niche: parsed.data.niche,
      notes: parsed.data.notes || null,
    });
    if (!result.ok) return { ok: false, error: result.message };
    revalidatePath("/research-lab");
    revalidatePath("/");
    return { ok: true, count: result.count, sourced: result.sourced, note: result.note };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research failed";
    return { ok: false, error: message === "CONFIGURATION_REQUIRED" ? "AI is not configured for this workspace — add your provider + API key in Workspace Settings." : message };
  }
}

const STATUS_VALUES = ["new", "saved", "converted", "dismissed"] as const;

export async function setResearchStatusAction(id: string, status: (typeof STATUS_VALUES)[number]): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!STATUS_VALUES.includes(status)) return { ok: false, error: "Invalid status." };

  const db = getDb();
  await db
    .update(researchItems)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(researchItems.id, id), eq(researchItems.workspaceId, ctx.workspaceId)));

  revalidatePath("/research-lab");
  return { ok: true };
}

export async function createContentFromResearchAction(itemId: string): Promise<ActionResult & { contentItemId?: string }> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const db = getDb();
  const [item] = await db
    .select()
    .from(researchItems)
    .where(and(eq(researchItems.id, itemId), eq(researchItems.workspaceId, ctx.workspaceId)));
  if (!item) return { ok: false, error: "Research item not found." };

  const formats = item.recommendedFormats ?? [];
  const preferred = formats.includes("carousel")
    ? "carousel"
    : formats.includes("reel")
      ? "reel"
      : formats.includes("single_image")
        ? "single_image"
        : undefined;

  try {
    const { itemId: contentItemId } = await generateAndPersistContent({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      input: {
        topic: item.topic,
        objective: `Opportunity ${item.scores && typeof item.scores === "object" && "overall" in item.scores ? `${(item.scores as Record<string, number>).overall}/10` : ""}`.trim(),
        platforms: ["facebook", "instagram"],
        preferredFormat: preferred as "carousel" | "reel" | "single_image" | undefined,
      },
    });
    await db
      .update(researchItems)
      .set({ status: "converted", updatedAt: new Date() })
      .where(and(eq(researchItems.id, itemId), eq(researchItems.workspaceId, ctx.workspaceId)));
    await db
      .update((await import("@/db/schema")).contentItems)
      .set({ researchItemId: itemId })
      .where(eq((await import("@/db/schema")).contentItems.id, contentItemId));

    revalidatePath("/research-lab");
    revalidatePath("/content-studio");
    return { ok: true, contentItemId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Content generation failed";
    return { ok: false, error: message === "CONFIGURATION_REQUIRED" ? "AI is not configured for this workspace — add your provider + API key in Workspace Settings." : message };
  }
}



import { suggestTrends } from "@/lib/ai/trends";

export async function suggestTrendsAction(input: { niche?: string }): Promise<
  { ok: true; sourced: boolean; trends: unknown } | { ok: false; error: string }
> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  try {
    const result = await suggestTrends({ workspaceId: ctx.workspaceId, userId: ctx.userId, niche: input.niche });
    if (!result.ok) return { ok: false, error: result.message };
    return { ok: true, sourced: result.sourced, trends: result.trends };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Trend suggestion failed" };
  }
}
