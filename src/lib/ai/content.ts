import { generateObject } from "ai";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, aiInsights, brandMemory, brands, contentItems, contentVariants } from "@/db/schema";
import { estimateCostFromUsage, getModel, getModelId } from "@/lib/ai/provider";
import { summarizeBrandBrain } from "@/lib/ai/brand-summary";
import { runContentQa, type QaResult } from "@/lib/content/qa";
import type { ContentRulesInput } from "@/lib/validation";

export const generatedContentSchema = z.object({
  hook: z.string().describe("Scroll-stopping opening line"),
  mainCopy: z.string().describe("Core message body shared across platforms"),
  cta: z.string().describe("Call to action, consistent with brand rules"),
  hashtags: z.array(z.string()).max(15).describe("Hashtags without the # symbol"),
  keywords: z.array(z.string()).max(10).describe("SEO/keyword terms covered"),
  visualConcept: z.string().describe("Description of the visual to create"),
  relevanceScore: z.number().min(0).max(10),
  engagementScore: z.number().min(0).max(10),
  variants: z.array(
    z.object({
      platform: z.enum(["facebook", "instagram"]),
      format: z.enum(["single_image", "carousel", "reel", "story", "text_post"]),
      caption: z.string().describe("Platform-adapted caption. Reels get shorter, punchier captions."),
      hashtags: z.array(z.string()).max(15),
      cta: z.string(),
      script: z
        .object({
          hook: z.string().optional(),
          scenes: z
            .array(z.object({ text: z.string(), onScreenText: z.string().optional(), durationSeconds: z.number().optional() }))
            .max(10)
            .optional(),
          outro: z.string().optional(),
        })
        .describe("For reel format: scene structure. Empty object otherwise."),
    }),
  ).min(1),
});
export type GeneratedContent = z.infer<typeof generatedContentSchema>;

export type GenerateContentInput = {
  topic: string;
  objective?: string | null;
  platforms: ("facebook" | "instagram")[];
  preferredFormat?: "single_image" | "carousel" | "reel" | "story" | "text_post" | null;
};

/**
 * Generate one content item with platform variants using the configured
 * AI provider. Persists the item + variants with QA results, and logs the
 * run with token/cost accounting. Never fabricates success: failures throw.
 */
export async function generateAndPersistContent(ctx: {
  workspaceId: string;
  userId: string;
  input: GenerateContentInput;
}): Promise<{ itemId: string; qa: QaResult }> {
  const model = getModel();
  if (!model) throw new Error("CONFIGURATION_REQUIRED");

  const db = getDb();
  const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, ctx.workspaceId));
  const memories = await db
    .select()
    .from(brandMemory)
    .where(and(eq(brandMemory.workspaceId, ctx.workspaceId), eq(brandMemory.active, true)))
    .orderBy(desc(brandMemory.createdAt))
    .limit(60);

  // Existing captions for duplicate detection.
  const existing = await db
    .select({ caption: contentItems.caption })
    .from(contentItems)
    .where(and(eq(contentItems.workspaceId, ctx.workspaceId)))
    .orderBy(desc(contentItems.createdAt))
    .limit(50);
  const existingCaptions = existing.map((e) => e.caption ?? "").filter((c) => c.length > 0);


  // Adaptive learning: inject the latest measured strategy memory.
  const [strategyRow] = await db
    .select({ content: aiInsights.content })
    .from(aiInsights)
    .where(and(eq(aiInsights.workspaceId, ctx.workspaceId), eq(aiInsights.kind, "strategy")))
    .orderBy(desc(aiInsights.createdAt))
    .limit(1);
  const strategyLine = strategyRow
    ? "\n## Measured strategy insights (from this brand\u2019s own performance data)\n" + strategyRow.content
    : "";

  const [run] = await db
    .insert(agentRuns)
    .values({ workspaceId: ctx.workspaceId, userId: ctx.userId, kind: "content_generation", model: getModelId() })
    .returning();

  const rules = (brand?.contentRules ?? {}) as Partial<ContentRulesInput>;
  const memoryLines = memories.map((m) => `- [${m.type}] ${m.content}`).join("\n") + (strategyLine || "");

  const system = `You are the QURTIZ AI content engine for "${brand?.businessName ?? ctx.workspaceId}".

## Brand Brain
${summarizeBrandBrain(brand ?? null)}

## Brand memory (must be respected)
${memoryLines.length > 0 ? memoryLines : "(none)"}

## Hard rules
1. Respect every avoided word/claim/topic strictly.
2. Match the brand voice in all copy.
3. Adapt per platform — never duplicate the same caption: Facebook favors conversation and slightly longer copy; Instagram favors strong hooks, concise captions, and save-worthy structure.
4. For reel formats, produce a scene script (hook, 3-6 scenes with on-screen text, outro).
5. Never invent statistics, testimonials, or product claims that are not in the Brand Brain.
6. Hashtags: no # symbol in the strings.`;

  const prompt = `Create one social media post.
Topic: ${ctx.input.topic}
Objective: ${ctx.input.objective ?? "Engagement + awareness"}
Target platforms: ${ctx.input.platforms.join(", ")}
${ctx.input.preferredFormat ? `Preferred format: ${ctx.input.preferredFormat}` : "Choose the best format per platform and explain nothing — just produce it."}
Produce one variant per target platform.`;

  const result = await generateObject({
    model,
    schema: generatedContentSchema,
    system,
    prompt,
  });

  const usage = result.usage;
  try {
    await db
      .update(agentRuns)
      .set({
        status: "completed",
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        costUsd: usage ? estimateCostFromUsage(getModelId(), usage).toFixed(6) : null,
        finishedAt: new Date(),
      })
      .where(eq(agentRuns.id, run.id));
  } catch {
    // bookkeeping must not fail the generation
  }

  const d = result.object;
  const qa = runContentQa({
    caption: d.variants[0]?.caption ?? d.mainCopy,
    hashtags: d.hashtags,
    cta: d.cta,
    platform: ctx.input.platforms[0] ?? "facebook",
    rules,
    existingCaptions,
  });

  const [item] = await db
    .insert(contentItems)
    .values({
      workspaceId: ctx.workspaceId,
      topic: ctx.input.topic,
      objective: ctx.input.objective ?? null,
      format: ctx.input.preferredFormat ?? d.variants[0]?.format ?? "single_image",
      hook: d.hook,
      mainCopy: d.mainCopy,
      caption: d.variants[0]?.caption ?? d.mainCopy,
      cta: d.cta,
      hashtags: d.hashtags,
      keywords: d.keywords,
      visualConcept: d.visualConcept,
      aiScores: {
        relevance: d.relevanceScore,
        engagement: d.engagementScore,
        estimated: true,
      },
      qa: qa as unknown as Record<string, unknown>,
      status: qa.passed ? "ready_for_review" : "draft",
      createdBy: ctx.userId,
    })
    .returning();

  await db.insert(contentVariants).values(
    d.variants.map((v) => ({
      contentItemId: item.id,
      workspaceId: ctx.workspaceId,
      platform: v.platform,
      format: v.format,
      caption: v.caption,
      hashtags: v.hashtags,
      cta: v.cta,
      script: v.script as unknown as Record<string, unknown>,
      qa: runContentQa({
        caption: v.caption,
        hashtags: v.hashtags,
        cta: v.cta,
        platform: v.platform,
        rules,
        existingCaptions,
      }) as unknown as Record<string, unknown>,
      status: (qa.passed ? "ready_for_review" : "generating") as "ready_for_review" | "generating",
    })),
  );

  return { itemId: item.id, qa };
}
