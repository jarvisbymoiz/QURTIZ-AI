"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { generateText } from "ai";
import { getDb } from "@/db";
import {
  aiInsights,
  competitorSnapshots,
  competitors,
  contentItems,
  postMetrics,
  settings,
} from "@/db/schema";
import { getModel } from "@/lib/ai/provider";
import { sumTotals, type MetricsRow } from "@/lib/analytics/compute";
import { refreshCompetitor } from "@/lib/competitors/discovery";
import { can, type Capability } from "@/lib/permissions";
import { getSessionUser, getMembership } from "@/lib/workspace";

export type ActionResult = { ok: true } | { ok: false; error: string };

type Ctx = { error: string } | { userId: string; workspaceId: string; timezone: string };

async function activeContext(capability: Capability): Promise<Ctx> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("qurtiz_workspace")?.value;
  if (!workspaceId) return { error: "No active workspace." };
  const membership = await getMembership(user.id, workspaceId);
  if (!membership) return { error: "You are not a member of this workspace." };
  if (!can(membership.role, capability)) return { error: "You do not have permission for this action." };
  const db = getDb();
  const [ws] = await db.select({ timezone: (await import("@/db/schema")).workspaces.timezone }).from((await import("@/db/schema")).workspaces).where(eq((await import("@/db/schema")).workspaces.id, workspaceId));
  return { userId: user.id, workspaceId, timezone: ws?.timezone ?? "Asia/Karachi" };
}

const addCompetitorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  handle: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._]+$/, "Username can contain letters, numbers, dots and underscores only"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function addCompetitorAction(input: { name: string; handle: string; notes?: string }): Promise<ActionResult> {
  const ctx = await activeContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = addCompetitorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const db = getDb();
  await db.insert(competitors).values({
    workspaceId: ctx.workspaceId,
    name: parsed.data.name,
    handle: parsed.data.handle.replace("@", ""),
    notes: parsed.data.notes || null,
    platform: "instagram",
  });
  revalidatePath("/competitors");
  return { ok: true };
}

export async function removeCompetitorAction(id: string): Promise<ActionResult> {
  const ctx = await activeContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const db = getDb();
  await db.delete(competitors).where(and(eq(competitors.id, id), eq(competitors.workspaceId, ctx.workspaceId)));
  revalidatePath("/competitors");
  return { ok: true };
}

export async function refreshCompetitorAction(id: string): Promise<ActionResult> {
  const ctx = await activeContext("brand:read");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const db = getDb();
  const rows = await db
    .select()
    .from(postMetrics)
    .where(eq(postMetrics.workspaceId, ctx.workspaceId))
    .limit(100);
  const ourTotals = sumTotals(
    rows.map((r) => ({
      platform: r.platform,
      contentItemId: r.contentItemId,
      metrics: (r.metrics ?? {}) as MetricsRow["metrics"],
      postedAt: r.postedAt,
    })),
  );
  const result = await refreshCompetitor({
    workspaceId: ctx.workspaceId,
    competitorId: id,
    ourSummary: "See Brand Brain; our recent measured performance is summarized in totals below.",
    ourTotalsSummary: `${ourTotals.posts} posts, reach ${ourTotals.reach}, engagement ${ourTotals.engagement}, ER ${ourTotals.engagementRate}%`,
  });
  if (!result.ok) return { ok: false, error: result.message };
  revalidatePath("/competitors");
  return { ok: true };
}

/** Adaptive learning: derive measured strategy stats and store as strategy memory. */
export async function learnStrategyAction(): Promise<ActionResult & { summary?: string }> {
  const ctx = await activeContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const db = getDb();
  const rows = await db
    .select()
    .from(postMetrics)
    .where(eq(postMetrics.workspaceId, ctx.workspaceId))
    .limit(200);
  if (rows.length < 3) {
    return { ok: false, error: "Need at least 3 posts with synced metrics before learning." };
  }

  const items = await db
    .select({ id: contentItems.id, format: contentItems.format, topic: contentItems.topic })
    .from(contentItems)
    .where(eq(contentItems.workspaceId, ctx.workspaceId));
  const itemById = new Map(items.map((i) => [i.id, i]));

  const enriched = rows.map((r) => {
    const item = r.contentItemId ? itemById.get(r.contentItemId) : undefined;
    const m = (r.metrics ?? {}) as Record<string, number>;
    return {
      format: item?.format ?? "unknown",
      topic: item?.topic ?? "",
      engagement: (m.reach ? (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0) : 0),
      reach: m.reach ?? 0,
    };
  });

  const byFormat = new Map<string, { eng: number; posts: number }>();
  for (const e of enriched) {
    const cur = byFormat.get(e.format) ?? { eng: 0, posts: 0 };
    cur.eng += e.engagement;
    cur.posts += 1;
    byFormat.set(e.format, cur);
  }
  const formatStats = [...byFormat.entries()]
    .map(([f, v]) => `${f}: avg engagement ${(v.eng / v.posts).toFixed(1)} over ${v.posts} posts`)
    .join("; ");
  const best = [...enriched].sort((a, b) => b.engagement - a.engagement).slice(0, 3);
  const bestTopics = best.map((b) => `"${b.topic.slice(0, 60)}" (${b.engagement} engagements)`).join("; ");

  const stats = `Measured pattern summary: ${formatStats}. Best performing topics: ${bestTopics}.`;

  await db.insert(aiInsights).values({
    workspaceId: ctx.workspaceId,
    kind: "strategy",
    content: stats,
    data: { derivedFrom: rows.length } as Record<string, unknown>,
  });

  revalidatePath("/analytics");
  revalidatePath("/settings");
  return { ok: true, summary: stats };
}

const autopilotSchema = z.object({
  enabled: z.boolean(),
  requireApproval: z.boolean().default(true),
  nicheFocus: z.string().trim().max(300).optional().or(z.literal("")),
  maxPostsPerRun: z.number().int().min(1).max(3).default(1),
});

export async function updateAutopilotSettingsAction(input: {
  enabled: boolean;
  requireApproval: boolean;
  nicheFocus?: string;
  maxPostsPerRun: number;
}): Promise<ActionResult> {
  const ctx = await activeContext("workspace:manage");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = autopilotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const db = getDb();
  const existing = await db
    .select({ workspaceId: settings.workspaceId })
    .from(settings)
    .where(and(eq(settings.workspaceId, ctx.workspaceId), eq(settings.key, "autopilot")));
  if (existing.length > 0) {
    await db
      .update(settings)
      .set({ value: parsed.data as unknown as Record<string, unknown>, updatedAt: new Date() })
      .where(and(eq(settings.workspaceId, ctx.workspaceId), eq(settings.key, "autopilot")));
  } else {
    await db.insert(settings).values({
      workspaceId: ctx.workspaceId,
      key: "autopilot",
      value: parsed.data as unknown as Record<string, unknown>,
    });
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function runGrowthSynthesisAction(): Promise<ActionResult & { plan?: string }> {
  const ctx = await activeContext("brand:read");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const model = getModel();
  if (!model) return { ok: false, error: "AI is not configured (GEMINI_API_KEY missing)." };

  const db = getDb();
  const topResearch = await db
    .select({ topic: researchTopics.topic, scores: researchTopics.scores })
    .from(researchTopics)
    .where(eq(researchTopics.workspaceId, ctx.workspaceId))
    .orderBy(desc(researchTopics.createdAt))
    .limit(8);
  const competitorRows = await db
    .select({ name: competitors.name, analysis: competitorSnapshots.analysis })
    .from(competitors)
    .leftJoin(competitorSnapshots, eq(competitorSnapshots.competitorId, competitors.id))
    .where(eq(competitors.workspaceId, ctx.workspaceId))
    .orderBy(desc(competitorSnapshots.capturedAt))
    .limit(5);
  const strategyRows = await db
    .select({ content: aiInsights.content })
    .from(aiInsights)
    .where(and(eq(aiInsights.workspaceId, ctx.workspaceId), eq(aiInsights.kind, "strategy")))
    .orderBy(desc(aiInsights.createdAt))
    .limit(1);

  if (topResearch.length === 0 && competitorRows.length === 0) {
    return { ok: false, error: "Run Research and/or add competitors first — the Growth Lab synthesizes existing intelligence." };
  }

  try {
    const res = await generateText({
      model,
      prompt: `Synthesize a growth plan for this brand from the intelligence below. Produce 3-5 prioritized actions, each one line starting with "- ", referencing the actual topics/numbers. Label nothing as guaranteed.
Top research opportunities: ${JSON.stringify(topResearch)}
Competitor analyses: ${JSON.stringify(competitorRows)}
Our measured strategy: ${strategyRows[0]?.content ?? "(not enough data yet)"}`,
      maxOutputTokens: 768,
    });
    const [row] = await db
      .insert(aiInsights)
      .values({ workspaceId: ctx.workspaceId, kind: "growth_plan", content: res.text, data: {} })
      .returning();
    revalidatePath("/research-lab");
    return { ok: true, plan: row.content };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Synthesis failed" };
  }
}

// researchTopics import alias helper (table lives in research flow)
import { researchItems as researchTopics } from "@/db/schema";
