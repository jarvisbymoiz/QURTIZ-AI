import { createLazyChatTools } from "../chat-tools";
import { estimatePayloadTokens, type ChatBudgetDiagnostic } from "../chat-budget";
import { createBudgetedChatModel, resolveChatBudget } from "../chat-budget";
import { describe, expect, it, vi } from "vitest";
import { stepCountIs, streamText } from "ai";
import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2StreamPart,
} from "@ai-sdk/provider";
import { agentRuns, agentSteps, brands, contentItems, workspaceMembers } from "@/db/schema";
import { buildSystemPrompt } from "@/lib/ai/agent";
import { buildAgentTools } from "@/lib/ai/tools";

describe("buildSystemPrompt publishing-route copy", () => {
  const base = { brandSummary: "Test brand", memories: [], workspaceName: "Test" };

  it("describes the official Meta integration when no provider is given (defaults to meta)", () => {
    const system = buildSystemPrompt(base);
    expect(system).toContain("(official Meta integration)");
    expect(system).not.toContain("Buffer API connection");
  });

  it("describes the Buffer route when publishing is set to Buffer", () => {
    const system = buildSystemPrompt({ ...base, publishProvider: "buffer" });
    expect(system).toContain("Buffer API connection");
    expect(system).toContain("Buffer owns channel access");
    expect(system).not.toContain("(official Meta integration)");
  });
});

// ---------------------------------------------------------------------------
// Sequential multi-tool acceptance
// ---------------------------------------------------------------------------
//
// The user-facing acceptance criterion: the agent must run a REAL multi-tool
// conversation to completion — step 1 calls search_content_library, step 2
// calls get_brand_brain, step 3 emits the final text — with every tool part
// output-available. A fake LanguageModelV2 (no network) drives the steps and
// a fake db (see chat-persistence.test.ts for the full pattern) answers the
// two tools' queries, so the test is hermetic.

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/workspace", () => ({ getMembership: vi.fn(async () => ({ role: "editor" })) }));

const { getDb } = await import("@/db");
const mockedGetDb = vi.mocked(getDb);

type StepRow = Record<string, unknown>;

/** Minimal chainable db fake covering the queries the two tools use. */
function makeFakeDb(stepRows: StepRow[]) {
  const contentRows = [
    { id: "item-1", topic: "Juma Mubarak", status: "ready_for_review", createdAt: new Date() },
  ];
  const brandRows: Record<string, unknown>[] = [];

  const db = {
    select: () => ({
      from: (table: unknown) => {
        const data: unknown[] = table === workspaceMembers ? [{ role: "editor" }] : table === agentRuns ? [{ status: "running" }] : table === brands ? brandRows : table === contentItems ? contentRows : [];
        const thenable = Promise.resolve(data) as Promise<unknown[]> & {
          innerJoin: () => Promise<unknown[]>;
          where: () => Promise<unknown[]>;
          orderBy: () => Promise<unknown[]>;
          limit: () => Promise<unknown[]>;
        };
        thenable.innerJoin = () => thenable;
        thenable.where = () => thenable;
        thenable.orderBy = () => thenable;
        thenable.limit = () => thenable;
        return thenable;
      },
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        if (table === agentSteps) stepRows.push(values);
        const thenable = Promise.resolve(values) as Promise<Record<string, unknown>> & {
          returning: () => Promise<Record<string, unknown>[]>;
        };
        thenable.returning = () => Promise.resolve([values]);
        return thenable;
      },
    }),
  };
  return db;
}

/**
 * Scripted three-step model: two tool calls (each answered by the agent's
 * real tools) followed by a final text answer. The step index is the number
 * of tool-result messages already in the prompt.
 */
function fakeSequentialModel(): LanguageModelV2 {
  const usage = { inputTokens: 3, outputTokens: 3, totalTokens: 6 };
  return {
    specificationVersion: "v2",
    provider: "test-fake",
    modelId: "fake-sequential",
    supportedUrls: {},
    async doGenerate() {
      throw new Error("doGenerate is not used by streamText");
    },
    async doStream(callOptions: LanguageModelV2CallOptions) {
      const toolSteps = callOptions.prompt.filter((m) => m.role === "tool").length;
      const parts: LanguageModelV2StreamPart[] = [];
      if (toolSteps === 0) {
        parts.push({
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "search_content_library",
          input: JSON.stringify({ query: "Juma" }),
        });
        parts.push({ type: "finish", finishReason: "tool-calls", usage });
      } else if (toolSteps === 1) {
        parts.push({
          type: "tool-call",
          toolCallId: "call-2",
          toolName: "get_brand_brain",
          input: JSON.stringify({}),
        });
        parts.push({ type: "finish", finishReason: "tool-calls", usage });
      } else {
        parts.push({ type: "text-start", id: "text-1" });
        parts.push({ type: "text-delta", id: "text-1", delta: "Done." });
        parts.push({ type: "text-end", id: "text-1" });
        parts.push({ type: "finish", finishReason: "stop", usage });
      }
      return {
        stream: new ReadableStream<LanguageModelV2StreamPart>({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
        request: { body: { messages: callOptions.prompt } },
        response: { headers: {} },
      };
    },
  };
}

describe("agent sequential multi-tool conversation", () => {
  it("executes search_content_library then get_brand_brain, then answers", async () => {
    const stepRows: StepRow[] = [];
    mockedGetDb.mockReturnValue(makeFakeDb(stepRows) as never);

    const all = buildAgentTools({ workspaceId: "ws-test", userId: "user-test", runId: "run-test" });
    const result = streamText({
      model: createBudgetedChatModel({ model: fakeSequentialModel(), budget: resolveChatBudget("custom", "test", { QURTIZ_CHAT_LIMITS_JSON: JSON.stringify({ default: { requestTokens: 8000, outputTokens: 1024 } }) }), save: async () => undefined }),
      system: "You are a test agent.",
      messages: [
        { role: "user", content: [{ type: "text", text: "Find content and check the brand." }] },
      ],
      tools: { search_content_library: all.search_content_library, get_brand_brain: all.get_brand_brain },
      stopWhen: stepCountIs(6),
    });

    // The run completes with the final answer.
    expect(await result.text).toContain("Done.");
    const steps = await result.steps;
    expect(steps).toHaveLength(3);

    // Step 1: search_content_library executed, output available.
    expect(steps[0].toolCalls.map((c) => c.toolName)).toEqual(["search_content_library"]);
    expect(steps[0].toolResults).toHaveLength(1);
    expect(steps[0].toolResults[0]).toMatchObject({
      toolName: "search_content_library",
      output: { results: [{ id: "item-1", topic: "Juma Mubarak", status: "ready_for_review" }] },
    });

    // Step 2: get_brand_brain executed, output available.
    expect(steps[1].toolCalls.map((c) => c.toolName)).toEqual(["get_brand_brain"]);
    expect(steps[1].toolResults).toHaveLength(1);
    expect(steps[1].toolResults[0]).toMatchObject({
      toolName: "get_brand_brain",
      output: { brandBrain: "No brand information configured yet." },
    });

    // Step 3: the final text response, run completed.
    expect(steps[2].finishReason).toBe("stop");
    expect(steps[2].text).toContain("Done.");

    // Both tool executions were recorded to agent_steps in order.
    expect(stepRows.map((r) => r.toolName)).toEqual(["search_content_library", "get_brand_brain"]);
  });
});


describe("short chat with real agent instructions and schemas", () => {
  it.each(["Change the caption of my last post", "Remove hashtags from this post", "Update the visual prompt", "Replace the second carousel slide", "Change this Reel caption"])("keeps the actual editing payload within the unchanged 8000-token limit: %s", async request => {
    mockedGetDb.mockReturnValue(makeFakeDb([]) as never);
    const lazy = createLazyChatTools(buildAgentTools({ workspaceId: "ws-test", userId: "user-test", runId: "run-test" }), request);
    const calls: LanguageModelV2CallOptions[] = [];
    const raw: LanguageModelV2 = { specificationVersion: "v2", provider: "fixture", modelId: "fixture", supportedUrls: {}, doGenerate: async () => { throw Error("Small edits must not need compression"); }, doStream: async options => {
      calls.push(options);
      return { stream: new ReadableStream<LanguageModelV2StreamPart>({ start(controller) {
        controller.enqueue({ type: "text-start", id: "t" }); controller.enqueue({ type: "text-delta", id: "t", delta: "Ready" }); controller.enqueue({ type: "text-end", id: "t" });
        controller.enqueue({ type: "finish", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }); controller.close();
      } }) };
    } };
    const model = createBudgetedChatModel({ model: raw, budget: resolveChatBudget("custom", "fixture", { QURTIZ_CHAT_LIMITS_JSON: JSON.stringify({ default: { requestTokens: 8000, outputTokens: 1024 } }) }), save: async () => { throw Error("Small edits must not need compression"); } });
    expect(await streamText({ model, system: buildSystemPrompt({ workspaceName: "Fixture", brandSummary: "", memories: [], persistentContext: "Relevant saved style preferences. ".repeat(60), lazyContext: true, currentTask: request }), messages: [{ role: "user", content: "Create a Facebook post for the synthetic offer" }, { role: "assistant", content: "Saved post with real IDs. " + "Synthetic recent post context ".repeat(25) }, { role: "user", content: request }], tools: lazy.tools, prepareStep: lazy.prepareStep }).text).toBe("Ready");
    expect(calls).toHaveLength(1); expect(calls[0].tools?.map(t => t.name)).toContain("edit_content"); expect(calls[0].tools?.map(t => t.name)).not.toContain("create_content");
  });
  it("keeps five small turns under the unchanged learned request limit without compression", async () => {
    mockedGetDb.mockReturnValue(makeFakeDb([]) as never);
    const existing = buildAgentTools({ workspaceId: "ws-test", userId: "user-test", runId: "run-test" });
    const eagerSystem = buildSystemPrompt({ workspaceName: "Test", brandSummary: "Business and brand information ".repeat(120), memories: [] });
    const lazySystem = buildSystemPrompt({ workspaceName: "Test", brandSummary: "", memories: [], lazyContext: true });
    const calls: LanguageModelV2CallOptions[] = [];
    const summaries = vi.fn(async () => { throw new Error("Short turns must not summarize"); });
    const raw: LanguageModelV2 = { specificationVersion: "v2", provider: "test", modelId: "test", supportedUrls: {}, doGenerate: summaries,
      doStream: async options => { calls.push(options); return { stream: new ReadableStream<LanguageModelV2StreamPart>({ start(c) {
        c.enqueue({ type: "text-start", id: "text" }); c.enqueue({ type: "text-delta", id: "text", delta: "Hello" }); c.enqueue({ type: "text-end", id: "text" });
        c.enqueue({ type: "finish", finishReason: "stop", usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 } }); c.close();
      } }) }; } };
    const messages: { role: "user" | "assistant"; content: string }[] = [];
    const diagnostics: ChatBudgetDiagnostic[] = [];
    for (let turn = 0; turn < 5; turn++) {
      messages.push({ role: "user", content: ["Hi", "How are you?", "Thanks", "Continue", "Tell me more"][turn] });
      const lazy = createLazyChatTools(existing);
      const model = createBudgetedChatModel({ model: raw, budget: resolveChatBudget("custom", "test"), scope: "test/test",
        context: { version: 1, hashes: [], summary: "", learnedLimit: 8000, scope: "test/test" }, save: async () => { throw Error("No short turn compression"); },
        onDiagnostic: value => diagnostics.push(value) });
      const result = streamText({ model, system: lazySystem, messages, tools: lazy.tools, prepareStep: lazy.prepareStep, stopWhen: stepCountIs(6) });
      expect(await result.text).toBe("Hello"); messages.push({ role: "assistant", content: "Hello" });
    }
    expect(calls).toHaveLength(5); expect(summaries).not.toHaveBeenCalled();
    for (const d of diagnostics.filter(d => d.phase === "ready")) {
      expect(d.contributions.total).toBeLessThan(d.usableInputTokens); expect(d.systemMessages).toBe(1);
      expect(d.toolCount).toBe(5); expect(d.contributions.attachments).toBe(0); expect(d.contributions.summary).toBe(0);
    }
    expect(calls.map(call => call.prompt.filter(message => message.role === "user").length)).toEqual([1, 2, 3, 4, 5]);
    // Reproduce the old fixed-context overhead using all real schemas and a
    // Brand Brain of the observed size, without changing the request limit.
    const eager: LanguageModelV2CallOptions[] = [];
    const eagerRaw = { ...raw, doStream: async (options: LanguageModelV2CallOptions) => { eager.push(options); return raw.doStream(options); } };
    const old = streamText({ model: eagerRaw, system: eagerSystem, messages: [{ role: "user", content: "Hi" }], tools: existing });
    await old.text;
    expect(estimatePayloadTokens(eager[0])).toBeGreaterThan(diagnostics[0].usableInputTokens);
    // Genuine long conversation with the SAME real system, lazy schemas and
    // learned limit. Older history must be replaced, then reused on continuation.
    const summarize = vi.fn(async () => ({ content: [{ type: "text" as const, text: "Important decisions retained; outstanding task: prepare a strategy." }],
      finishReason: "stop" as const, usage: { inputTokens: 500, outputTokens: 100, totalTokens: 600 }, warnings: [] }));
    const saved = vi.fn(async (_context: import("../chat-budget").ConversationContext) => { void _context; });
    const longMessages = Array.from({ length: 30 }, (_, i) => [{ role: "user" as const, content: "Requirement " + i + ": " + "relevant discussion ".repeat(100) },
      { role: "assistant" as const, content: "Decision " + i + ": " + "verified progress ".repeat(100) }]).flat();
    longMessages.push({ role: "user", content: "Continue our strategy" });
    const longRaw = { ...raw, doGenerate: summarize };
    const longModel = createBudgetedChatModel({ model: longRaw, scope: "test/test", budget: resolveChatBudget("custom", "test"),
      context: { version: 1, hashes: [], summary: "", learnedLimit: 8000, scope: "test/test" }, save: saved });
    const lazy = createLazyChatTools(existing);
    expect(await streamText({ model: longModel, system: lazySystem, messages: longMessages, tools: lazy.tools, prepareStep: lazy.prepareStep }).text).toBe("Hello");
    expect(summarize).toHaveBeenCalled(); expect(saved).toHaveBeenCalled();
    expect(JSON.stringify(calls.at(-1)?.prompt)).not.toContain("Requirement 0");
    expect(JSON.stringify(calls.at(-1)?.prompt)).toContain("Continue our strategy");
    const summaryCalls = summarize.mock.calls.length;
    const restored = createBudgetedChatModel({ model: longRaw, scope: "test/test", budget: resolveChatBudget("custom", "test"), context: saved.mock.calls.at(-1)![0], save: saved });
    expect(await streamText({ model: restored, system: lazySystem, messages: [...longMessages, { role: "assistant", content: "Hello" }, { role: "user", content: "Thanks" }], tools: lazy.tools, prepareStep: lazy.prepareStep }).text).toBe("Hello");
    expect(summarize.mock.calls).toHaveLength(summaryCalls);

  });
});
