"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { generateText } from "ai";
import { getDb } from "@/db";
import { campaigns, campaignItems, jobs } from "@/db/schema";
import { AIConfigError } from "@/lib/ai/provider";
import { getWorkspaceTextModel } from "@/lib/ai/config";
import { AI_GENERATION_TIMEOUT_MS } from "@/lib/ai/content";
import { rateLimit } from "@/lib/security/rate-limit";
import { getActiveContext } from "@/lib/workspace";

export type ActionResult = { ok: true } | { ok: false; error: string };

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  goal: z.string().trim().max(300).optional().or(z.literal("")),
  offer: z.string().trim().max(500).optional().or(z.literal("")),
  audience: z.string().trim().max(500).optional().or(z.literal("")),
  durationDays: z.number().int().min(3).max(14).default(7),
  platforms: z.array(z.enum(["facebook", "instagram"])).min(1),
  cta: z.string().trim().max(300).optional().or(z.literal("")),
});

const arcSchema = z.array(z.object({ dayIndex: z.number().int().min(1), theme: z.string().min(3).max(200) }));

const DEFAULT_ARC = [
  "Announcement — introduce the offer with excitement",
  "Problem — the pain the offer solves",
  "Benefits — what changes for the customer",
  "Demonstration — show it in action",
  "Social proof — results and testimonials",
  "Urgency — why now (limited availability)",
  "Final reminder — last call",
];

export async function startCampaignAction(input: {
  name: string;
  goal?: string;
  offer?: string;
  audience?: string;
  durationDays?: number;
  platforms: ("facebook" | "instagram")[];
  cta?: string;
}): Promise<ActionResult & { campaignId?: string; note?: string }> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("campaign-start:" + ctx.workspaceId, 3, 10 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Too many campaign starts. Try again in a few minutes." };

  const parsed = createSchema.safeParse({
    name: input.name,
    goal: input.goal ?? "",
    offer: input.offer ?? "",
    audience: input.audience ?? "",
    durationDays: input.durationDays ?? 7,
    platforms: input.platforms,
    cta: input.cta ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  // Workspace-isolated model resolution.
  let model;
  try {
    model = (await getWorkspaceTextModel(ctx.workspaceId, "campaign")).model;
  } catch (error) {
    const detail = error instanceof AIConfigError ? error.detail : "AI is not configured for this workspace.";
    return { ok: false, error: detail };
  }

  const db = getDb();

  // AI builds the day-by-day arc.
  let themes: { dayIndex: number; theme: string }[] = [];
  try {
    const res = await generateText({
      model,
      prompt: `Design a ${d.durationDays}-day social media campaign arc.
Campaign: ${d.name}
Goal: ${d.goal || "awareness + conversions"}
Offer: ${d.offer || "(not specified)"}
Audience: ${d.audience || "(brand's audience)"}
CTA: ${d.cta || "(brand default)"}
Days: one entry per day 1..${d.durationDays}. Classic arc: announcement, problem, benefits, demonstration, social proof, urgency, final reminder (adapt to the duration).
Reply with ONLY a JSON array: [{"dayIndex":1,"theme":"..."},...]`,
      maxOutputTokens: 2048,
      // Bounded: a stalled provider request aborts instead of hanging the action.
      abortSignal: AbortSignal.timeout(AI_GENERATION_TIMEOUT_MS),
      maxRetries: 1,
    });
    const stripped = res.text.replace(/```json|```/g, "").trim();
    const start = stripped.indexOf("[");
    const end = stripped.lastIndexOf("]");
    const parsedArc = arcSchema.safeParse(JSON.parse(stripped.slice(start, end + 1)));
    if (parsedArc.success) themes = parsedArc.data;
  } catch {
    // fall through to default arc
  }
  let usedDefaultArc = false;
  if (themes.length === 0) {
    usedDefaultArc = true;
    themes = DEFAULT_ARC.slice(0, d.durationDays).map((theme, i) => ({ dayIndex: i + 1, theme }));
  }

  const [campaign] = await db
    .insert(campaigns)
    .values({
      workspaceId: ctx.workspaceId,
      name: d.name,
      goal: d.goal || null,
      offer: d.offer || null,
      audience: d.audience || null,
      durationDays: d.durationDays,
      platforms: d.platforms,
      cta: d.cta || null,
      status: "generating",
      createdBy: ctx.userId,
    })
    .returning();

  await db.insert(campaignItems).values(
    themes.map((t) => ({
      campaignId: campaign.id,
      workspaceId: ctx.workspaceId,
      dayIndex: t.dayIndex,
      theme: t.theme,
    })),
  );

  const [job] = await db
    .insert(jobs)
    .values({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      type: "campaign",
      status: "queued",
      total: themes.length,
      input: { campaignId: campaign.id },
    })
    .returning();

  await db.update(campaigns).set({ jobId: job.id }).where(eq(campaigns.id, campaign.id));

  try {
    if (!process.env.VERCEL) {
      const { getBoss, QUEUES } = await import("@/lib/jobs/boss");
      const boss = await getBoss();
      await boss.send(QUEUES.campaignGenerate, { campaignId: campaign.id, jobId: job.id });
    } else {
      const { generateCampaign } = await import("@/lib/jobs/workflows");
      void generateCampaign(campaign.id).catch((err) => {
        console.error("[campaign serverless execution failed]", err);
      });
    }
  } catch (error) {
    try {
      const { generateCampaign } = await import("@/lib/jobs/workflows");
      void generateCampaign(campaign.id).catch((err) => {
        console.error("[campaign fallback execution failed]", err);
      });
    } catch {
      console.warn("[campaign dispatch]", error);
    }
  }

  revalidatePath("/campaigns");
  return {
    ok: true,
    campaignId: campaign.id,
    note: usedDefaultArc ? "AI arc generation failed — using the standard campaign arc instead." : undefined,
  };
}

export async function cancelCampaignAction(campaignId: string): Promise<ActionResult> {
  const ctx = await getActiveContext("workspace:manage");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const db = getDb();
  await db
    .update(campaigns)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.workspaceId, ctx.workspaceId)));
  revalidatePath("/campaigns");
  return { ok: true };
}
