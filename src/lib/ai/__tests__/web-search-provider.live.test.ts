import { config } from "dotenv";
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { streamText, stepCountIs } from "ai";
import { getDb } from "@/db";
import { workspaceAiConfig, workspaceMembers } from "@/db/schema";
import { getWorkspaceTextModel } from "../config";
import { makeWebSearchTool } from "../search-tool";
import { createLazyChatTools } from "../chat-tools";
import { buildSystemPrompt } from "../agent";
import { searchResearch } from "@/lib/research/service";

describe("real configured Agent web search", () => {
  it.skipIf(process.env.RUN_LIVE_SEARCH !== "true")("receives actual Brave results through configured LLM and PK fallback", async () => {
    config({ path: ".env.local", override: true, quiet: true });
    const db = getDb();
    const configurations = await db.select({ workspaceId: workspaceAiConfig.workspaceId }).from(workspaceAiConfig);
    expect(configurations.length).toBeGreaterThan(0);
    const seen = new Set<string>();
    for (const row of configurations) {
      const resolved = await getWorkspaceTextModel(row.workspaceId, "chat");
      if (seen.has(resolved.provider)) continue;
      seen.add(resolved.provider);
      const [member] = await db.select({ userId: workspaceMembers.userId }).from(workspaceMembers).where(eq(workspaceMembers.workspaceId, row.workspaceId)).limit(1);
      expect(member).toBeTruthy();
      const query = "ChatGPT 6.1 Sol Model";
      const research = await searchResearch({ workspaceId: row.workspaceId, userId: member.userId, query, region: "PK", language: "en", freshness: "pw" });
      expect(research.ok).toBe(true);
      if (!research.ok) throw Error(research.message);
      expect(research.results.length).toBeGreaterThan(0);
      const webSearch = makeWebSearchTool({ workspaceId: row.workspaceId, userId: member.userId, logStep: async () => {} });
      const request = `Create a draft of a high engagement high reach post about ${query}.`;
      const system = buildSystemPrompt({ lazyContext: true, currentTask: request, workspaceName: "Qurtiz search validation", brandSummary: "", memories: [] });
      const lazy = createLazyChatTools({ web_search: webSearch }, request, system + "\nRead-only verification: research the requested topic using web_search and return sourced findings. Draft persistence is unavailable in this verification; do not claim a draft was saved.");
      const result = streamText({ model: resolved.model, system, messages: [{ role: "user", content: request }], tools: lazy.tools, prepareStep: lazy.prepareStep, stopWhen: stepCountIs(4), abortSignal: AbortSignal.timeout(90000) });
      const text = await result.text;
      const receivedSources = (await result.steps).flatMap(step => step.toolResults).reduce((count, result) => {
        const output = result.output as { sources?: unknown[] };
        return count + (output.sources?.length ?? 0);
      }, 0);
      console.info("[search:verification-response]", { text, steps: (await result.steps).map(step => ({ finishReason: step.finishReason, actions: step.toolCalls.map(call => call.toolName) })) });
      expect(receivedSources).toBeGreaterThan(0);
      expect(text.trim()).not.toBe("");
      expect((await result.steps).flatMap(step => step.toolResults).some(result => Array.isArray((result.output as { sources?: unknown[] }).sources))).toBe(true);
      console.info("[search:live]", { provider: resolved.provider, model: resolved.modelId, receivedSources, actions: (await result.steps).flatMap(s => s.toolResults.map(t => t.toolName)), sources: research.results.slice(0, 3).map(r => r.url), response: text.slice(0, 200) });
    }
  }, 180000);
});
