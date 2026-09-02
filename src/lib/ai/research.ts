import { generateText } from "ai";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, brandMemory, brands, researchItems } from "@/db/schema";
import { estimateCostFromUsage, AIConfigError, type ResolvedTextModel } from "@/lib/ai/provider";
import { getWorkspaceTextModel } from "@/lib/ai/config";
import { summarizeBrandBrain } from "@/lib/ai/tools";
import { overallOpportunity } from "@/lib/ai/scores";
import { topicScoresSchema } from "@/lib/ai/research-types";

const researchedTopicSchema = z.object({
  topic: z.string().min(4).max(200),
  angle: z.string().max(300).default(""),
  summary: z.string().max(1000).default(""),
  category: z.string().max(60).default("topic"),
  scores: topicScoresSchema,
  recommendedFormats: z.array(z.enum(["single_image", "carousel", "reel", "story", "text_post"])).max(4).default([]),
  sourceUrls: z.array(z.string().url()).max(3).default([]),
});
export type ResearchedTopic = z.infer<typeof researchedTopicSchema>;

function extractJson(text: string): unknown {
  const stripped = text.replace(/```json|```/g, "").trim();
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON array in model response");
  return JSON.parse(stripped.slice(start, end + 1));
}

/**
 * Gemini-only grounded web search (google_search tool) using the
 * WORKSPACE's own key + model. Returns [] for non-Gemini providers —
 * callers fall back honestly to AI-knowledge topics.
 */
async function groundedSources(prompt: string, resolved: ResolvedTextModel): Promise<{ url: string; title: string }[]> {
  if (resolved.provider !== "gemini") return [];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${resolved.modelId}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": resolved.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      candidates?: { groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[];
    };
    return (json.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
      .map((c) => ({ url: c.web?.uri ?? "", title: c.web?.title ?? "" }))
      .filter((s) => s.url);
  } catch {
    return [];
  }
}

export type ResearchResult =
  | { ok: true; sourced: boolean; note?: string; count: number }
  | { ok: false; reason: string; message: string };

/**
 * Research content opportunities for a niche. Tries live web grounding first;
 * when unavailable (quota/billing), falls back to AI-knowledge topics and
 * marks them honestly as unsourced. Every item is persisted with scores.
 */
export async function researchTopics(ctx: {
  workspaceId: string;
  userId: string;
  niche: string;
  notes?: string | null;
}): Promise<ResearchResult> {
  // Workspace-isolated: resolves THIS workspace's text model (AIConfigError
  // when unset → honest "config" result, never another tenant's key).
  let resolved: ResolvedTextModel;
  try {
    resolved = await getWorkspaceTextModel(ctx.workspaceId, "research");
  } catch (error) {
    const detail = error instanceof AIConfigError ? error.detail : "AI is not configured for this workspace.";
    return { ok: false, reason: "config", message: detail };
  }
  const model = resolved.model;

  const db = getDb();
  const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, ctx.workspaceId));
  const memories = await db
    .select()
    .from(brandMemory)
    .where(and(eq(brandMemory.workspaceId, ctx.workspaceId), eq(brandMemory.active, true)))
    .limit(40);

  const [run] = await db
    .insert(agentRuns)
    .values({ workspaceId: ctx.workspaceId, userId: ctx.userId, kind: "research", model: resolved.modelId })
    .returning();

  const system = `You are the QURTIZ AI research analyst for "${brand?.businessName ?? ctx.workspaceId}".
Business context: ${summarizeBrandBrain(brand ?? null)}
Active brand memory: ${memories.map((m) => m.content).join("; ") || "(none)"}

Find concrete, specific social-media content opportunities. Never invent source URLs.
Scores are 0-10 integers. competition is INVERTED: 10 = very low competition.
Reply with ONLY a JSON array, 6 items, each: {"topic","angle","summary","category","scores":{"trend","audience","search","competition","business","viral","conversion"},"recommendedFormats":["carousel"|"reel"|"single_image"|"text_post"|"story"],"sourceUrls":[]}
sourceUrls: ONLY real URLs you are confident exist from search results; empty array if you have none.`;

  const userPrompt = `Niche/topic to research: ${ctx.niche}
${ctx.notes ? `Extra context from the user: ${ctx.notes}` : ""}
Research content opportunities: trending angles, audience questions, content gaps, seasonal hooks.`;


  // Attempt grounded (live) research; fall back honestly when quota blocks it.
  let sourced = false;
  let note: string | undefined;
  let rawTopics: ResearchedTopic[] = [];
  // Topics whose source was auto-assigned round-robin from the niche search
  // context (real, but not verified as supporting that specific topic).
  const supplementaryTopics = new Set<string>();

  try {
    const grounded = await groundedSources(userPrompt, resolved);
    const res = await generateText({
      model,
      system,
      prompt: grounded.length > 0
        ? `${userPrompt}\n\nUse this live web context (cite only URLs from it):\n${grounded.map((s) => `- ${s.title}: ${s.url}`).join("\n")}`
        : userPrompt,
      maxOutputTokens: 4096,
    });

    try {
      await db
        .update(agentRuns)
        .set({
          status: "completed",
          inputTokens: res.usage?.inputTokens ?? null,
          outputTokens: res.usage?.outputTokens ?? null,
          costUsd: res.usage ? estimateCostFromUsage(resolved.modelId, res.usage).toFixed(6) : null,
          finishedAt: new Date(),
        })
        .where(eq(agentRuns.id, run.id));
    } catch {
      // bookkeeping only
    }

    const parsed = z.array(researchedTopicSchema).safeParse(extractJson(res.text));
    if (!parsed.success) throw new Error("Model returned malformed topics JSON");
    rawTopics = parsed.data;

    // Attach grounded sources when we actually have them.
    if (grounded.length > 0) {
      sourced = true;
      // Topics the model did not cite get a round-robin pick from the live
      // search context. That source is real web context for the niche but was
      // NOT verified as supporting THIS topic — it is labeled supplementary
      // in the UI instead of being presented as the authoritative source.
      rawTopics = rawTopics.map((t, i) => {
        if (t.sourceUrls.length > 0) return t;
        supplementaryTopics.add(t.topic);
        return { ...t, sourceUrls: [grounded[i % grounded.length].url] };
      });
      if (supplementaryTopics.size > 0) {
        note = `${supplementaryTopics.size} topic${supplementaryTopics.size === 1 ? "" : "s"} use supplementary live-web sources (picked from the niche search, not verified per topic).`;
      }
    } else {
      note =
        resolved.provider === "gemini"
          ? "Live web search unavailable on the current API plan — topics are AI-knowledge estimates without live sources. Enable billing or add a search API key for sourced research."
          : "Live web grounding requires the Google (Gemini) provider — topics are AI-knowledge estimates without live sources on your current provider.";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research failed";
    try {
      await db.update(agentRuns).set({ status: "failed", error: message, finishedAt: new Date() }).where(eq(agentRuns.id, run.id));
    } catch {}
    return { ok: false, reason: "api_error", message };
  }

  if (rawTopics.length === 0) return { ok: false, reason: "empty", message: "No topics were produced — try a more specific niche." };

  await db.insert(researchItems).values(
    rawTopics.map((t) => ({
      workspaceId: ctx.workspaceId,
      topic: t.topic,
      summary: t.angle ? `${t.angle}\n\n${t.summary}` : t.summary,
      sourceUrl: t.sourceUrls[0] ?? null,
      sourceName: t.sourceUrls[0]
        ? supplementaryTopics.has(t.topic)
          ? "supplementary search result"
          : new URL(t.sourceUrls[0]).hostname
        : sourced
          ? "web"
          : "AI knowledge",
      category: t.category,
      scores: { ...t.scores, overall: overallOpportunity(t.scores), estimated: true } as Record<string, unknown>,
      recommendedFormats: t.recommendedFormats,
      status: "new",
      createdBy: ctx.userId,
    })),
  );

  return { ok: true, sourced, note, count: rawTopics.length };
}


