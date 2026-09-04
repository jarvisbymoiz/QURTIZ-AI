import { generateObject } from "ai";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, aiInsights, brandMemory, brands, contentItems, contentVariants } from "@/db/schema";
import { estimateCostFromUsage, withRateLimitRetry } from "@/lib/ai/provider";
import { getWorkspaceTextModel } from "@/lib/ai/config";
import { summarizeBrandBrain } from "@/lib/ai/brand-summary";
import { runContentQa, type QaResult } from "@/lib/content/qa";
import { GLOBAL_AI_INSTRUCTION } from "@/lib/ai/global-instruction";
import type { ContentRulesInput } from "@/lib/validation";

/**
 * Hard ceiling for one structured AI generation call. OpenRouter free-tier
 * models can stall in provider queueing/rate caps indefinitely; without an
 * abortSignal a hung request awaits forever and the calling workflow (chat
 * tool, bulk job) sticks. Fail fast instead of hanging.
 */
export const AI_GENERATION_TIMEOUT_MS = 120_000;

export const generatedContentSchema = z.object({
  hook: z.string().describe("Scroll-stopping opening line"),
  mainCopy: z.string().describe("Core message body shared across platforms"),
  cta: z.string().describe("Call to action, consistent with brand rules"),
  firstComment: z.string().describe("A first comment the brand should post under its own content: adds hashtags/extra context/CTA link. Keep it natural, 1-2 sentences."),
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
            .array(z.object({
              text: z.string().optional().describe("Voiceover/dialogue for the scene"),
              visualDirection: z.string().optional().describe("What is shown on screen"),
              onScreenText: z.string().optional(),
              transition: z.string().optional().describe("Transition into the next scene"),
              durationSeconds: z.number().optional(),
            }))
            .max(10)
            .optional(),
          outro: z.string().optional(),
          totalDuration: z.union([z.literal(10), z.literal(20), z.literal(30), z.literal(60)]).optional(),
        })
        .describe("For reel format: complete scene-by-scene script with voiceover, visual direction, on-screen text, transitions and timing. Empty object otherwise."),
      slides: z
        .array(
          z.object({
            index: z.number().int().min(1),
            headline: z.string().max(120),
            visualPrompt: z.string().max(400),
          }),
        )
        .max(10)
        .optional()
        .describe("For carousel format: per-slide visual prompts. Omit otherwise."),
    }),
  ).min(1),
});
export type GeneratedContent = z.infer<typeof generatedContentSchema>;

export type GenerateContentInput = {
  topic: string;
  objective?: string | null;
  platforms: ("facebook" | "instagram")[];
  preferredFormat?: "single_image" | "carousel" | "reel" | "story" | "text_post" | null;
  toneOverride?: string | null;
  visualStyleHint?: string | null;
};


export function buildContentSystemPrompt(args: { brandName: string; brandSummary: string; memoryLines: string }): string {
  return `${GLOBAL_AI_INSTRUCTION}

You are the QURTIZ AI content engine for "${args.brandName}".

## Brand Brain
${args.brandSummary}

## Brand memory (must be respected)
${args.memoryLines.length > 0 ? args.memoryLines : "(none)"}

## Hard rules
1. Respect every avoided word/claim/topic strictly.
2. Match the brand voice in all copy.
3. Adapt per platform - never duplicate the same caption: Facebook favors conversation and slightly longer copy; Instagram favors strong hooks, concise captions, and save-worthy structure.
4. For reel formats, produce a scene script (hook, 3-6 scenes with on-screen text, outro).
5. Never invent statistics, testimonials, or product claims that are not in the Brand Brain.
6. Hashtags: no # symbol in the strings.
7. Always produce a firstComment (useful addition, not a duplicate of the caption).
8. Carousel variants: provide slides (3-8) each with a distinct visualPrompt describing that slide's image.
9. Reel variants: produce a complete timed script - hook, 3-6 scenes with voiceover/dialogue, visual direction, on-screen text and transitions; totalDuration must be 10, 20, 30 or 60 seconds.`;
}

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
  // Workspace-isolated resolution: the model comes from THIS workspace's
  // AI config (throws AIConfigError "CONFIGURATION_REQUIRED" when unset).
  const resolved = await getWorkspaceTextModel(ctx.workspaceId, "content");
  const model = resolved.model;

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
    .values({ workspaceId: ctx.workspaceId, userId: ctx.userId, kind: "content_generation", model: resolved.modelId })
    .returning();

  const rules = (brand?.contentRules ?? {}) as Partial<ContentRulesInput>;
  const memoryLines = memories.map((m) => `- [${m.type}] ${m.content}`).join("\n") + (strategyLine || "");

  const system = buildContentSystemPrompt({
    brandName: brand?.businessName ?? ctx.workspaceId,
    brandSummary: summarizeBrandBrain(brand ?? null),
    memoryLines,
  });

  const prompt = `Create one social media post.
Topic: ${ctx.input.topic}
Objective: ${ctx.input.objective ?? "Engagement + awareness"}
Target platforms: ${ctx.input.platforms.join(", ")}
${ctx.input.toneOverride ? `Tone override: ${ctx.input.toneOverride}` : ""}
${ctx.input.visualStyleHint ? `Visual style hint: ${ctx.input.visualStyleHint}` : ""}
${ctx.input.preferredFormat ? `Preferred format: ${ctx.input.preferredFormat}` : "Choose the best format per platform and explain nothing — just produce it."}
Produce one variant per target platform.`;

  const result = await withRateLimitRetry(() =>
    generateObject({
      model,
      schema: generatedContentSchema,
      system,
      prompt,
      // Bounded: a stalled provider request aborts instead of hanging the
      // caller forever; SDK-internal retries capped at 1 on top.
      abortSignal: AbortSignal.timeout(AI_GENERATION_TIMEOUT_MS),
      maxRetries: 1,
    }),
  );

  const usage = result.usage;
  try {
    await db
      .update(agentRuns)
      .set({
        status: "completed",
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        costUsd: usage ? estimateCostFromUsage(resolved.modelId, usage).toFixed(6) : null,
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
      firstComment: d.firstComment,
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
      // QA-gate semantics: a variant that fails QA is NOT reviewable and is
      // left in a stable terminal state (failed) until re-generated — never
      // stuck in "generating" forever.
      status: (qa.passed ? "ready_for_review" : "failed") as "ready_for_review" | "failed",
    })),
  );

  return { itemId: item.id, qa };
}
