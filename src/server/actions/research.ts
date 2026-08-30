"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { researchItems } from "@/db/schema";
import { researchTopics } from "@/lib/ai/research";
import { generateAndPersistContent } from "@/lib/ai/content";
import { can, type Capability } from "@/lib/permissions";
import { getSessionUser, getMembership } from "@/lib/workspace";
import { rateLimit } from "@/lib/security/rate-limit";

export type ActionResult = { ok: true } | { ok: false; error: string };

type Ctx = { error: string } | { userId: string; workspaceId: string };

async function activeContext(capability: Capability): Promise<Ctx> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("qurtiz_workspace")?.value;
  if (!workspaceId) return { error: "No active workspace." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership) return { error: "You are not a member of this workspace." };
  if (!can(membership.role, capability)) return { error: "You do not have permission for this action." };
  return { userId: user.id, workspaceId };
}

const runSchema = z.object({
  niche: z.string().trim().min(4, "Describe your niche or topic (min 4 chars)").max(300),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function runResearchAction(input: {
  niche: string;
  notes?: string;
}): Promise<ActionResult & { count?: number; sourced?: boolean; note?: string }> {
  const ctx = await activeContext("brand:write");
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
    return { ok: false, error: error instanceof Error ? error.message : "Research failed" };
  }
}

const STATUS_VALUES = ["new", "saved", "converted", "dismissed"] as const;

export async function setResearchStatusAction(id: string, status: (typeof STATUS_VALUES)[number]): Promise<ActionResult> {
  const ctx = await activeContext("brand:write");
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
  const ctx = await activeContext("brand:write");
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
    return { ok: false, error: error instanceof Error ? error.message : "Content generation failed" };
  }
}



import { suggestTrends } from "@/lib/ai/trends";

export async function suggestTrendsAction(input: { niche?: string }): Promise<
  { ok: true; sourced: boolean; trends: unknown } | { ok: false; error: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("qurtiz_workspace")?.value;
  if (!workspaceId) return { ok: false, error: "No active workspace." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "brand:write")) return { ok: false, error: "Not allowed." };

  try {
    const result = await suggestTrends({ workspaceId, niche: input.niche });
    if (!result.ok) return { ok: false, error: result.message };
    return { ok: true, sourced: result.sourced, trends: result.trends };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Trend suggestion failed" };
  }
}
