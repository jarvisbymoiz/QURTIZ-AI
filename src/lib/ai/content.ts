import { CORE_AGENT_IDENTITY } from "./identity";
import { boundedAgentReference } from "./memory-policy";
import { retrieveAgentMemory } from "./persistent-memory";
import { generateObject, generateText, NoObjectGeneratedError, type LanguageModelUsage } from "ai";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, aiInsights, brands, contentItems, contentVariants } from "@/db/schema";
import { estimateCostFromUsage, RateLimitExceededError, withRateLimitRetry, type ResolvedTextModel } from "@/lib/ai/provider";
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

/**
 * Tolerant field helpers: weak models (OpenRouter free tier) omit fields,
 * send null, or drift on enum values. Each helper maps such input to
 * `undefined` so Zod's `.default()` applies instead of failing the whole
 * object during validation.
 */
function tolerantString(defaultValue: string) {
  return z.preprocess(
    (v) => (typeof v === "string" ? v : undefined),
    z.string().default(defaultValue),
  );
}

function tolerantStringArray(defaultValue: string[]) {
  return z.preprocess(
    (v) => (Array.isArray(v) ? v : undefined),
    z.array(z.string()).default(defaultValue),
  );
}

const CONTENT_FORMATS = ["single_image", "carousel", "reel", "story", "text_post"] as const;

/**
 * Copywriting craft rules for captions — shared by all generation paths so
 * captions read like a strong platform-native copywriter wrote them:
 * audience-first, specific to the Brand Brain, and free of filler clichés.
 */
const CAPTION_CRAFT_RULES = `
## Caption craft (write like the brand's best copywriter, not a content bot)
1. Lead with the audience: open on a pain, desire, objection or outcome the target market actually feels (use the audience data in Brand Brain). Never open with the brand talking about itself.
2. Be specific: use the brand's real offers, products, services, pricing, locations and results when relevant — specifics convert, vagueness does not.
3. Structure every caption: scroll-stopping hook (≤12 words, earns the "more") → short value body (story/benefit/proof in tight lines, generous line breaks) → one clear CTA that matches the objective.
4. CTA intent: match the objective exactly — sales/leads push to the offer, WhatsApp, website or contact from Brand Brain; engagement asks a real question people can answer in one line.
5. Human rhythm: contractions, short sentences, active verbs, one idea per line. No corporate filler, no exclamation-stacking, no emoji walls (0-3 emojis max, purposeful).
6. NEVER use generic openers or clichés: "Exciting news", "Check this out", "We are thrilled", "Don't miss out", "Level up", "Game changer", "Unlock", "Introducing".
7. Platform fit: Instagram = strong first line above the fold, scannable structure, save/share-worthy framing, 3-8 focused hashtags; Facebook = warmer conversational tone, can run longer, 0-3 hashtags, URL/phone in first comment when promotion-heavy.
8. Hashtags are specific to the niche + locality + offer (never #instagood-style filler).
9. The firstComment adds something real: the link, the phone/WhatsApp, extra hashtags, or a reply-hook — never repeats the caption.`;

/**
 * Creative-direction bar for visual prompts — turns the old one-liner
 * "description of the visual" into a designer-executable brief.
 */
const VISUAL_DIRECTION_BAR = `
## Visual direction bar (visualConcept + slide prompts)
Write the visualConcept as a professional creative-direction brief a designer could execute without asking questions. Cover, where applicable:
- overall creative concept and visual storytelling (ONE clear idea, readable in under 2 seconds at feed size)
- platform + format awareness: aspect ratio and, for carousels, slide count and narrative arc
- layout & composition, and the text hierarchy (what the eye sees first → second → third)
- the EXACT headline/copy and CTA text that must appear in the design (never the full caption)
- typography direction (e.g. oversized serif headline + small sans support)
- brand colors, background style, design theme and mood
- icon/graphic style (one consistent visual language)
- CTA placement, and product/offer/pricing presentation where relevant
- trust highlights (guarantees, ratings, delivery) when the offer needs reassurance
- WhatsApp/contact/website details from Brand Brain when the objective is promotional
- a reserved clean space for the logo (the real logo is composited later — never draw one)
- what to avoid (no garbled text, no logos, no watermarks, no clutter)
Length: 4-8 dense, specific sentences. Never emit a shapeless one-liner like "A 5-slide carousel about X".`;

/**
 * Format is mapped AFTER parse: models drift on format naming ("video",
 * "post", …) and one unknown value must not fail the whole response —
 * unknown values fall back to "single_image" here, so post-parse the field
 * is always a valid DB enum value.
 */
function tolerantFormat() {
  return z.preprocess(
    (v) => (CONTENT_FORMATS.includes(v as (typeof CONTENT_FORMATS)[number]) ? v : undefined),
    z.enum(CONTENT_FORMATS).default("single_image"),
  );
}

export const generatedContentSchema = z.object({
  hook: z.string().min(1).describe("Scroll-stopping opening line (≤12 words, specific, human — no clichés)"),
  mainCopy: z.string().min(1).describe("Core message body shared across platforms: audience-first, specific, structured"),
  cta: tolerantString("").describe("Call to action matching the objective, using brand contact/WhatsApp/website where relevant"),
  firstComment: tolerantString("").describe("A first comment the brand should post under its own content: adds the link, phone/WhatsApp, extra hashtags or a reply-hook. Keep it natural, 1-2 sentences."),
  hashtags: z.array(z.string()).min(1).max(15).describe("Niche/locality/offer-specific hashtags without the # symbol (no filler tags)"),
  keywords: tolerantStringArray([]).describe("SEO/keyword terms covered"),
  visualConcept: tolerantString("").describe("Full creative-direction brief for the visual: overall concept + visual storytelling, platform/format + aspect ratio, layout & composition, text hierarchy, EXACT headline and CTA text to render, typography direction, brand colors/background/mood, icon/graphic style, CTA placement, product/offer/pricing presentation, WhatsApp/contact details when promotional, reserved logo space, and what to avoid. 4-8 specific sentences — never a one-liner."),
  // Scores are intentionally unbounded in the schema and clamped in code
  // (clampAiScore): strict min/max only gives weak models another way to
  // fail validation.
  relevanceScore: z.number().optional().describe("Estimated relevance, 0-10"),
  engagementScore: z.number().optional().describe("Estimated engagement, 0-10"),
  variants: z.array(
    z.object({
      platform: z.enum(["facebook", "instagram"]),
      format: tolerantFormat(),
      caption: z.string().min(1).describe("Complete, platform-native caption: hook line + line-broken value body + matching CTA. Instagram is scannable and save-worthy; Facebook is warmer/conversational. Reels get shorter, punchier captions. Never generic filler."),
      hashtags: tolerantStringArray([]),
      cta: tolerantString(""),
      script: z
        .object({
          hook: z.string().optional(),
          scenes: z
            .array(z.object({
              text: z.string().optional().describe("Voiceover/dialogue for the scene"),
              visualDirection: z.string().optional().describe("Detailed on-screen visual direction: setting, subject action, camera move, and text treatment kept in ONE visual system across scenes"),
              onScreenText: z.string().optional(),
              transition: z.string().optional().describe("Transition into the next scene"),
              durationSeconds: z.number().optional(),
            }))
            .max(10)
            .optional(),
          outro: z.string().optional(),
          totalDuration: z.union([z.literal(10), z.literal(20), z.literal(30), z.literal(60)]).optional(),
        })
        .optional()
        .describe("For reel format: complete scene-by-scene script with voiceover, visual direction, on-screen text, transitions and timing. Empty object otherwise."),
      slides: z
        .array(
          z.object({
            index: z.number().int().min(1),
            headline: z.string().max(120).describe("Exact headline text rendered on this slide"),
            visualPrompt: z.string().max(1200).describe("Detailed art direction for THIS slide: exact slide text, composition/layout, shared design system (same palette/typography/motif/margins as the set), icon/graphic treatment, mood. 2-4 specific sentences, distinct from other slides; the final slide centers the CTA."),
          }),
        )
        .max(10)
        .optional()
        .describe("For carousel format: per-slide visual prompts in ONE consistent design system with a clear narrative arc (hook cover → distinct value slides → CTA closer). Omit otherwise."),
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

/* ── Response parsing: lenient extract → parse → validate ──────────────── */

/**
 * Response-shape diagnostics for a model response that could not be turned
 * into valid content. Deliberately excludes the raw model text — it can be
 * large and must never leak into tool results or logs.
 */
export type ContentParseDiagnostics = {
  rawLength: number;
  hadFence: boolean;
  hadBraces: boolean;
  issues: string;
};

/**
 * Thrown when the primary structured-output call AND both bounded fallbacks
 * fail to produce a valid GeneratedContent. Carries only a short
 * response-shape summary — never the full model text.
 */
export class AIContentParseError extends Error {
  readonly diagnostics: ContentParseDiagnostics;
  constructor(diagnostics: ContentParseDiagnostics) {
    super(
      `The AI model's response could not be parsed into a valid post even after retries ` +
        `(raw length ${diagnostics.rawLength}, ${diagnostics.hadFence ? "markdown-fenced" : "unfenced"}, ` +
        `${diagnostics.hadBraces ? "contained a JSON object" : "no JSON object"}): ${diagnostics.issues}`,
    );
    this.name = "AIContentParseError";
    this.diagnostics = diagnostics;
  }
}

/**
 * Pull a brace-delimited JSON candidate out of raw model output: strip an
 * outer markdown fence, then take the substring from the first "{" to the
 * last "}". Returns null when the text contains no brace-delimited object —
 * arbitrary prose is never handed to JSON.parse.
 */
export function extractJsonCandidate(raw: string): string | null {
  let text = raw.trim();
  // Strip an outer ```json … ``` / ``` … ``` fence; tolerate prose that
  // follows the closing fence.
  const fenced = text.match(/^```[a-zA-Z0-9_-]*[ \t]*\r?\n([\s\S]*?)\r?\n```/);
  if (fenced) text = fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last <= first) return null;
  return text.slice(first, last + 1);
}

/**
 * Clamp an AI-estimated score onto the app's 0–10 scale — the Studio UI
 * renders these as "X/10" (studio-client.tsx, post-workspace.tsx) and the
 * previous schema enforced min(0).max(10). Garbage/missing values fall back
 * to 7 instead of failing the whole item over a score.
 */
export function clampAiScore(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 7;
  return Math.max(0, Math.min(10, value));
}

/**
 * Validate an unknown value against the content schema. On success the data
 * is normalized (scores clamped) so callers never see out-of-range or
 * missing scores. Zod issues are flattened to a ≤400-char string.
 */
export function validateGeneratedContent(
  candidate: unknown,
): { ok: true; data: GeneratedContent } | { ok: false; issues: string } {
  const parsed = generatedContentSchema.safeParse(candidate);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, issues: issues.length > 400 ? `${issues.slice(0, 400)}…` : issues };
  }
  return {
    ok: true,
    data: {
      ...parsed.data,
      relevanceScore: clampAiScore(parsed.data.relevanceScore),
      engagementScore: clampAiScore(parsed.data.engagementScore),
    },
  };
}

/**
 * Lenient parse pipeline for raw model text: extract a JSON candidate, then
 * JSON.parse, then schema-validate. Lenient on purpose — weak models wrap
 * JSON in fences or prepend/append prose around it.
 */
export function parseGeneratedContentObject(
  raw: string,
): { ok: true; data: GeneratedContent } | { ok: false; issues: string } {
  const candidate = extractJsonCandidate(raw);
  if (candidate === null) {
    return { ok: false, issues: "no JSON object found in the model response" };
  }
  let value: unknown;
  try {
    value = JSON.parse(candidate);
  } catch (error) {
    return {
      ok: false,
      issues: `invalid JSON (${error instanceof Error ? error.message : "parse error"})`,
    };
  }
  return validateGeneratedContent(value);
}

/* ── Bounded generation pipeline: primary + ≤2 fallbacks ───────────────── */

/** Concise type list for the strict-JSON retry (kept in sync with the schema). */
const STRICT_JSON_SHAPE =
  "{ hook: string, mainCopy: string, cta: string, firstComment: string, hashtags: string[], " +
  "keywords: string[], visualConcept: string, relevanceScore: number, engagementScore: number, " +
  'variants: [{ platform: "facebook" | "instagram", format: "single_image" | "carousel" | "reel" | "story" | "text_post", ' +
  "caption: string, hashtags: string[], cta: string }] }";

/**
 * Structured content generation with a bounded fallback pipeline.
 *
 * For OpenAI-compatible gateways the primary `generateObject` request goes
 * out as generic JSON mode (`response_format: { type: "json_object" }`) —
 * the schema itself is only conveyed via prompt injection, so weak models
 * still answer with fenced/prose-wrapped JSON ("No object generated: could
 * not parse the response.") or JSON that fails validation ("response did
 * not match schema."). Recovery, in order:
 *   0. zero-cost rescue — run the primary's OWN raw text (attached to
 *      NoObjectGeneratedError) through the lenient parser above;
 *   1. one strict-JSON retry via generateText (same model/system/prompt);
 *   2. one repair attempt feeding back the validation issues.
 * Hard bound: primary + 2 fallback AI calls — never more. Transport-level
 * failures (429/timeout) are not parse failures and propagate unchanged;
 * withRateLimitRetry has already retried those. Never fabricates content:
 * every fallback result must pass full schema validation.
 */
async function generateContentObjectWithFallbacks(args: {
  model: ResolvedTextModel["model"];
  system: string;
  prompt: string;
  abortSignal?: AbortSignal;
}): Promise<{ object: GeneratedContent; usage: LanguageModelUsage | undefined }> {
  try {
    const result = await withRateLimitRetry(() =>
      generateObject({
        model: args.model,
        schema: generatedContentSchema,
        system: args.system,
        prompt: args.prompt,
        // Bounded: a stalled provider request aborts instead of hanging the
        // caller forever; SDK-internal retries capped at 1 on top.
        abortSignal: AbortSignal.any([AbortSignal.timeout(AI_GENERATION_TIMEOUT_MS), ...(args.abortSignal ? [args.abortSignal] : [])]),
        maxRetries: 1,
      }),
    );
    return { object: result.object, usage: result.usage };
  } catch (primaryError) {
    // Only unusable MODEL OUTPUT falls through to the fallbacks. Everything
    // else (rate limit, timeout, HTTP error) keeps its own meaning.
    if (!NoObjectGeneratedError.isInstance(primaryError)) throw primaryError;

    // Daily quota / hard-quota errors must NOT trigger another model call —
    // each retry burns the same scarce quota and the user is blocked until
    // reset regardless. Surface the actionable message immediately.
    if (primaryError instanceof RateLimitExceededError) {
      throw primaryError;
    }

    let lastRaw = primaryError.text ?? "";
    let lastIssues = "the model returned no usable structured response";

    // Step 0: the primary's raw text may itself be recoverable — the SDK's
    // parser is a strict JSON.parse, ours strips fences/prose first.
    if (lastRaw.length > 0) {
      const rescued = parseGeneratedContentObject(lastRaw);
      if (rescued.ok) return { object: rescued.data, usage: primaryError.usage };
      lastIssues = rescued.issues;
    }

    // Fallback 1: strict-JSON retry (one call, same per-call ceiling).
    const strictRetry = await withRateLimitRetry(() =>
      generateText({
        model: args.model,
        system: args.system,
        prompt: `${args.prompt}\n\nIMPORTANT: Respond with ONLY a valid JSON object — no markdown fences, no commentary — matching this shape: ${STRICT_JSON_SHAPE}`,
        abortSignal: AbortSignal.any([AbortSignal.timeout(AI_GENERATION_TIMEOUT_MS), ...(args.abortSignal ? [args.abortSignal] : [])]),
        maxRetries: 1,
      }),
    );
    const firstParse = parseGeneratedContentObject(strictRetry.text);
    if (firstParse.ok) return { object: firstParse.data, usage: strictRetry.usage };
    lastRaw = strictRetry.text;
    lastIssues = firstParse.issues;

    // Fallback 2: one repair attempt with the validation issues fed back.
    const repair = await withRateLimitRetry(() =>
      generateText({
        model: args.model,
        system: args.system,
        prompt: `This JSON failed validation: ${firstParse.issues}\nReturn the corrected JSON object only — no markdown fences, no commentary.\n\n${strictRetry.text}`,
        abortSignal: AbortSignal.any([AbortSignal.timeout(AI_GENERATION_TIMEOUT_MS), ...(args.abortSignal ? [args.abortSignal] : [])]),
        maxRetries: 1,
      }),
    );
    const repaired = parseGeneratedContentObject(repair.text);
    if (repaired.ok) return { object: repaired.data, usage: repair.usage };
    lastRaw = repair.text;
    lastIssues = repaired.issues;

    throw new AIContentParseError({
      rawLength: lastRaw.length,
      hadFence: lastRaw.includes("```"),
      hadBraces: lastRaw.includes("{") && lastRaw.includes("}"),
      issues: lastIssues,
    });
  }
}


export function buildContentSystemPrompt(args: { brandName: string; brandSummary: string; memoryLines: string; identity?: string }): string {
  return `${args.identity ?? CORE_AGENT_IDENTITY}\n\n${GLOBAL_AI_INSTRUCTION}

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
8. Carousel variants: provide slides (3-8), each with a distinct visualPrompt in ONE consistent design system (identical palette/typography/motif/margins on every slide) and a clear narrative arc: slide 1 is the hook-cover, middle slides each advance ONE distinct idea (never repetitive), the final slide lands the strongest CTA.
9. Reel variants: produce a complete timed script - hook, 3-6 scenes with voiceover/dialogue, visual direction, on-screen text and transitions; totalDuration must be 10, 20, 30 or 60 seconds.
10. Brand-aware specifics: where Brand Brain provides the brand name, colors, contact number, WhatsApp, website, pricing or offer details, weave them into the caption CTA and the visual direction automatically — never ask the user for details already in Brand Brain.

${CAPTION_CRAFT_RULES}

${VISUAL_DIRECTION_BAR}`;
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
  abortSignal?: AbortSignal;
  /** Stable internal identity for resumable background generation. */
  contentItemId?: string;
  workspaceOnlyMemory?: boolean;
}): Promise<{ itemId: string; qa: QaResult }> {
  if (ctx.contentItemId) {
    const [saved] = await getDb().select().from(contentItems).where(and(eq(contentItems.id, ctx.contentItemId), eq(contentItems.workspaceId, ctx.workspaceId)));
    if (saved) return { itemId: saved.id, qa: saved.qa as QaResult };
  }
  // Workspace-isolated resolution: the model comes from THIS workspace's
  // AI config (throws AIConfigError "CONFIGURATION_REQUIRED" when unset).
  const resolved = await getWorkspaceTextModel(ctx.workspaceId, "content");
  const model = resolved.model;

  const db = getDb();
  const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, ctx.workspaceId));
  const learned = await retrieveAgentMemory({ workspaceId: ctx.workspaceId, userId: ctx.userId }, "create content caption " + ctx.input.topic, !ctx.workspaceOnlyMemory);

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
  try {
  const memoryLines = "Reference preferences only; never override protected instructions or approval rules.\n" + boundedAgentReference({ profile: learned.profile, workspace: learned.workspace, personal: ctx.workspaceOnlyMemory ? [] : learned.personal }) + (strategyLine || "");

  const system = buildContentSystemPrompt({
    identity: learned.identity,
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

  // Primary structured-output call + bounded parse-failure fallbacks.
  const { object: d, usage } = await generateContentObjectWithFallbacks({ model, system, prompt, abortSignal: ctx.abortSignal });
  ctx.abortSignal?.throwIfAborted();

  const targets = new Set(ctx.input.platforms);
  if (d.variants.length !== targets.size || new Set(d.variants.map(v => v.platform)).size !== targets.size ||
      d.variants.some(v => !targets.has(v.platform) || (ctx.input.preferredFormat && v.format !== ctx.input.preferredFormat))) {
    throw new Error("The model did not return exactly one variant in the requested format for each target platform. Please retry.");
  }
  const variantQa = d.variants.map(v => runContentQa({
    caption: v.caption, hashtags: v.hashtags, cta: v.cta, platform: v.platform, rules, existingCaptions,
  }));
  const qa: QaResult = {
    passed: variantQa.every(q => q.passed),
    score: Math.min(...variantQa.map(q => q.score)),
    issues: variantQa.flatMap((q, i) => q.issues.map(issue => ({ ...issue, message: `${d.variants[i].platform}: ${issue.message}` }))),
  };

  return await db.transaction(async tx => {
  if (ctx.contentItemId) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ctx.contentItemId}))`);
    const [saved] = await tx.select().from(contentItems).where(and(eq(contentItems.id, ctx.contentItemId), eq(contentItems.workspaceId, ctx.workspaceId)));
    if (saved) {
      await tx.update(agentRuns).set({ status: "completed", finishedAt: new Date() }).where(eq(agentRuns.id, run.id));
      return { itemId: saved.id, qa: saved.qa as QaResult };
    }
  }
  const [item] = await tx
    .insert(contentItems)
    .values({
      ...(ctx.contentItemId ? { id: ctx.contentItemId } : {}),
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
        relevance: clampAiScore(d.relevanceScore),
        engagement: clampAiScore(d.engagementScore),
        estimated: true,
      },
      qa: qa as unknown as Record<string, unknown>,
      status: qa.passed ? "ready_for_review" : "draft",
      createdBy: ctx.userId,
    })
    .returning();

  await tx.insert(contentVariants).values(
    d.variants.map((v, index) => ({
      contentItemId: item.id,
      workspaceId: ctx.workspaceId,
      platform: v.platform,
      format: v.format,
      caption: v.caption,
      hashtags: v.hashtags,
      cta: v.cta,
      script: (v.script ?? {}) as unknown as Record<string, unknown>,
      // Persist generated carousel slides — the column exists and the visual
      // generator reads them; before this insert dropped them entirely.
      slides: v.slides ?? [],
      qa: variantQa[index] as unknown as Record<string, unknown>,
      // QA-gate semantics: a variant that fails QA is NOT reviewable and is
      // left in a stable terminal state (failed) until re-generated — never
      // stuck in "generating" forever.
      status: (variantQa[index].passed ? "ready_for_review" : "failed") as "ready_for_review" | "failed",
    })),
  );

  await tx.update(agentRuns).set({
    status: "completed", inputTokens: usage?.inputTokens ?? null, outputTokens: usage?.outputTokens ?? null,
    costUsd: usage ? estimateCostFromUsage(resolved.modelId, usage).toFixed(6) : null, finishedAt: new Date(),
  }).where(eq(agentRuns.id, run.id));
  return { itemId: item.id, qa };
  });
  } catch (error) {
    await db.update(agentRuns).set({ status: "failed", error: error instanceof Error ? error.message : "Content generation failed", finishedAt: new Date() })
      .where(eq(agentRuns.id, run.id)).catch(e => console.error("[content] Could not persist failed run", e));
    throw error;
  }
}
