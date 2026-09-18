import { describe, it, expect, vi } from "vitest";
import type { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2Prompt, LanguageModelV2StreamPart } from "@ai-sdk/provider";
import { createBudgetedChatModel, describeChatPayload, estimatePayloadTokens, isPayloadLimitError, resolveChatBudget, type ConversationContext } from "../chat-budget";
const budget = { contextTokens: 16000, requestTokens: 12000, outputTokens: 512, threshold: 0.75, recentTurns: 2, summaryTokens: 256 };
const message = (role: "user" | "assistant", text: string): LanguageModelV2Prompt[number] => ({ role, content: [{ type: "text", text }] });
const history = (): LanguageModelV2Prompt => [{ role: "system", content: "Agent rules and Brand Brain" },
  ...Array.from({ length: 20 }, (_, i) => [message("user", `Requirement ${i}: ${"old detail ".repeat(180)}`), message("assistant", `Decision ${i}: ${"response ".repeat(180)}`)]).flat(),
  message("user", "Recent preference: use blue"), message("assistant", "Confirmed"), message("user", "Continue the unresolved task")];
const result = { content: [{ type: "text", text: "Decisions: requirements retained; preference blue; unresolved task pending; tool post-id confirmed." }],
  finishReason: "stop", usage: { inputTokens: 100, outputTokens: 25, totalTokens: 125 }, warnings: [] } as Awaited<ReturnType<LanguageModelV2["doGenerate"]>>;
function stream(parts: LanguageModelV2StreamPart[]) { return new ReadableStream<LanguageModelV2StreamPart>({ start(c) { parts.forEach(p => c.enqueue(p)); c.close(); } }); }
function fixture(context?: ConversationContext) {
  const generate = vi.fn(async (_options: LanguageModelV2CallOptions) => { void _options; return result; });
  const streaming = vi.fn(async (_options: LanguageModelV2CallOptions) => { void _options; return ({ stream: stream([{ type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: "Continued" }]) }); });
  const raw: LanguageModelV2 = { specificationVersion: "v2", provider: "custom", modelId: "any-model", supportedUrls: {}, doGenerate: generate, doStream: streaming };
  const save = vi.fn(async (_context: ConversationContext) => { void _context; });
  const model = createBudgetedChatModel({ model: raw, budget, context, save });
  return { model, raw, save, generate, streaming };
}
async function drain(s: ReadableStream<LanguageModelV2StreamPart>) { const out: LanguageModelV2StreamPart[] = []; const reader = s.getReader(); while (true) { const next = await reader.read(); if (next.done) break; out.push(next.value); } return out; }

describe("provider-neutral chat payload budgeting", () => {
  it("does not misclassify a temporary TPM/RPM 429 as request capacity", async () => {
    const error = { statusCode: 429, message: "TPM limit 8000 Used 7990 Requested 1000; retry later" };
    expect(isPayloadLimitError(error)).toBe(false);
    const f = fixture(); f.streaming.mockRejectedValueOnce(error);
    await expect(f.model.doStream({ prompt: [message("user", "Hi")] })).rejects.toBe(error);
    expect(f.generate).not.toHaveBeenCalled(); expect(f.save).not.toHaveBeenCalled();
  });
  it("retains compacted current tool results when older history must also be compressed", async () => {
    const f = fixture();
    const prompt: LanguageModelV2Prompt = [{ role: "system", content: "Protected rules ".repeat(600) }, message("user", "Older requirements ".repeat(1100)), message("assistant", "Understood"), message("user", "Continue"),
      { role: "assistant", content: [{ type: "tool-call", toolName: "get_content", toolCallId: "current-read", input: {} }] },
      { role: "tool", content: [{ type: "tool-result", toolName: "get_content", toolCallId: "current-read", output: { type: "json", value: { details: "Source detail ".repeat(4000) } } }] }];
    const original = JSON.stringify(prompt);
    await f.model.doStream({ prompt });
    const sent = f.streaming.mock.calls[0][0];
    expect(JSON.stringify(sent.prompt)).toContain("Compact tool reference");
    expect(JSON.stringify(sent.prompt)).toContain("current-read");
    expect(estimatePayloadTokens(sent)).toBeLessThan((budget.requestTokens - budget.outputTokens) * budget.threshold);
    expect(JSON.stringify(prompt)).toBe(original);
  });
  it("uses source excerpts rather than extra AI calls when summary generation is rate limited", async () => {
    const f = fixture(); f.generate.mockRejectedValue({ statusCode: 429, message: "RPM exceeded" });
    await f.model.doStream({ prompt: history() });
    expect(f.streaming).toHaveBeenCalledTimes(1);
    expect(f.save.mock.calls.at(-1)![0].summary).toContain("verbatim reference");
    expect(f.generate).toHaveBeenCalledTimes(1);
  });
  it("includes system, history, tool schemas and options in the estimate", () => {
    const base = { prompt: [message("user", "Hello")] };
    expect(estimatePayloadTokens({ ...base, tools: [{ description: "large schema ".repeat(1000) }], providerOptions: { context: "Brand Brain" } })).toBeGreaterThan(estimatePayloadTokens(base));
    expect(estimatePayloadTokens("漢字".repeat(100))).toBeGreaterThan(estimatePayloadTokens("a".repeat(100)));
  });
  it("supports model, provider and default limits without tying behavior to a specific model", () => {
    const env = { QURTIZ_CHAT_LIMITS_JSON: JSON.stringify({ default: { requestTokens: 9000 }, groq: { requestTokens: 7000 }, "groq/example": { requestTokens: 5000 } }) };
    expect(resolveChatBudget("groq", "example", env).requestTokens).toBe(5000);
    expect(resolveChatBudget("groq", "other", env).requestTokens).toBe(7000);
    expect(resolveChatBudget("custom", "unknown", env).requestTokens).toBe(9000);
    expect(() => resolveChatBudget("x", "y", { QURTIZ_CHAT_LIMITS_JSON: '{"default":{"threshold":1}}' })).toThrow();
  });
  it("compresses full older history, persists memory and leaves recent turns and original history intact", async () => {
    const f = fixture(); const prompt = history(); const original = JSON.stringify(prompt);
    await f.model.doStream({ prompt, tools: [{ type: "function", name: "research", description: "Research", inputSchema: { type: "object" } }] });
    const sent = f.streaming.mock.calls[0][0];
    expect(estimatePayloadTokens(sent)).toBeLessThan((budget.requestTokens - budget.outputTokens) * budget.threshold);
    expect(sent.prompt.slice(-3)).toEqual(prompt.slice(-3));
    expect(sent.tools?.[0].name).toBe("research");
    expect(f.generate.mock.calls.map(call => JSON.stringify(call)).join("")).toContain("Requirement 0");
    expect(f.save).toHaveBeenCalled(); expect(JSON.stringify(prompt)).toBe(original);
    const memory = f.save.mock.calls.at(-1)![0];
    const restored = fixture(memory);
    await restored.model.doStream({ prompt });
    expect(restored.generate).not.toHaveBeenCalled();
    expect(JSON.stringify(restored.streaming.mock.calls[0][0].prompt)).toContain(memory.summary);
  });
  it("invalidates summarized context when an earlier message is edited", async () => {
    const f = fixture(); const prompt = history(); await f.model.doStream({ prompt });
    const memory = f.save.mock.calls.at(-1)![0]; const restored = fixture(memory);
    prompt[1] = message("user", "Corrected requirement " + "updated ".repeat(300));
    await restored.model.doStream({ prompt });
    expect(restored.generate).toHaveBeenCalled();
    expect(restored.generate.mock.calls.map(call => JSON.stringify(call)).join("")).toContain("Corrected requirement");
  });
  it("checks growing tool results at every step and preserves current tool exchange", async () => {
    const f = fixture(); const prompt = history(); await f.model.doStream({ prompt });
    const call = { type: "tool-call" as const, toolCallId: "c1", toolName: "research", input: {} };
    const output = { type: "tool-result" as const, toolCallId: "c1", toolName: "research", output: { type: "text" as const, value: "Verified findings" } };
    const next: LanguageModelV2Prompt = [...prompt, { role: "assistant", content: [call] }, { role: "tool", content: [output] }];
    await f.model.doStream({ prompt: next });
    expect(f.streaming.mock.calls.at(-1)![0].prompt.slice(-2)).toEqual(next.slice(-2));
  });
  it("retries an HTTP 413 once using stronger compression and a learned provider limit", async () => {
    const f = fixture(); f.streaming.mockRejectedValueOnce(Object.assign(new Error("TPM limit 12000 Requested 15000"), { statusCode: 413 }));
    await f.model.doStream({ prompt: history() });
    expect(f.streaming).toHaveBeenCalledTimes(2);
    expect(estimatePayloadTokens(f.streaming.mock.calls[1][0])).toBeLessThan(estimatePayloadTokens(f.streaming.mock.calls[0][0]));
    expect(f.save.mock.calls.at(-1)![0].learnedLimit).toBe(12000);
  });
  it("handles early SSE limit errors without exposing a failed attempt to the UI", async () => {
    const f = fixture(); f.streaming.mockResolvedValueOnce({ stream: stream([{ type: "stream-start", warnings: [] }, { type: "text-start", id: "failed" }, { type: "error", error: Object.assign(new Error("Request too large"), { statusCode: 413 }) }]) });
    const r = await f.model.doStream({ prompt: history() }); const parts = await drain(r.stream);
    expect(f.streaming).toHaveBeenCalledTimes(2); expect(parts.some(p => p.type === "error")).toBe(false);
    expect(JSON.stringify(parts)).not.toContain("failed");
  });
  it("does not replay a stream after text or tool execution has begun", async () => {
    const f = fixture(); f.streaming.mockResolvedValueOnce({ stream: stream([{ type: "text-delta", id: "t", delta: "Partial" }, { type: "error", error: { statusCode: 413 } }]) });
    const r = await f.model.doStream({ prompt: [message("user", "Hi")] });
    expect((await drain(r.stream)).at(-1)?.type).toBe("error"); expect(f.streaming).toHaveBeenCalledTimes(1);
  });
  it("never retries indefinitely or retries unrelated errors", async () => {
    const f = fixture(); f.streaming.mockRejectedValue(Object.assign(new Error("Request too large"), { statusCode: 413 }));
    await expect(f.model.doStream({ prompt: history() })).rejects.toThrow("Request too large"); expect(f.streaming).toHaveBeenCalledTimes(2);
    const other = fixture(); other.streaming.mockRejectedValue(new Error("Invalid API key"));
    await expect(other.model.doStream({ prompt: [message("user", "Hi")] })).rejects.toThrow("Invalid API key"); expect(other.streaming).toHaveBeenCalledTimes(1);
  });
  it("rejects an oversized current message without truncating or silently dropping it", async () => {
    const f = fixture(); await expect(f.model.doStream({ prompt: [message("user", "new ".repeat(10000))] })).rejects.toThrow("current message");
    expect(f.streaming).not.toHaveBeenCalled(); expect(f.save).not.toHaveBeenCalled();
  });
  it("recognizes provider context and TPM errors without confusing ordinary 429 errors", () => {
    expect(isPayloadLimitError(new Error("maximum context length exceeded"))).toBe(true);
    expect(isPayloadLimitError(new Error("TPM limit 6000 Requested 7000"))).toBe(true);
    expect(isPayloadLimitError({ statusCode: 429, message: "Rate limited requests per minute" })).toBe(false);
  });
  it("budgets attachments as multimodal inputs rather than base64 text and preserves their data", async () => {
    const f = fixture();
    const prompt: LanguageModelV2Prompt = [{ role: "user", content: [{ type: "text", text: "Analyze this" },
      { type: "file", mediaType: "image/png", data: new Uint8Array(100000) }] }];
    expect(estimatePayloadTokens({ prompt })).toBeLessThan(5000);
    expect(estimatePayloadTokens({ prompt }, 6000)).toBeGreaterThan(6000);
    await f.model.doStream({ prompt });
    expect(f.streaming.mock.calls[0][0].prompt).toEqual(prompt);
  });
  it("passes the cancellation signal through and stops aborted compression before a provider call", async () => {
    const controller = new AbortController(); controller.abort();
    const f = fixture();
    await expect(f.model.doStream({ prompt: history(), abortSignal: controller.signal })).rejects.toThrow();
    expect(f.generate).not.toHaveBeenCalled(); expect(f.streaming).not.toHaveBeenCalled();
  });

  it("sends a restored summary in place of its source history, exactly once", async () => {
    const f = fixture(); const prompt = history(); await f.model.doStream({ prompt });
    const memory = f.save.mock.calls.at(-1)![0]; const restored = fixture(memory);
    const next = [...prompt, message("assistant", "Continued"), message("user", "Thanks")];
    await restored.model.doStream({ prompt: next });
    const sent = restored.streaming.mock.calls[0][0];
    expect(JSON.stringify(sent.prompt)).not.toContain("Requirement 0");
    expect(sent.prompt.filter(m => JSON.stringify(m).includes("Earlier conversation reference"))).toHaveLength(1);
    expect(sent.prompt.slice(-2)).toEqual(next.slice(-2)); expect(restored.generate).not.toHaveBeenCalled();
  });
  it("compacts oversized tool data once without removing small recent user turns or replaying tools", async () => {
    const f = fixture(); const output = { type: "tool-result" as const, toolName: "get_research", toolCallId: "research-1",
      output: { type: "json" as const, value: { findings: "Verified source data ".repeat(3000) } } };
    const prompt: LanguageModelV2Prompt = [message("user", "Find research"),
      { role: "assistant", content: [{ type: "tool-call", toolCallId: "research-1", toolName: "get_research", input: {} }] },
      { role: "tool", content: [output] }, message("assistant", "Found it"), message("user", "Thanks")];
    const original = JSON.stringify(prompt); await f.model.doStream({ prompt });
    const sent = f.streaming.mock.calls[0][0];
    expect(sent.prompt.filter(m => m.role === "user")).toEqual(prompt.filter(m => m.role === "user"));
    expect(JSON.stringify(sent.prompt)).toContain("research-1"); expect(JSON.stringify(sent.prompt)).toContain("Compact tool reference");
    expect(JSON.stringify(prompt)).toBe(original);
    const restored = fixture(f.save.mock.calls.at(-1)![0]); await restored.model.doStream({ prompt });
    expect(restored.generate).not.toHaveBeenCalled();
  });
  it("uses the configured attachment reserve consistently in every budget check", async () => {
    const f = fixture(); const model = createBudgetedChatModel({ model: f.raw, budget: { ...budget, attachmentTokens: 100 }, save: f.save });
    const prompt: LanguageModelV2Prompt = [{ role: "user", content: [{ type: "file", mediaType: "image/png", data: new Uint8Array(100) }] }];
    await model.doStream({ prompt }); expect(f.streaming).toHaveBeenCalledTimes(1);
    const diagnostic = describeChatPayload(f.streaming.mock.calls[0][0], 100);
    expect(diagnostic.attachments).toBe(100); expect(diagnostic.currentMessage).toBe(0);
    expect(describeChatPayload({ prompt: [message("user", "Hello")] }).attachments).toBe(0);
  });

  it("recovers from reasoning-only truncated summaries with a bounded larger generation allowance", async () => {
    const f = fixture(); f.generate.mockResolvedValueOnce({ ...result, content: [], finishReason: "length" });
    const events: string[] = [];
    const model = createBudgetedChatModel({ model: f.raw, budget: { ...budget, outputTokens: 2048 }, save: f.save,
      onCompressionDiagnostic: event => events.push(event.mode) });
    await model.doStream({ prompt: history() });
    expect(events).toContain("retry"); expect(events).toContain("ai");
    expect(f.generate.mock.calls[1][0].maxOutputTokens).toBeGreaterThan(f.generate.mock.calls[0][0].maxOutputTokens!);
    for (const [call] of f.generate.mock.calls) expect(estimatePayloadTokens(call) + call.maxOutputTokens!).toBeLessThan((budget.requestTokens - 1500) * budget.threshold);
    expect(f.streaming).toHaveBeenCalledTimes(1);
  });
  it("continues with labeled faithful excerpts when every summary is truncated, and persists them", async () => {
    const f = fixture(); f.generate.mockResolvedValue({ ...result, content: [], finishReason: "length" });
    const prompt = history(); prompt[1] = message("user", "Preference: always use plain English. Never publish without approval.");
    const original = JSON.stringify(prompt); await f.model.doStream({ prompt });
    const memory = f.save.mock.calls.at(-1)![0];
    expect(memory.summary).toContain("Selected verbatim reference excerpts");
    expect(memory.summary).toContain("Never publish without approval");
    expect(f.streaming.mock.calls[0][0].prompt.slice(-3)).toEqual(prompt.slice(-3));
    expect(JSON.stringify(prompt)).toBe(original);
    const restored = fixture(memory); await restored.model.doStream({ prompt }); expect(restored.generate).not.toHaveBeenCalled();
  });
  it("recovers empty final text and never persists a truncated AI draft as completed memory", async () => {
    const f = fixture(); f.generate.mockResolvedValue({ ...result, content: [{ type: "text", text: "Incomplete invented draft" }], finishReason: "length" });
    await f.model.doStream({ prompt: history() });
    expect(f.save.mock.calls.at(-1)![0].summary).not.toContain("Incomplete invented draft");
    const empty = fixture(); empty.generate.mockResolvedValue({ ...result, content: [], finishReason: "stop" });
    await empty.model.doStream({ prompt: history() }); expect(empty.streaming).toHaveBeenCalledTimes(1);
  });
  it("does not mask provider authentication/network failures as successful compression", async () => {
    const f = fixture(); f.generate.mockRejectedValue(new Error("Invalid API key"));
    await expect(f.model.doStream({ prompt: history() })).rejects.toThrow("Invalid API key");
    expect(f.generate).toHaveBeenCalledTimes(1); expect(f.streaming).not.toHaveBeenCalled(); expect(f.save).not.toHaveBeenCalled();
  });

});
