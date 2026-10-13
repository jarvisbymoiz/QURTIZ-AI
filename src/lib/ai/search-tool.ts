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
    "Do not describe invalid_request or HTTP 422 as temporary; correct arguments/configuration before retrying. Tell the user the real reason briefly and do NOT present model-knowledge lists as current/live data."
  );
}

export function makeWebSearchTool(ctx: { logStep: LogFn; workspaceId: string; userId: string; abortSignal?: AbortSignal; onResearch?: (reference: string) => void }) {
  return tool({
    description:
      "Search live web via Qurtiz ResearchService/Brave. Returns sourced results; independent of the LLM provider.",
    inputSchema: z.object({
      query: z.string().trim().min(3).max(300).describe("What to search for"),
      strategy: z
        .enum(RESEARCH_STRATEGY_IDS as [ResearchStrategy, ...ResearchStrategy[]])
        .optional()
        .describe(
          "Optional source focus; default web.",
        ),
      region: z.string().regex(/^(?:[A-Za-z]{2}|ALL)$/).optional().describe("Country code or ALL. Unsupported country indexes use worldwide search."),
      freshness: z.enum(["pd", "pw", "pm", "py"]).optional().describe("Recency: day, week, month, year."),
    }),
    execute: async (input, options) => {
      ctx.onResearch?.("");
      const signals = [ctx.abortSignal, options.abortSignal].filter((signal): signal is AbortSignal => !!signal);
      const signal = signals.length ? AbortSignal.any(signals) : undefined;
      try {
        signal?.throwIfAborted();
        const result = await searchResearch({
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          query: input.query,
          strategy: input.strategy ?? null,
          region: input.region ?? null,
          freshness: input.freshness ?? null,
          signal,
        });

        if (!result.ok) {
          console.info(
            `[research] web_search failed reason=${result.reason}${result.retryAfterSeconds !== undefined ? ` retryAfterSeconds=${result.retryAfterSeconds}` : ""}`,
          );
          await ctx.logStep("web_search", input, { ok: false, reason: result.reason });
          return { searched: false, reason: result.reason, message: agentFacingFailure(result.message) };
        }

        if (result.count === 0) {
          console.info(`[research] web_search reason=empty_results strategy=${result.strategy}`);
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
          `[research] web_search ok results=${result.count} strategy=${result.strategy} fromCache=${result.fromCache} deduped=${result.deduped}`,
        );
        ctx.onResearch?.(summary + "\nSource URLs:\n" + result.results.map(r => r.url).join("\n"));
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
        if (signal?.aborted) throw error;
        // Absolute safety net: a research failure must surface as a tool
        // result the agent can explain — never a broken agent stream.
        const message = "The research service encountered an internal error.";
        console.warn("[research] web_search reason=provider_error");
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
