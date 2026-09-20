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
 * The agent never knows which API key serves the request: every workspace
 * uses the same platform integration, and the backend handles Brave
 * authentication, caching, source prioritization, rate limits and
 * failures. Works for all workspaces regardless of their AI provider —
 * no per-user or per-workspace Brave credentials exist anywhere.
 */
export function makeWebSearchTool(ctx: { logStep: LogFn; workspaceId: string; userId: string }) {
  return tool({
    description:
      "Search the live web for current information (trends, news, prices, recent events, what communities and creators are saying). Powered by the built-in Qurtiz research service. Returns a sourced summary; use when the user asks about anything current or external to the brand.",
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
          await ctx.logStep("web_search", input, { ok: false, reason: result.reason });
          return { searched: false, reason: result.reason, message: result.message };
        }

        const lines = result.results.map(
          (r) => `- [${r.title || r.url}](${r.url})${r.age ? ` (${r.age})` : ""}${r.description ? ` — ${r.description}` : ""}`,
        );
        const summary = `Live web results (${result.strategyLabel}${result.fromCache ? ", cached" : ""}):\n${lines.join("\n")}`.slice(
          0,
          4000,
        );
        await ctx.logStep("web_search", input, { ok: true, count: result.count, fromCache: result.fromCache });
        return {
          searched: true,
          provider: result.provider,
          fromCache: result.fromCache,
          summary,
          sources: result.results.map((r) => ({ title: r.title, url: r.url })),
        };
      } catch (error) {
        // Absolute safety net: a research failure must surface as a tool
        // result the agent can explain — never a broken agent stream.
        const message = error instanceof Error ? error.message.slice(0, 200) : "unknown error";
        await ctx.logStep("web_search", input, { ok: false });
        return { searched: false, reason: "error", message: `Live research failed (${message}). Tell the user honestly.` };
      }
    },
  });
}
