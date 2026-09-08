import { describe, expect, it, vi } from "vitest";
import { stepCountIs, streamText } from "ai";
import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2StreamPart,
} from "@ai-sdk/provider";
import { agentSteps, brands, contentItems } from "@/db/schema";
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
        const data: unknown[] = table === brands ? brandRows : table === contentItems ? contentRows : [];
        const thenable = Promise.resolve(data) as Promise<unknown[]> & {
          where: () => Promise<unknown[]>;
          orderBy: () => Promise<unknown[]>;
          limit: () => Promise<unknown[]>;
        };
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

    const result = streamText({
      model: fakeSequentialModel(),
      system: "You are a test agent.",
      messages: [
        { role: "user", content: [{ type: "text", text: "Find content and check the brand." }] },
      ],
      tools: buildAgentTools({ workspaceId: "ws-test", userId: "user-test", runId: "run-test" }),
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
