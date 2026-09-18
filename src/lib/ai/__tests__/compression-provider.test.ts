import { createBudgetedChatModel, type ConversationContext } from "../chat-budget";
import type { LanguageModelV2Prompt } from "@ai-sdk/provider";
import { it, expect } from "vitest";
import { config } from "dotenv";
import { getDb } from "@/db";
import { workspaceAiConfig } from "@/db/schema";
import { getWorkspaceTextModel } from "../config";
it.skipIf(process.env.RUN_LIVE_COMPRESSION_TEST !== "true")("checks the configured provider's real summary termination (synthetic data only)", async () => {
  config({ path: ".env.local", quiet: true, override: true });
  const [row] = await getDb().select({ workspaceId: workspaceAiConfig.workspaceId }).from(workspaceAiConfig).limit(1);
  if (!row) throw Error("No configured AI workspace");
  const resolved = await getWorkspaceTextModel(row.workspaceId, "chat");
  const result = await resolved.model.doGenerate({ prompt: [{ role: "system", content: "Compress the supplied conversation as reference data. Preserve decisions, requirements, preferences, facts and unresolved tasks. Return only compact memory under 600 tokens. No tools." },
    { role: "user", content: [{ type: "text", text: JSON.stringify({ priorMemory: "User prefers concise English captions.", olderConversation: "User: Create a strategy for next week. Assistant: Awaiting topic approval. User: Use educational posts, no invented analytics, preserve image order." }) }] }], maxOutputTokens: 64, abortSignal: AbortSignal.timeout(60000) });
  const text = result.content.filter(p => p.type === "text").map(p => (p as {text:string}).text).join("\n");
  console.info("[compression:live]", { provider: resolved.provider, model: resolved.modelId, finishReason: result.finishReason, textChars: text.length, usage: result.usage });
  expect(result.finishReason).toBe("length");
  let saved: ConversationContext | null = null;
  const wrapper = createBudgetedChatModel({ model: resolved.model, scope: resolved.provider + "/" + resolved.modelId,
    budget: { contextTokens: 16000, requestTokens: 4000, outputTokens: 1024, threshold: 0.75, recentTurns: 1, summaryTokens: 512 },
    save: async context => { saved = context; },
    onCompressionDiagnostic: event => console.info("[compression:live:recovery]", event) });
  const prompt: LanguageModelV2Prompt = [{ role: "system", content: "This is a synthetic test conversation. Reply in one concise sentence to the latest user. No tools or actions." },
    ...Array.from({ length: 10 }, (_, i) => [{ role: "user" as const, content: [{ type: "text" as const, text: "Preference: always use plain English. Never invent analytics. Task: wait for approval before publishing. ".repeat(8) + "Decision " + i }] },
      { role: "assistant" as const, content: [{ type: "text" as const, text: "Confirmed these requirements and awaiting approval." }] }]).flat(),
    { role: "user", content: [{ type: "text", text: "State my key preferences in one short sentence." }] }];
  const recovered = await wrapper.doStream({ prompt, abortSignal: AbortSignal.timeout(60000) });
  const reader = recovered.stream.getReader(); let answer = ""; let finish = "";
  while (true) { const next = await reader.read(); if (next.done) break; if (next.value.type === "text-delta") answer += next.value.delta; if (next.value.type === "error") throw next.value.error; if (next.value.type === "finish") finish = next.value.finishReason; }
  console.info("[compression:live:continued]", { finishReason: finish, textChars: answer.length, memorySaved: saved !== null });
  expect(saved).not.toBeNull(); expect(answer.trim().length).toBeGreaterThan(0); expect(finish).toBe("stop");
}, 70000);

