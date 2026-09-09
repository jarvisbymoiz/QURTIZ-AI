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

  it("unwraps a {\"json\": ...} arguments envelope in the terminal part (deltas stay raw)", async () => {
    const raw = '{"json":{"topic":"Juma Mubarak","platforms":["facebook"]}}';
    const parts = await collectParts([
      sseData({
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              id: "call_1",
              function: { name: "create_content", arguments: raw },
            }],
          },
        }],
      }),
      sseData({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }),
      "data: [DONE]\n\n",
    ]);

    const toolCall = parts.find((p) => p.type === "tool-call");
    expect(toolCall).toMatchObject({
      type: "tool-call",
      toolCallId: "call_1",
      toolName: "create_content",
      input: '{"topic":"Juma Mubarak","platforms":["facebook"]}',
    });
    // Client display keeps the RAW streamed text — only the terminal part
    // (what the SDK validates/executes) is normalized.
    const delta = parts.find((p) => p.type === "tool-input-delta");
    expect(delta).toMatchObject({ delta: raw });
  });

  it("keeps a normal tool-call arguments string byte-identical", async () => {
    const raw = '{"topic": "Juma Mubarak", "platforms": ["facebook"]}';
    const parts = await collectParts([
      sseData({
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              id: "call_1",
              function: { name: "create_content", arguments: raw },
            }],
          },
        }],
      }),
      sseData({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }),
      "data: [DONE]\n\n",
    ]);

    const toolCall = parts.find((p) => p.type === "tool-call");
    expect(toolCall).toMatchObject({ input: raw });
  });

  it("keeps malformed tool-call arguments raw so validation fails honestly", async () => {
    const parts = await collectParts([
      sseData({
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              id: "call_1",
              function: { name: "create_content", arguments: '{"topic":' },
            }],
          },
        }],
      }),
      sseData({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }),
      "data: [DONE]\n\n",
    ]);

    const toolCall = parts.find((p) => p.type === "tool-call");
    expect(toolCall).toMatchObject({ input: '{"topic":' });
  });

  it("doGenerate unwraps a wrapped arguments envelope", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [{
            message: {
              content: null,
              tool_calls: [{
                id: "call_1",
                type: "function",
                function: {
                  name: "create_content",
                  arguments: '{"json":{"topic":"Juma Mubarak","platforms":["facebook"]}}',
                },
              }],
            },
            finish_reason: "tool_calls",
          }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;

    const model = createOpenAICompatibleModel({ modelId: "test-model", apiKey: "k", baseUrl: null });
    const result = await model.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    } as Parameters<typeof model.doGenerate>[0]);

    expect(result.content).toContainEqual({
      type: "tool-call",
      toolCallId: "call_1",
      toolName: "create_content",
      input: '{"topic":"Juma Mubarak","platforms":["facebook"]}',
    });
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

  it("surfaces a mid-stream provider error chunk as an honest failure", async () => {
    // OpenRouter reports 429s/upstream drops mid-stream as an error chunk
    // (no choices) followed by [DONE]. It used to be silently ignored, so
    // the stream ended with a bogus finish instead of the real reason.
    const parts = await collectParts([
      sseData({ choices: [{ delta: { content: "Partial" } }] }),
      sseData({ error: { message: "Rate limit exceeded", code: "limit_rpd" } }),
      "data: [DONE]\n\n",
    ]);

    const errorParts = parts.filter((p) => p.type === "error");
    expect(errorParts).toHaveLength(1);
    expect(errorParts[0]).toMatchObject({
      type: "error",
      error: "Rate limit exceeded (code: limit_rpd)",
    });
    const finishParts = parts.filter((p) => p.type === "finish");
    expect(finishParts).toHaveLength(1);
    expect(finishParts[0]).toMatchObject({ finishReason: "error" });
  });

  it("serializes BigInt and circular tool results without throwing", async () => {
    let capturedBody: unknown = null;
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
      capturedBody = JSON.parse(String(init?.body ?? "null"));
      return sseResponse([
        sseData({ choices: [{ delta: { content: "ok" } }] }),
        sseData({ choices: [{ delta: {}, finish_reason: "stop" }] }),
        "data: [DONE]\n\n",
      ]);
    }) as typeof fetch;

    const model = createOpenAICompatibleModel({ modelId: "test-model", apiKey: "k", baseUrl: null });
    const { stream } = await model.doStream({
      prompt: [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_1",
              output: { type: "json", value: { total: BigInt("9007199254740993"), loop } },
            },
          ],
        },
        { role: "user", content: [{ type: "text", text: "go" }] },
      ],
    } as Parameters<typeof model.doStream>[0]);

    // Consuming the stream must not throw — the request was built safely.
    const reader = stream.getReader();
    for (;;) {
      const { done } = await reader.read();
      if (done) break;
    }

    const messages = (capturedBody as { messages?: { role: string; content: string }[] }).messages ?? [];
    const toolMessage = messages.find((m) => m.role === "tool");
    expect(toolMessage?.content).toContain('"total":"9007199254740993"');
    expect(toolMessage?.content).toContain('"<circular>"');
    expect(() => JSON.parse(toolMessage?.content ?? "")).not.toThrow();
  });

  it("round-trips a normal tool result unchanged", async () => {
    let capturedBody: unknown = null;
    globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
      capturedBody = JSON.parse(String(init?.body ?? "null"));
      return sseResponse([
        sseData({ choices: [{ delta: {}, finish_reason: "stop" }] }),
        "data: [DONE]\n\n",
      ]);
    }) as typeof fetch;

    const model = createOpenAICompatibleModel({ modelId: "test-model", apiKey: "k", baseUrl: null });
    const { stream } = await model.doStream({
      prompt: [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_2",
              output: { type: "json", value: { results: [{ id: "i1", topic: "t" }] } },
            },
          ],
        },
        { role: "user", content: [{ type: "text", text: "go" }] },
      ],
    } as Parameters<typeof model.doStream>[0]);
    const reader = stream.getReader();
    for (;;) {
      const { done } = await reader.read();
      if (done) break;
    }

    const messages = (capturedBody as { messages?: { role: string; content: string }[] }).messages ?? [];
    const toolMessage = messages.find((m) => m.role === "tool");
    expect(JSON.parse(toolMessage?.content ?? "")).toEqual({ results: [{ id: "i1", topic: "t" }] });
  });
});
