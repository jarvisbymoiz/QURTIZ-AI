"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { generateText } from "ai";
import { getDb } from "@/db";
import { aiInsights, contentItems, postMetrics } from "@/db/schema";
import { getModel, getModelId } from "@/lib/ai/provider";
import { syncInsightsForWorkspace } from "@/lib/analytics/sync";
import { bestPostingHours, groupPerformance, sumTotals, type MetricsRow } from "@/lib/analytics/compute";
import { can, type Capability } from "@/lib/permissions";
import { rateLimit } from "@/lib/security/rate-limit";
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

export async function syncInsightsAction(): Promise<ActionResult & { synced?: number; errors?: string[] }> {
  const ctx = await activeContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  try {
    const result = await syncInsightsForWorkspace(ctx.workspaceId);
    revalidatePath("/analytics");
    return {
      ok: true,
      synced: result.synced,
      errors: result.errors.length > 0 ? result.errors : undefined,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Sync failed" };
  }
}

/** Build AnalyticsRow inputs from synced metrics + linked content. */
async function buildRows(workspaceId: string, timezone: string): Promise<MetricsRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(postMetrics)
    .where(eq(postMetrics.workspaceId, workspaceId))
    .orderBy(desc(postMetrics.postedAt))
    .limit(200);

  const items = await db
    .select({ id: contentItems.id, format: contentItems.format, topic: contentItems.topic })
    .from(contentItems)
    .where(eq(contentItems.workspaceId, workspaceId));
  const itemById = new Map(items.map((i) => [i.id, i]));

  const tzFmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false });
  return rows.map((r) => {
    const item = r.contentItemId ? itemById.get(r.contentItemId) : undefined;
    return {
      platform: r.platform,
      contentItemId: r.contentItemId,
      metrics: (r.metrics ?? {}) as MetricsRow["metrics"],
      postedAt: r.postedAt,
      hourOfDay: r.postedAt ? Number(tzFmt.format(new Date(r.postedAt))) : null,
      format: item?.format ?? null,
      topic: item?.topic ?? null,
    } satisfies MetricsRow;
  });
}

export async function runPerformanceAnalysisAction(): Promise<ActionResult & { insight?: string }> {
  const ctx = await activeContext("brand:read");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("performance:" + ctx.workspaceId, 6, 10 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Analysis limit reached. Try again in a few minutes." };

  const model = getModel();
  if (!model) return { ok: false, error: "AI is not configured (GEMINI_API_KEY missing)." };

  const rows = await buildRows(ctx.workspaceId, ctx.timezone);
  if (rows.length === 0) {
    return { ok: false, error: "No synced metrics yet. Connect accounts and sync insights first." };
  }

  const totals = sumTotals(rows);
  const byFormat = groupPerformance(rows, (r) => r.format ?? "unknown");
  const byPlatform = groupPerformance(rows, (r) => r.platform);
  const hours = bestPostingHours(rows);

  const summary = {
    totals,
    byFormat: byFormat.map((g) => ({ key: g.key, ...g.totals })),
    byPlatform: byPlatform.map((g) => ({ key: g.key, ...g.totals })),
    bestHours: hours,
  };

  try {
    const res = await generateText({
      model,
      prompt: `Analyze this social media performance data and produce 4-6 concise, specific insights + recommendations.
Data (JSON): ${JSON.stringify(summary)}
Rules: reference the actual numbers; label estimates as estimates; no generic advice; format each insight as one line starting with "- ".`,
      maxOutputTokens: 1024,
    });

    const db = getDb();
    const [insight] = await db
      .insert(aiInsights)
      .values({
        workspaceId: ctx.workspaceId,
        kind: "performance",
        content: res.text,
        data: summary as unknown as Record<string, unknown>,
      })
      .returning();

    void getModelId;
    revalidatePath("/analytics");
    revalidatePath("/");
    return { ok: true, insight: insight.content };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Analysis failed" };
  }
}

export async function latestInsightAction(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("qurtiz_workspace")?.value;
  if (!workspaceId) return null;
  const membership = await getMembership(user.id, workspaceId);
  if (!membership) return null;
  const db = getDb();
  const [row] = await db
    .select({ content: aiInsights.content })
    .from(aiInsights)
    .where(and(eq(aiInsights.workspaceId, workspaceId), eq(aiInsights.kind, "performance")))
    .orderBy(desc(aiInsights.createdAt))
    .limit(1);
  return row?.content ?? null;
}
