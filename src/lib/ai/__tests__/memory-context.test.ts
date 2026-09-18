import { describe, expect, it, vi } from "vitest";
import { streamText, stepCountIs } from "ai";
import type { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2StreamPart } from "@ai-sdk/provider";
import { buildSystemPrompt } from "../agent";
import { buildAgentTools } from "../tools";
import { boundedAgentReference } from "../memory-policy";
import { createLazyChatTools } from "../chat-tools";
import { createBudgetedChatModel, type ConversationContext } from "../chat-budget";

vi.mock("@/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/workspace", () => ({ getMembership: async () => ({ role: "editor" }) }));

describe("persistent memory within the chat request budget", () => {
  it("keeps small turns working and memory available after long-history compression", async () => {
    const calls: LanguageModelV2CallOptions[] = [];
    const summarize = vi.fn(async () => ({ content: [{ type: "text" as const, text: "Earlier tasks: educational content, no invented analytics, waiting for approval." }], finishReason: "stop" as const, usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 }, warnings: [] }));
    const raw: LanguageModelV2 = { specificationVersion: "v2", provider: "test", modelId: "test", supportedUrls: {}, doGenerate: summarize,
      doStream: async options => { calls.push(options); const parts: LanguageModelV2StreamPart[] = [
        { type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: "Continued." }, { type: "text-end", id: "t" },
        { type: "finish", finishReason: "stop", usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 } },
      ]; return { stream: new ReadableStream({ start(c) { parts.forEach(p => c.enqueue(p)); c.close(); } }) }; } };
    const reference = boundedAgentReference({ personal: [{ key: "copy.emojis", content: "Do not use emojis" }, { key: "caption.language", content: "Generate captions in English" }], workspace: [], profile: { operatingInstructions: "Professional brand guidance ".repeat(40), strategy: "Educational content ".repeat(40), workflow: "Review first ".repeat(70), platforms: "Facebook and Instagram" } }, 1890);
    const system = buildSystemPrompt({ workspaceName: "Test", brandSummary: "", memories: [], lazyContext: true, persistentContext: reference });
    let context: ConversationContext | null = null;
    const messages: { role: "user" | "assistant"; content: string }[] = [];
    const turn = async () => {
      const lazy = createLazyChatTools(buildAgentTools({ workspaceId: "test", userId: "test", runId: "test" }), messages.at(-1)?.content ?? "");
      const model = createBudgetedChatModel({ model: raw, scope: "test/test", context,
        budget: { contextTokens: 32768, requestTokens: 8000, outputTokens: 2048, threshold: 0.75, recentTurns: 2, summaryTokens: 512 },
        save: async value => { context = value; } });
      const result = streamText({ model, system, messages, tools: lazy.tools, prepareStep: lazy.prepareStep, stopWhen: stepCountIs(6) });
      expect(await result.text).toBe("Continued.");
    };
    for (const text of ["Hi", "How are you?", "Thanks", "Continue", "Tell me more"]) {
      messages.push({ role: "user", content: text }); await turn(); messages.push({ role: "assistant", content: "Continued." });
    }
    messages.push({ role: "user", content: "Create a Facebook post for the offer" }); await turn(); messages.push({ role: "assistant", content: "Continued." });
    expect(summarize).not.toHaveBeenCalled(); expect(context).toBeNull();
    for (let index = 0; index < 10; index++) messages.push({ role: "user", content: "Discuss educational content ideas and preserve approval. ".repeat(100) }, { role: "assistant", content: "Waiting for approval." });
    messages.push({ role: "user", content: "Continue my content strategy" }); await turn();
    expect(summarize).toHaveBeenCalled(); expect(context).not.toBeNull();
    const outgoing = calls.at(-1)!;
    expect(outgoing.prompt[0]).toMatchObject({ role: "system" });
    expect(JSON.stringify(outgoing.prompt[0])).toContain("Do not use emojis");
    expect(outgoing.prompt.filter(message => message.role === "assistant" && JSON.stringify(message).includes("Earlier conversation reference"))).toHaveLength(1);
    expect(outgoing.prompt.length).toBeLessThan(messages.length);
  });
});
