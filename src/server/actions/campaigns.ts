"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { generateText } from "ai";
import { getDb } from "@/db";
import { campaigns, campaignItems, jobs, contentVariants } from "@/db/schema";
import { manageCampaign } from "@/lib/campaigns/manage";
import { scheduleItem } from "@/lib/scheduling/engine";
import { approveItem } from "@/lib/content/lifecycle";
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
  generateContent: z.boolean().default(true),
});

const arcSchema = z.array(
  z.object({
    dayIndex: z.number().int().min(1),
    theme: z.string().min(3).max(200),
  }),
);

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
  generateContent?: boolean;
}): Promise<ActionResult & { campaignId?: string; note?: string }> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const rl = rateLimit("campaign-start:" + ctx.workspaceId, 3, 10 * 60_000);
  if (!rl.allowed)
    return {
      ok: false,
      error: "Too many campaign starts. Try again in a few minutes.",
    };

  const parsed = createSchema.safeParse({
    name: input.name,
    goal: input.goal ?? "",
    offer: input.offer ?? "",
    audience: input.audience ?? "",
    durationDays: input.durationDays ?? 7,
    platforms: input.platforms,
    cta: input.cta ?? "",
    generateContent: input.generateContent,
  });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  const d = parsed.data;

  // Workspace-isolated model resolution.
  let model;
  try {
    if (d.generateContent)
      model = (await getWorkspaceTextModel(ctx.workspaceId, "campaign")).model;
  } catch (error) {
    const detail =
      error instanceof AIConfigError
        ? error.detail
        : "AI is not configured for this workspace.";
    return { ok: false, error: detail };
  }

  const db = getDb();

  // AI builds the day-by-day arc.
  let themes: { dayIndex: number; theme: string }[] = [];
  try {
    if (!model) throw new Error("Manual campaign");
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
    const parsedArc = arcSchema.safeParse(
      JSON.parse(stripped.slice(start, end + 1)),
    );
    if (
      parsedArc.success &&
      parsedArc.data.length === d.durationDays &&
      new Set(parsedArc.data.map((day) => day.dayIndex)).size ===
        d.durationDays &&
      parsedArc.data.every((day) => day.dayIndex <= d.durationDays)
    ) {
      themes = parsedArc.data.sort((a, b) => a.dayIndex - b.dayIndex);
    }
  } catch {
    // fall through to default arc
  }
  let usedDefaultArc = false;
  if (themes.length === 0) {
    usedDefaultArc = true;
    themes = Array.from({ length: d.durationDays }, (_, i) => ({
      dayIndex: i + 1,
      theme:
        DEFAULT_ARC[
          Math.min(
            DEFAULT_ARC.length - 1,
            Math.floor((i * DEFAULT_ARC.length) / d.durationDays),
          )
        ],
    }));
  }

  const { campaign, job } = await db.transaction(async (tx) => {
    const [campaign] = await tx
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
        status: d.generateContent ? "generating" : "planning",
        createdBy: ctx.userId,
      })
      .returning();

    await tx.insert(campaignItems).values(
      themes.map((t) => ({
        campaignId: campaign.id,
        workspaceId: ctx.workspaceId,
        dayIndex: t.dayIndex,
        theme: t.theme,
      })),
    );

    const [job] = d.generateContent
      ? await tx
          .insert(jobs)
          .values({
            workspaceId: ctx.workspaceId,
            userId: ctx.userId,
            type: "campaign",
            status: d.generateContent ? "queued" : "completed",
            total: themes.length,
            input: { campaignId: campaign.id },
          })
          .returning()
      : [];

    if (job)
      await tx
        .update(campaigns)
        .set({ jobId: job.id })
        .where(eq(campaigns.id, campaign.id));
    return { campaign, job };
  });

  if (job)
    try {
      const { getBoss, QUEUES } = await import("@/lib/jobs/boss");
      const boss = await getBoss();
      const queuedId = await boss.send(QUEUES.campaignGenerate, {
        campaignId: campaign.id,
        jobId: job.id,
      });
      if (!queuedId) throw new Error("The campaign could not be queued.");
    } catch (error) {
      console.error("[campaign dispatch]", error);
      // The durable app job is also consumed by the serverless maintenance
      // runner. A pg-boss dispatch failure must not cancel this valid work.
    }

  revalidatePath("/campaigns");
  return {
    ok: true,
    campaignId: campaign.id,
    note: !d.generateContent
      ? "Campaign saved — select existing content for each day."
      : usedDefaultArc
        ? "AI arc generation failed — using the standard campaign arc instead."
        : undefined,
  };
}

export async function cancelCampaignAction(
  campaignId: string,
): Promise<ActionResult> {
  const ctx = await getActiveContext("workspace:manage");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const db = getDb();
  await db
    .update(campaigns)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.workspaceId, ctx.workspaceId),
      ),
    );
  revalidatePath("/campaigns");
  return { ok: true };
}

const managementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("edit"),
    name: z.string().trim().min(2).max(120),
    goal: z.string().trim().max(300),
    cta: z.string().trim().max(300),
  }),
  z.object({ type: z.literal("delete") }),
  z.object({ type: z.literal("retry") }),
  z.object({
    type: z.literal("link"),
    dayId: z.uuid(),
    itemId: z.uuid().nullable(),
  }),
]);
export async function manageCampaignAction(
  campaignId: string,
  operation: z.infer<typeof managementSchema>,
): Promise<ActionResult> {
  const parsed = managementSchema.safeParse(operation);
  if (!z.uuid().safeParse(campaignId).success || !parsed.success)
    return { ok: false, error: "Invalid campaign input." };
  const ctx = await getActiveContext(
    parsed.data.type === "delete" ? "workspace:manage" : "brand:write",
  );
  if ("error" in ctx) return { ok: false, error: ctx.error };
  try {
    await manageCampaign(ctx.workspaceId, campaignId, parsed.data);
    revalidatePath("/campaigns");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error && !e.message.startsWith("Failed query:") ? e.message : "Campaign update failed. Please try again or contact support.",
    };
  }
}
export async function campaignContentAction(input: {
  campaignId: string;
  dayId: string;
  type: "approve" | "schedule";
  dateIso?: string;
  timeStr?: string;
}): Promise<ActionResult> {
  const ctx = await getActiveContext("brand:write");
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (
    !z
      .object({
        campaignId: z.uuid(),
        dayId: z.uuid(),
        type: z.enum(["approve", "schedule"]),
      })
      .safeParse(input).success
  )
    return { ok: false, error: "Invalid campaign action." };
  const db = getDb();
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.id, input.campaignId),
        eq(campaigns.workspaceId, ctx.workspaceId),
      ),
    );
  const [day] = await db
    .select()
    .from(campaignItems)
    .where(
      and(
        eq(campaignItems.id, input.dayId),
        eq(campaignItems.campaignId, input.campaignId),
        eq(campaignItems.workspaceId, ctx.workspaceId),
      ),
    );
  if (
    !campaign ||
    !day?.contentItemId ||
    ["cancelled", "generating"].includes(campaign.status)
  )
    return {
      ok: false,
      error: "Campaign is unavailable or this day has no linked post.",
    };
  try {
    if (input.type === "approve")
      await approveItem(ctx.workspaceId, day.contentItemId);
    else {
      const variants = await db
        .select()
        .from(contentVariants)
        .where(
          and(
            eq(contentVariants.workspaceId, ctx.workspaceId),
            eq(contentVariants.contentItemId, day.contentItemId),
          ),
        );
      if (
        campaign.platforms.some((p) => !variants.some((v) => v.platform === p))
      )
        return {
          ok: false,
          error:
            "The linked post lacks a variant for a selected campaign platform.",
        };
      const r = await scheduleItem({
        workspaceId: ctx.workspaceId,
        itemId: day.contentItemId,
        dateIso: input.dateIso ?? "",
        timeStr: input.timeStr,
        timezone: ctx.timezone,
        platforms: campaign.platforms as ("facebook" | "instagram")[],
      });
      if (!r.ok) return { ok: false, error: r.message };
      if (r.failedVariants.length)
        return {
          ok: false,
          error:
            "Partially scheduled: " +
            r.failedVariants
              .map((v) => v.platform + ": " + v.message)
              .join("; "),
        };
    }
    ["/campaigns", "/calendar", "/content-studio", "/dashboard"].forEach((p) =>
      revalidatePath(p),
    );
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Campaign content action failed.",
    };
  }
}
