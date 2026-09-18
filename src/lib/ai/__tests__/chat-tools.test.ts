import { describe, it, expect, vi } from "vitest";
import { tool, streamText, stepCountIs } from "ai";
import { z } from "zod";
import type { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2StreamPart } from "@ai-sdk/provider";
import { createLazyChatTools } from "../chat-tools";

describe("model-directed lazy chat tools", () => {
  it("exposes only an obvious current action without inheriting earlier intent", async () => {
    const existing = {
      create_content: tool({ inputSchema: z.object({}) }),
      schedule_content: tool({ inputSchema: z.object({}) }),
      get_analytics: tool({ inputSchema: z.object({}) }),
    };
    const creation = createLazyChatTools(existing, "Create a Facebook post for my new offer");
    expect((await creation.prepareStep({ steps: [] } as never))?.activeTools).toContain("create_content");
    expect((await creation.prepareStep({ steps: [] } as never))?.activeTools).not.toContain("get_analytics");
    expect((await createLazyChatTools(existing, "Schedule it for tomorrow").prepareStep({ steps: [] } as never))?.activeTools).toContain("schedule_content");
    expect((await createLazyChatTools(existing, "Hi").prepareStep({ steps: [] } as never))?.activeTools).not.toContain("create_content");
  });
  it("discovers and executes the original action without exposing unrelated schemas", async () => {
    const execute = vi.fn(async () => ({ verifiedId: "post-123" }));
    const existing = {
      get_brand_brain: tool({ inputSchema: z.object({}), execute: async () => ({ brand: "Test" }) }),
      list_workspace_facts: tool({ inputSchema: z.object({}), execute: async () => ({ facts: [] }) }),
      update_brand_memory: tool({ inputSchema: z.object({}), execute: async () => ({ saved: true }) }),
      create_content: tool({ inputSchema: z.object({}), execute }),
      get_analytics: tool({ inputSchema: z.object({}), execute: async () => ({ totals: {} }) }),
    };
    const lazy = createLazyChatTools(existing);
    for (const name of Object.keys(existing)) expect(lazy.tools[name]).toBe(existing[name as keyof typeof existing]);
    const calls: LanguageModelV2CallOptions[] = [];
    const model: LanguageModelV2 = { specificationVersion: "v2", provider: "fake", modelId: "fake", supportedUrls: {},
      doGenerate: async () => { throw Error("not used"); }, doStream: async options => {
        calls.push(options); const i = calls.length - 1;
        const parts: LanguageModelV2StreamPart[] = i === 0 ? [{ type: "tool-call", toolName: "discover_tools", toolCallId: "d", input: JSON.stringify({ names: ["create_content"] }) }]
          : i === 1 ? [{ type: "tool-call", toolName: "create_content", toolCallId: "c", input: "{}" }]
          : [{ type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: "Created post-123" }, { type: "text-end", id: "t" }];
        parts.push({ type: "finish", finishReason: i < 2 ? "tool-calls" : "stop", usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } });
        return { stream: new ReadableStream<LanguageModelV2StreamPart>({ start(c) { parts.forEach(p => c.enqueue(p)); c.close(); } }) };
      } };
    const result = streamText({ model, messages: [{ role: "user", content: "Create a post" }], tools: lazy.tools, prepareStep: lazy.prepareStep, stopWhen: stepCountIs(6) });
    expect(await result.text).toContain("post-123"); expect(execute).toHaveBeenCalledTimes(1);
    expect(calls[0].tools?.map(t => t.name)).not.toContain("create_content");
    expect(calls[1].tools?.map(t => t.name)).toContain("create_content");
    expect(calls.every(c => !c.tools?.some(t => t.name === "get_analytics"))).toBe(true);
    // A new run starts fresh, even when visible history contains discovery.
    const first = await lazy.prepareStep({ steps: [] } as never);
    expect(first?.activeTools).not.toContain("create_content");
  });
});
