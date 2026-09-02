import "server-only";

import { tool } from "ai";
import { z } from "zod";
import { getWorkspaceTextModel } from "@/lib/ai/config";

type LogFn = (toolName: string, input: unknown, output: unknown) => Promise<void>;

/**
 * Live web search via Gemini grounding (google_search tool) using the
 * WORKSPACE's own AI key + model. Honest fallback: on quota/billing blocks
 * or non-Gemini providers it returns searched:false with a clear reason.
 */
export function makeWebSearchTool(ctx: { logStep: LogFn; workspaceId: string }) {
  return tool({
    description:
      "Search the live web for current information (trends, news, prices, recent events). Returns a sourced summary. Use when the user asks about anything current or external to the brand.",
    inputSchema: z.object({
      query: z.string().min(3).max(300).describe("What to search for"),
    }),
    execute: async (input) => {
      // Resolved per-call from the workspace config: no global key, and the
      // provider is re-checked so a provider change takes effect immediately.
      let resolved;
      try {
        resolved = await getWorkspaceTextModel(ctx.workspaceId, "research");
      } catch {
        await ctx.logStep("web_search", input, { ok: false });
        return { searched: false, message: "AI is not configured for this workspace — add your provider + API key in Workspace Settings." };
      }
      if (resolved.provider !== "gemini") {
        await ctx.logStep("web_search", input, { ok: false });
        return {
          searched: false,
          message:
            "Live web search requires the Google (Gemini) provider — your current provider doesn't support it. Tell the user honestly.",
        };
      }
      try {
        const res = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" + resolved.modelId + ":generateContent",
          {
            method: "POST",
            headers: { "x-goog-api-key": resolved.apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "Search the web and summarize concisely with source URLs: " + input.query }] }],
              tools: [{ google_search: {} }],
            }),
            signal: AbortSignal.timeout(60_000),
          },
        );
        const json = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          error?: { message?: string };
        };
        if (!res.ok || json.error) {
          const msg = json.error?.message ?? "HTTP " + res.status;
          await ctx.logStep("web_search", input, { ok: false, msg: msg.slice(0, 120) });
          return {
            searched: false,
            message: msg.toLowerCase().includes("quota")
              ? "Live web search is not available on the current API plan (quota). Tell the user honestly."
              : "Search failed: " + msg.slice(0, 200),
          };
        }
        const text = (json.candidates?.[0]?.content?.parts ?? [])
          .map((p) => p.text)
          .filter(Boolean)
          .join("\n");
        await ctx.logStep("web_search", input, { ok: true, len: text.length });
        return { searched: true, summary: text.slice(0, 4000) };
      } catch (e) {
        return { searched: false, message: "Search failed: " + (e instanceof Error ? e.message : "unknown error") };
      }
    },
  });
}
