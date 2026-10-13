import { describe, it, expect, vi } from "vitest";
import { streamText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { LanguageModelV2, LanguageModelV2StreamPart } from "@ai-sdk/provider";
import { createSearchCompatibleModel, nativeToolsUnsupported } from "../search-compatible-model";

function answer(text: string) {
  const parts: LanguageModelV2StreamPart[] = [{ type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: text }, { type: "text-end", id: "t" },
    { type: "finish", finishReason: "stop", usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } }];
  return { stream: new ReadableStream<LanguageModelV2StreamPart>({ start(c) { parts.forEach(p => c.enqueue(p)); c.close(); } }) };
}
describe("provider-independent Qurtiz search protocol", () => {
  it("uses the same model and original search tool, then resumes streaming for text-only providers", async () => {
    const search = vi.fn(async () => ({ searched: true, found: true, sources: [{ url: "https://example.com/current", title: "Current evidence" }] }));
    const generate = vi.fn(async () => ({ content: [{ type: "text" as const, text: '{"search":{"query":"current evidence"}}' }], finishReason: "stop" as const,
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 }, warnings: [] }));
    const raw: LanguageModelV2 = { specificationVersion: "v2", provider: "text-only-test", modelId: "configured", supportedUrls: {}, doGenerate: generate,
      doStream: async options => {
        if (options.tools?.length) throw Object.assign(new Error("Function calling is not supported"), { statusCode: 400 });
        expect(options.toolChoice).toBeUndefined();
        expect(JSON.stringify(options.prompt)).toContain("https://example.com/current");
        expect(options.prompt.some(m => m.role === "tool")).toBe(false);
        return answer("Verified [source](https://example.com/current)");
      } };
    const result = streamText({ model: createSearchCompatibleModel(raw), messages: [{ role: "user", content: "Search current evidence" }],
      tools: { web_search: tool({ inputSchema: z.object({ query: z.string() }), execute: search }) }, stopWhen: stepCountIs(3) });
    expect(await result.text).toContain("https://example.com/current");
    expect(search).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect((await result.steps)[0].toolResults[0].toolName).toBe("web_search");
  });
  it("preserves native tools and ordinary streaming without a planning call", async () => {
    const generate = vi.fn();
    const raw: LanguageModelV2 = { specificationVersion: "v2", provider: "native-test", modelId: "configured", supportedUrls: {}, doGenerate: generate,
      doStream: async () => answer("Hello") };
    expect(await streamText({ model: createSearchCompatibleModel(raw), prompt: "Hello" }).text).toBe("Hello");
    expect(generate).not.toHaveBeenCalled();
  });
  it("does not reinterpret quota, missing registry tools, auth or transport errors as unsupported tools", () => {
    for (const message of ["Rate limit reached", "HTTP 401", "attempted to call tool 'web_search' which was not in request.tools", "Connection reset"]) {
      expect(nativeToolsUnsupported(new Error(message))).toBe(false);
    }
    expect(nativeToolsUnsupported(Object.assign(new Error("tools not supported"), {statusCode:403}))).toBe(false);
  });
  it("never executes a search from an invalid text-protocol decision", async () => {
    const search = vi.fn();
    const raw: LanguageModelV2 = { specificationVersion: "v2", provider: "text-only-test", modelId: "configured", supportedUrls: {},
      doGenerate: async () => ({ content: [{type:"text",text:'{"search":{"query":""}}'}], finishReason:"stop",usage:{inputTokens:10,outputTokens:10,totalTokens:20},warnings:[] }),
      doStream: async () => { throw new Error("tools not supported"); } };
    const result = streamText({ model:createSearchCompatibleModel(raw), prompt:"Search", tools:{web_search:tool({inputSchema:z.object({query:z.string()}),execute:search})} });
    const errors: unknown[] = [];
    for await (const part of result.fullStream) if (part.type === "error") errors.push(part.error);
    expect(errors).toHaveLength(1); expect(search).not.toHaveBeenCalled();
  });
});

