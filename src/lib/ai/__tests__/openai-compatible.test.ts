import { afterEach, describe, expect, it } from "vitest";
import { createOpenAICompatibleModel } from "@/lib/ai/openai-compatible";

/**
 * Regression tests for the chat tool-call bug: parseSseStream used to emit
 * only tool-input-start/delta/end and never the terminal `tool-call` part,
 * so streamText never executed tools on openai-compatible providers — runs
 * finished "completed" with the client's tool parts frozen at
 * "input-streaming" and the UI showing false "interrupted" states.
 */

const originalFetch = globalThis.fetch;

function sseResponse(events: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const event of events) controller.enqueue(encoder.encode(event));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

async function collectParts(events: string[]) {
  globalThis.fetch = (async () => sseResponse(events)) as typeof fetch;
  const model = createOpenAICompatibleModel({ modelId: "test-model", apiKey: "k", baseUrl: null });
  const { stream } = await model.doStream({
    prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
  } as Parameters<typeof model.doStream>[0]);
  const parts = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  return parts;
}

/** Build one SSE `data:` line from a chunk object. */
function sseData(chunk: unknown): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("openai-compatible doStream", () => {
  it("emits a terminal tool-call part so streamText executes the tool", async () => {
    const parts = await collectParts([
      sseData({
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              id: "call_1",
              function: { name: "create_content", arguments: JSON.stringify({ topic: "Juma Mubarak" }) },
            }],
          },
        }],
      }),
      sseData({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }),
      "data: [DONE]\n\n",
    ]);

    const toolCall = parts.find((p) => p.type === "tool-call");
    expect(toolCall).toBeDefined();
    expect(toolCall).toMatchObject({
      type: "tool-call",
      toolCallId: "call_1",
      toolName: "create_content",
      input: '{"topic":"Juma Mubarak"}',
    });
    const finish = parts.find((p) => p.type === "finish");
    expect(finish).toMatchObject({ finishReason: "tool-calls" });
  });

  it("captures usage sent in the trailing include_usage chunk", async () => {
    const parts = await collectParts([
      sseData({ choices: [{ delta: { content: "Hello" } }] }),
      sseData({ choices: [{ delta: {}, finish_reason: "stop" }] }),
      sseData({ choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }),
      "data: [DONE]\n\n",
    ]);

    const finish = parts.find((p) => p.type === "finish");
    expect(finish).toMatchObject({
      finishReason: "stop",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
  });

  it("ends a truncated stream with an error part and finishReason error", async () => {
    const parts = await collectParts([
      'data: {"choices":[{"delta":{"content":"Partial ans"}}]}\n\n',
      // server closes without finish_reason / [DONE]
    ]);

    expect(parts.some((p) => p.type === "error")).toBe(true);
    const finish = parts.find((p) => p.type === "finish");
    expect(finish).toMatchObject({ finishReason: "error" });
  });
});
