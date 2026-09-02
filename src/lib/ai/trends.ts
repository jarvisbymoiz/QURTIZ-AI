import "server-only";

import { z } from "zod";
import { generateObject } from "ai";
import { getDb } from "@/db";
import { brandMemory } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { summarizeBrandBrain } from "@/lib/ai/brand-summary";
import { brands } from "@/db/schema";
import { AIConfigError } from "@/lib/ai/provider";
import { getWorkspaceTextModel } from "@/lib/ai/config";

export const trendsSchema = z.object({
  trendingTopics: z.array(z.object({
    topic: z.string().max(160),
    why: z.string().max(240).default(""),
  })).max(5),
  visualDirections: z.array(z.object({
    direction: z.string().max(160),
    style: z.string().max(240).default(""),
  })).max(5),
  hookIdeas: z.array(z.string().max(200)).max(5),
});
export type Trends = z.infer<typeof trendsSchema>;

/**
 * Structured trend suggestions via grounded search when available;
 * falls back to AI-knowledge suggestions, clearly labeled by the caller.
 */
export async function suggestTrends(ctx: { workspaceId: string; niche?: string }): Promise<
  | { ok: true; trends: Trends; sourced: boolean }
  | { ok: false; reason: string; message: string }
> {
  // Workspace-isolated: resolves THIS workspace's text model.
  let resolved;
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
    .limit(30);

  const schema = trendsSchema;
  const prompt = `Brand: ${summarizeBrandBrain(brand ?? null)}
Brand memory: ${memories.map((m) => m.content).join("; ") || "(none)"}
Niche focus: ${ctx.niche || "the brand's general niche"}

Produce structured suggestions: 3-5 trending topics relevant to this brand, 3-5 visual directions matching its visual identity, 3-5 scroll-stopping hook ideas.
Reply ONLY with JSON: {"trendingTopics":[{"topic","why"}],"visualDirections":[{"direction","style"}],"hookIdeas":["..."]}`;

  // Gemini-only live grounding with the workspace's own key/model; other
  // providers fall through honestly to AI-knowledge suggestions.
  let sourced = false;
  let pre = "";

  if (resolved.provider === "gemini") {
    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + resolved.modelId + ":generateContent",
        {
          method: "POST",
          headers: { "x-goog-api-key": resolved.apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt + "\nUse live web search before answering." }] }],
            tools: [{ google_search: {} }],
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (res.ok) {
        const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        pre = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text).filter(Boolean).join("\n").slice(0, 4000);
        sourced = true;
      }
    } catch {
      // fall through to non-grounded
    }
  }

  const finalPrompt = pre
    ? prompt + "\n\nLive search context (use it):\n" + pre
    : prompt + "\n\nNote: no live search available — base suggestions on your knowledge and label nothing as live data.";

  const result = await generateObject({ model, schema, prompt: finalPrompt, maxOutputTokens: 2048 });
  return { ok: true, trends: result.object, sourced };
}
