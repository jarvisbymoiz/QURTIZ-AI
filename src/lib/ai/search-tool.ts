import "server-only";

import { tool } from "ai";
import { z } from "zod";
import { searchResearch } from "@/lib/research/service";
import { RESEARCH_STRATEGY_IDS, type ResearchStrategy } from "@/lib/research/strategies";

type LogFn = (toolName: string, input: unknown, output: unknown) => Promise<void>;

/**
 * The agent's live Research tool, backed by the Qurtiz ResearchService
 * (shared project-level Brave Search integration).
 *
 * This tool is INDEPENDENT of the workspace's selected AI provider: the
 * model only calls the tool and receives results to analyze; Brave
 * authentication, caching, source prioritization, rate limits and
 * failures are handled entirely in the Qurtiz backend. Every workspace
 * (Gemini, OpenAI, Claude, OpenRouter, MiniMax, GLM, NVIDIA, custom
 * OpenAI-compatible, …) uses the same platform integration.
 */

/** Honest failure framing the model can relay verbatim without inventing causes. */
function agentFacingFailure(userMessage: string): string {
  return (
    `${userMessage} ` +
    "This came from the built-in Qurtiz research service (Brave Search, platform-level) — " +
    "it is independent of the selected AI model, so do NOT attribute it to the AI provider or model. " +
    "Tell the user the real reason briefly and do NOT present model-knowledge lists as current/live data."
  );
}

export function makeWebSearchTool(ctx: { logStep: LogFn; workspaceId: string; userId: string }) {
  return tool({
    description:
      "Search the live web right now through Qurtiz's built-in research service (works with ANY selected AI model — no provider-native search needed). Use for anything current or external to the brand: trends in the workspace niche, latest news, prices, recent events, what communities and creators are saying. Returns sourced results for you to analyze.",
    inputSchema: z.object({
      query: z.string().min(3).max(300).describe("What to search for"),
      strategy: z
        .enum(RESEARCH_STRATEGY_IDS as [ResearchStrategy, ...ResearchStrategy[]])
        .optional()
        .describe(
          "Source focus: trends (Google Trends/search interest), official (official sources), news (current news), announcements (product/company news), community (Reddit), creators (YouTube), or web (broad fallback, the default).",
        ),
      region: z.string().max(10).optional().describe("2-letter region code, e.g. US. Defaults to the platform default."),
      freshness: z.enum(["pd", "pw", "pm", "py"]).optional().describe("Recency window: pd=past day, pw=past week, pm=past month, py=past year."),
    }),
    execute: async (input) => {
      try {
        const result = await searchResearch({
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          query: input.query,
          strategy: input.strategy ?? null,
          region: input.region ?? null,
          freshness: input.freshness ?? null,
        });

        if (!result.ok) {
          console.info(
            `[research] web_search failed reason=${result.reason} query="${input.query.slice(0, 120)}"${result.retryAfterSeconds !== undefined ? ` retryAfterSeconds=${result.retryAfterSeconds}` : ""}`,
          );
          await ctx.logStep("web_search", input, { ok: false, reason: result.reason });
          return { searched: false, reason: result.reason, message: agentFacingFailure(result.message) };
        }

        if (result.count === 0) {
          console.info(`[research] web_search no_results query="${input.query.slice(0, 120)}" strategy=${result.strategy}`);
          await ctx.logStep("web_search", input, { ok: true, count: 0 });
          return {
            searched: true,
            found: false,
            message:
              "The live search completed successfully but returned zero results for this query. Suggest different keywords, a broader freshness window, or a different source strategy — do NOT fill the gap with older model knowledge presented as current.",
          };
        }

        const lines = result.results.map(
          (r) => `- [${r.title || r.url}](${r.url})${r.age ? ` (${r.age})` : ""}${r.description ? ` — ${r.description}` : ""}`,
        );
        const summary = `Live web results (${result.strategyLabel}${result.fromCache ? ", cached" : ""}):\n${lines.join("\n")}`.slice(
          0,
          4000,
        );
        console.info(
          `[research] web_search ok results=${result.count} strategy=${result.strategy} fromCache=${result.fromCache} deduped=${result.deduped} query="${input.query.slice(0, 120)}"`,
        );
        await ctx.logStep("web_search", input, { ok: true, count: result.count, fromCache: result.fromCache });
        return {
          searched: true,
          found: true,
          provider: result.provider,
          fromCache: result.fromCache,
          summary,
          sources: result.results.map((r) => ({ title: r.title, url: r.url })),
        };
      } catch (error) {
        // Absolute safety net: a research failure must surface as a tool
        // result the agent can explain — never a broken agent stream.
        const message = error instanceof Error ? error.message.slice(0, 200) : "unknown error";
        console.warn(`[research] web_search internal error: ${message}`);
        await ctx.logStep("web_search", input, { ok: false });
        return {
          searched: false,
          reason: "error",
          message: agentFacingFailure(`Live research failed (${message}).`),
        };
      }
    },
  });
}
