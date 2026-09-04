"use server";

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
import { AIConfigError } from "@/lib/ai/provider";
import { getWorkspaceTextModel } from "@/lib/ai/config";
import { AI_GENERATION_TIMEOUT_MS } from "@/lib/ai/content";
import { autopilotSettingsSchema } from "@/lib/autopilot/schema";
import { sumTotals, type MetricsRow } from "@/lib/analytics/compute";
import { refreshCompetitor } from "@/lib/competitors/discovery";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveContext } from "@/lib/workspace";

export type ActionResult = { ok: true } | { ok: false; error: string };

const addCompetitorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  handle: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._]+$/, "Username can contain letters, numbers, dots and underscores only"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function addCompetitorAction(input: { name: string; handle: string; notes?: string }): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
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
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const db = getDb();
  await db.delete(competitors).where(and(eq(competitors.id, id), eq(competitors.workspaceId, ctx.workspaceId)));
  revalidatePath("/competitors");
  return { ok: true };
}

export async function refreshCompetitorAction(id: string): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:read");
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
  const ctx = await getActiveContext("brand:write");
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

const autopilotSchema = autopilotSettingsSchema;

export async function updateAutopilotSettingsAction(input: {
  enabled: boolean;
  requireApproval: boolean;
  nicheFocus?: string;
  maxPostsPerRun: number;
  runTimes?: string[];
}): Promise<ActionResult> {
  const ctx = await getActiveContext("workspace:manage");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("autopilot:" + ctx.workspaceId, 10, 10 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Autopilot settings update limit reached. Try again in a few minutes." };

  const parsed = autopilotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  if (parsed.data.enabled && parsed.data.runTimes.length === 0) {
    return { ok: false, error: "Add at least one run time before enabling Autopilot." };
  }

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
  const ctx = await getActiveContext("brand:read");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("growth:" + ctx.workspaceId, 6, 10 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Synthesis limit reached. Try again in a few minutes." };

  // Workspace-isolated model resolution.
  let model;
  try {
    model = (await getWorkspaceTextModel(ctx.workspaceId, "growth")).model;
  } catch (error) {
    const detail = error instanceof AIConfigError ? error.detail : "AI is not configured for this workspace.";
    return { ok: false, error: detail };
  }

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
      // Bounded: a stalled provider request aborts instead of hanging the action.
      abortSignal: AbortSignal.timeout(AI_GENERATION_TIMEOUT_MS),
      maxRetries: 1,
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
