"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { generateText } from "ai";
import { getDb } from "@/db";
import { campaigns, campaignItems, jobs } from "@/db/schema";
import { getModel } from "@/lib/ai/provider";
import { can, type Capability } from "@/lib/permissions";
import { rateLimit } from "@/lib/security/rate-limit";
import { getSessionUser, getMembership } from "@/lib/workspace";

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
}): Promise<ActionResult & { campaignId?: string }> {
  const ctx = await activeContext("brand:write");
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

  const model = getModel();
  if (!model) return { ok: false, error: "AI is not configured (GEMINI_API_KEY missing)." };

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
    });
    const stripped = res.text.replace(/```json|```/g, "").trim();
    const start = stripped.indexOf("[");
    const end = stripped.lastIndexOf("]");
    const parsedArc = arcSchema.safeParse(JSON.parse(stripped.slice(start, end + 1)));
    if (parsedArc.success) themes = parsedArc.data;
  } catch {
    // fall through to default arc
  }
  if (themes.length === 0) {
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

  const { getBoss, QUEUES } = await import("@/lib/jobs/boss");
  const boss = await getBoss();
  await boss.send(QUEUES.campaignGenerate, { campaignId: campaign.id, jobId: job.id });

  revalidatePath("/campaigns");
  return { ok: true, campaignId: campaign.id };
}

export async function cancelCampaignAction(campaignId: string): Promise<ActionResult> {
  const ctx = await activeContext("workspace:manage");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const db = getDb();
  await db
    .update(campaigns)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.workspaceId, ctx.workspaceId)));
  revalidatePath("/campaigns");
  return { ok: true };
}
