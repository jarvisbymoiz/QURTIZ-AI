import { describe, expect, it, vi, beforeEach } from "vitest";
import { stepCountIs, streamText } from "ai";
import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2StreamPart,
} from "@ai-sdk/provider";
import { agentSteps, brands, contentItems } from "@/db/schema";
import { buildAgentTools } from "@/lib/ai/tools";
import { repairWrappedToolCall } from "@/lib/ai/stream-errors";

// ---------------------------------------------------------------------------
// Wrapped tool-call repair — agent-level acceptance
// ---------------------------------------------------------------------------
//
// The production bug: some models emit `create_content` arguments wrapped in
// a `{"json": {...}}` envelope. The SDK validates the OUTER object against
// the tool schema and fails with "missing properties: topic, platforms" +
// "additionalProperties 'json' not allowed" (code tool_use_failed), so the
// tool never runs and the agent dies at the step. The fix wires
// `experimental_repairToolCall` (the same callback the chat route uses) into
// streamText here; the SDK re-validates the normalized input against the
// FULL schema, so genuinely invalid calls still fail honestly.
//
// A scripted LanguageModelV2 (no network) drives each step and a fake db
// (see agent.test.ts for the base pattern) answers tool queries, so the
// whole agent loop — model → SDK validation → repair → tool execution →
// follow-up step → final text — runs hermetically.

vi.mock("@/db", () => ({ getDb: vi.fn() }));

// create_content's generation backend is mocked out: the contract under test
// is the tool-call validation/repair path and the agent's continuation after
// a successful create, not content generation itself.
vi.mock("@/lib/ai/content", () => ({
  generateAndPersistContent: vi.fn(async () => ({
    itemId: "item-new",
    qa: { score: 92, passed: true, issues: [] },
  })),
  AIContentParseError: class AIContentParseError extends Error {},
}));

const { getDb } = await import("@/db");
const mockedGetDb = vi.mocked(getDb);
const { generateAndPersistContent } = await import("@/lib/ai/content");
const mockedGenerateContent = vi.mocked(generateAndPersistContent);

type StepRow = Record<string, unknown>;

/** Minimal chainable db fake covering the queries the tools use. */
function makeFakeDb(stepRows: StepRow[]) {
  const contentRows: unknown[] = [];
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

const usage = { inputTokens: 3, outputTokens: 3, totalTokens: 6 };

function toolCallPart(toolCallId: string, toolName: string, input: string): LanguageModelV2StreamPart {
  return { type: "tool-call", toolCallId, toolName, input };
}

function finishToolCalls(): LanguageModelV2StreamPart {
  return { type: "finish", finishReason: "tool-calls", usage };
}

const FINAL_TEXT_PARTS: LanguageModelV2StreamPart[] = [
  { type: "text-start", id: "text-1" },
  { type: "text-delta", id: "text-1", delta: "Done." },
  { type: "text-end", id: "text-1" },
  { type: "finish", finishReason: "stop", usage },
];

/**
 * Scripted model: scripts[i] answers the i-th provider call (indexed by the
 * number of tool messages already in the prompt); the last script repeats
 * for any further calls. Same shape as agent.test.ts's fakeSequentialModel.
 */
function scriptedModel(scripts: LanguageModelV2StreamPart[][]): LanguageModelV2 {
  return {
    specificationVersion: "v2",
    provider: "test-fake",
    modelId: "fake-scripted",
    supportedUrls: {},
    async doGenerate() {
      throw new Error("doGenerate is not used by streamText");
    },
    async doStream(callOptions: LanguageModelV2CallOptions) {
      const toolSteps = callOptions.prompt.filter((m) => m.role === "tool").length;
      const parts = scripts[Math.min(toolSteps, scripts.length - 1)];
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

function runAgent(scripts: LanguageModelV2StreamPart[][]) {
  return streamText({
    model: scriptedModel(scripts),
    system: "You are a test agent.",
    messages: [{ role: "user", content: [{ type: "text", text: "Create a post about Juma Mubarak." }] }],
    tools: buildAgentTools({ workspaceId: "ws-test", userId: "user-test", runId: "run-test" }),
    stopWhen: stepCountIs(6),
    experimental_repairToolCall: repairWrappedToolCall,
  });
}

const wrappedCreate = (platforms: string[]) =>
  JSON.stringify({ json: { topic: "Juma Mubarak specials", platforms } });

/** Tool-error content parts of a step (the SDK surfaces them as parts). */
function toolErrorParts(content: unknown[]): { error?: unknown }[] {
  return content.filter(
    (p) => (p as { type?: string }).type === "tool-error",
  ) as { error?: unknown }[];
}

beforeEach(() => {
  mockedGenerateContent.mockClear();
});

describe("wrapped create_content tool-call repair", () => {
  it("executes a plain valid create_content call (repair passes through)", async () => {
    const stepRows: StepRow[] = [];
    mockedGetDb.mockReturnValue(makeFakeDb(stepRows) as never);

    const result = runAgent([
      [toolCallPart("call-1", "create_content", JSON.stringify({ topic: "Juma Mubarak specials", platforms: ["facebook"] })), finishToolCalls()],
      FINAL_TEXT_PARTS,
    ]);

    expect(await result.text).toContain("Done.");
    const steps = await result.steps;
    expect(steps).toHaveLength(2);
    expect(steps[0].toolResults[0]).toMatchObject({
      toolName: "create_content",
      output: { created: true, itemId: "item-new", qaScore: 92 },
    });
    expect(stepRows.map((r) => r.toolName)).toEqual(["create_content"]);
  });

  it("repairs a wrapped object-form input and executes the tool", async () => {
    const stepRows: StepRow[] = [];
    mockedGetDb.mockReturnValue(makeFakeDb(stepRows) as never);

    const result = runAgent([
      [toolCallPart("call-1", "create_content", wrappedCreate(["facebook"])), finishToolCalls()],
      FINAL_TEXT_PARTS,
    ]);

    expect(await result.text).toContain("Done.");
    const steps = await result.steps;
    expect(steps).toHaveLength(2);
    // The SDK re-validated the UNWRAPPED input and handed it to the tool.
    expect(steps[0].toolCalls[0]).toMatchObject({ toolName: "create_content" });
    expect(steps[0].toolCalls[0].input).toEqual({
      topic: "Juma Mubarak specials",
      platforms: ["facebook"],
    });
    expect(steps[0].toolResults[0]).toMatchObject({
      toolName: "create_content",
      output: { created: true, itemId: "item-new", qaScore: 92 },
    });
    expect(stepRows.map((r) => r.toolName)).toEqual(["create_content"]);
  });

  it("repairs a wrapped string-form input and executes the tool", async () => {
    const stepRows: StepRow[] = [];
    mockedGetDb.mockReturnValue(makeFakeDb(stepRows) as never);

    const wrapped = JSON.stringify({
      json: JSON.stringify({ topic: "Juma Mubarak specials", platforms: ["facebook"] }),
    });
    const result = runAgent([
      [toolCallPart("call-1", "create_content", wrapped), finishToolCalls()],
      FINAL_TEXT_PARTS,
    ]);

    expect(await result.text).toContain("Done.");
    const steps = await result.steps;
    expect(steps[0].toolResults[0]).toMatchObject({
      toolName: "create_content",
      output: { created: true, itemId: "item-new", qaScore: 92 },
    });
    expect(stepRows.map((r) => r.toolName)).toEqual(["create_content"]);
  });

  it("still rejects a wrapped input with a genuinely invalid platform enum", async () => {
    const stepRows: StepRow[] = [];
    mockedGetDb.mockReturnValue(makeFakeDb(stepRows) as never);

    const result = runAgent([
      [toolCallPart("call-1", "create_content", wrappedCreate(["tiktok"])), finishToolCalls()],
      FINAL_TEXT_PARTS,
    ]);

    // The run still reaches its final answer — the failure is surfaced, not
    // swallowed — but the invalid enum must NOT execute the tool.
    expect(await result.text).toContain("Done.");
    const steps = await result.steps;
    expect(steps).toHaveLength(2);
    expect(steps[0].toolCalls[0]).toMatchObject({ toolName: "create_content", invalid: true });
    const errors = toolErrorParts(steps[0].content);
    expect(errors).toHaveLength(1);
    expect(String(errors[0].error)).toContain("Invalid input for tool create_content");
    expect(mockedGenerateContent).not.toHaveBeenCalled();
    expect(stepRows).toHaveLength(0);
  });

  it("declines repair for a genuinely invalid non-wrapped input (validation not weakened)", async () => {
    const stepRows: StepRow[] = [];
    mockedGetDb.mockReturnValue(makeFakeDb(stepRows) as never);

    const result = runAgent([
      [toolCallPart("call-1", "create_content", JSON.stringify({ topic: "x" })), finishToolCalls()],
      FINAL_TEXT_PARTS,
    ]);

    expect(await result.text).toContain("Done.");
    const steps = await result.steps;
    expect(steps).toHaveLength(2);
    expect(steps[0].toolCalls[0]).toMatchObject({ toolName: "create_content", invalid: true });
    const errors = toolErrorParts(steps[0].content);
    expect(errors).toHaveLength(1);
    expect(String(errors[0].error)).toContain("Invalid input for tool create_content");
    expect(mockedGenerateContent).not.toHaveBeenCalled();
    expect(stepRows).toHaveLength(0);
  });

  it("accepts a wrapped call targeting both platforms", async () => {
    const stepRows: StepRow[] = [];
    mockedGetDb.mockReturnValue(makeFakeDb(stepRows) as never);

    const result = runAgent([
      [toolCallPart("call-1", "create_content", wrappedCreate(["facebook", "instagram"])), finishToolCalls()],
      FINAL_TEXT_PARTS,
    ]);

    expect(await result.text).toContain("Done.");
    const steps = await result.steps;
    expect(steps[0].toolCalls[0].input).toEqual({
      topic: "Juma Mubarak specials",
      platforms: ["facebook", "instagram"],
    });
    expect(steps[0].toolResults[0]).toMatchObject({
      toolName: "create_content",
      output: { created: true, itemId: "item-new", qaScore: 92 },
    });
  });

  it("stays usable after a validation failure — a subsequent valid call succeeds in the same run", async () => {
    const stepRows: StepRow[] = [];
    mockedGetDb.mockReturnValue(makeFakeDb(stepRows) as never);

    const result = runAgent([
      // Step 1: invalid input — validation fails, repair declines, the SDK
      // feeds the tool error back to the model.
      [toolCallPart("call-1", "create_content", JSON.stringify({ topic: "x" })), finishToolCalls()],
      // Step 2: the model retries with a wrapped-but-valid call.
      [toolCallPart("call-2", "create_content", wrappedCreate(["facebook"])), finishToolCalls()],
      FINAL_TEXT_PARTS,
    ]);

    expect(await result.text).toContain("Done.");
    const steps = await result.steps;
    expect(steps).toHaveLength(3);
    expect(steps[0].toolCalls[0]).toMatchObject({ invalid: true });
    expect(steps[1].toolResults[0]).toMatchObject({
      toolName: "create_content",
      output: { created: true, itemId: "item-new", qaScore: 92 },
    });
    expect(steps[2].finishReason).toBe("stop");
    // Exactly one execution persisted, under the single run id — no
    // duplicate rows from the failed attempt.
    expect(stepRows.map((r) => r.toolName)).toEqual(["create_content"]);
    expect(stepRows.every((r) => r.runId === "run-test")).toBe(true);
    expect(mockedGenerateContent).toHaveBeenCalledTimes(1);
  });
});

describe("sequential multi-tool conversation through repair", () => {
  it("get_brand_brain → wrapped create_content → final text", async () => {
    const stepRows: StepRow[] = [];
    mockedGetDb.mockReturnValue(makeFakeDb(stepRows) as never);

    const result = runAgent([
      [toolCallPart("call-1", "get_brand_brain", JSON.stringify({})), finishToolCalls()],
      [toolCallPart("call-2", "create_content", wrappedCreate(["facebook", "instagram"])), finishToolCalls()],
      FINAL_TEXT_PARTS,
    ]);

    expect(await result.text).toContain("Done.");
    const steps = await result.steps;
    expect(steps).toHaveLength(3);

    // Step 1: get_brand_brain executed, output available.
    expect(steps[0].toolResults[0]).toMatchObject({
      toolName: "get_brand_brain",
      output: { brandBrain: "No brand information configured yet." },
    });

    // Step 2: the wrapped create_content was repaired and executed.
    expect(steps[1].toolResults[0]).toMatchObject({
      toolName: "create_content",
      output: { created: true, itemId: "item-new", qaScore: 92 },
    });

    // Step 3: final text, run completed — the agent continued after create.
    expect(steps[2].finishReason).toBe("stop");
    expect(steps[2].text).toContain("Done.");

    expect(stepRows.map((r) => r.toolName)).toEqual(["get_brand_brain", "create_content"]);
  });
});
