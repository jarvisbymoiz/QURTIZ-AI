import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { stepCountIs, streamText, type ModelMessage } from "ai";
import { getDb } from "@/db";
import { workspaceAiConfig } from "@/db/schema";
import { getWorkspaceTextModel } from "../config";
import { buildSystemPrompt } from "../agent";
import { repairWrappedToolCall } from "../stream-errors";
import { buildAgentTools } from "../tools";
import { createLazyChatTools } from "../chat-tools";
import { createBudgetedChatModel, resolveChatBudget } from "../chat-budget";

// Reads provider configuration only. All outbound context is fictional.
// Every tool implementation is replaced with a fixture BEFORE model execution,
// so this routing test cannot modify customer posts or call social providers.
describe("existing-post editing with configured provider and synthetic tools", () => {
  it.skipIf(process.env.RUN_LIVE_EDIT_PROVIDER !== "true")("finds previous-session posts, patches an existing carousel, clarifies ambiguity and reschedules", async () => {
    config({ path: ".env.local", quiet: true, override: true });
    const [configuration] = await getDb().select({ workspaceId: workspaceAiConfig.workspaceId }).from(workspaceAiConfig).limit(1);
    if (!configuration) throw Error("Configured provider required");
    const resolved = await getWorkspaceTextModel(configuration.workspaceId, "chat");
    let lastRequest = 0;
    const paced = { ...resolved.model, doGenerate: resolved.model.doGenerate.bind(resolved.model), doStream: async (options: Parameters<typeof resolved.model.doStream>[0]) => {
      const delay = Math.max(0, lastRequest + 30000 - Date.now());
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      lastRequest = Date.now(); return resolved.model.doStream(options);
    } };
    const itemId = randomUUID(), variantId = randomUUID(), secondId = randomUUID();
    for (const scenario of ["recent", "carousel", "ambiguous", "schedule"] as const) {
      const tools = buildAgentTools({ workspaceId: randomUUID(), userId: randomUUID(), runId: randomUUID() });
      for (const entry of Object.values(tools)) if (entry.execute) entry.execute = async () => ({ ok: false, error: "Unavailable in this synthetic routing fixture" });
      const edits: Record<string, unknown>[] = []; const schedules: Record<string, unknown>[] = [];
      const updatedAt = "2026-09-18T00:00:00.000Z";
      tools.find_posts.execute = async () => ({ results: [{ id: itemId, topic: "Synthetic creative offer", format: "carousel", status: "ready_for_review", updatedAt }, ...(scenario === "ambiguous" ? [{ id: secondId, topic: "Synthetic product launch", format: "carousel", status: "ready_for_review", updatedAt }] : [])], selection: "Explicit last means first result. Multiple matches with no clear target require one short clarification." });
      tools.get_content.execute = async () => ({ item: { id: itemId, topic: "Synthetic creative offer", format: "carousel", status: scenario === "schedule" ? "approved" : "ready_for_review", updatedAt, visualConcept: "Fictional branded offer design" }, variants: [{ id: variantId, platform: "facebook", format: "carousel", caption: "Synthetic original caption", hashtags: ["Original"], firstComment: "Synthetic comment", slides: [{ index: 0, slideNumber: 1, headline: "Synthetic first", visualPrompt: "Synthetic first design" }, { index: 1, slideNumber: 2, headline: "Synthetic second", visualPrompt: "Synthetic second design" }] }] });
      tools.edit_content.execute = async input => { const patch = input as Record<string, unknown>; edits.push(patch); return { ok: true, updated: true, itemId, status: "ready_for_review", message: "Updated the existing synthetic post; no new post created." }; };
      tools.schedule_content.execute = async input => { schedules.push(input as Record<string, unknown>); return { scheduled: true, updated: true, itemId, status: "queued" }; };
      const request = scenario === "recent" ? 'Change the caption of my last post to exactly "Updated synthetic caption".' : scenario === "carousel" ? 'Replace the second carousel slide headline with exactly "Synthetic new headline". Leave everything else unchanged.' : scenario === "ambiguous" ? "Edit my post" : "Reschedule this approved post to tomorrow at 10:15 AM in Asia/Karachi.";
      const messages: ModelMessage[] = [...(scenario === "carousel" || scenario === "schedule" ? [{ role: "assistant" as const, content: `The post we are reviewing is ${itemId}. Its Facebook variant is ${variantId}.` }] : []), { role: "user", content: request }];
      const lazy = createLazyChatTools(tools, request);
      const model = createBudgetedChatModel({ model: paced, scope: resolved.provider + "/" + resolved.modelId, budget: resolveChatBudget(resolved.provider, resolved.modelId), save: async () => {} });
      const result = streamText({ model, system: buildSystemPrompt({ workspaceName: "Synthetic editing fixture", workspaceTimezone: "Asia/Karachi", brandSummary: "", memories: [], lazyContext: true, currentTask: request }), messages, tools: lazy.tools, prepareStep: lazy.prepareStep, stopWhen: stepCountIs(7), experimental_repairToolCall: repairWrappedToolCall, abortSignal: AbortSignal.timeout(240000) });
      const text = await result.text; const actions = (await result.steps).flatMap(step => step.toolResults.map(tool => tool.toolName));
      console.info("[post-edit:synthetic-routing]", { scenario, actions, edits: edits.length, schedules: schedules.length, text });
      expect(text.trim()).not.toBe(""); expect(actions).not.toContain("create_content");
      if (scenario === "recent" || scenario === "carousel") {
        expect(edits).toHaveLength(1); expect(edits[0]).toMatchObject({ itemId, expectedUpdatedAt: updatedAt });
        expect(actions).toContain("get_content");
        if (scenario === "recent") { expect(actions).toContain("find_posts"); expect(edits[0]).toMatchObject({ variants: [{ variantId, caption: "Updated synthetic caption" }] }); }
        else expect(edits[0]).toMatchObject({ variants: [{ variantId, slideEdits: [{ slideNumber: 2, headline: "Synthetic new headline" }] }] });
      } else if (scenario === "ambiguous") { expect(actions).toContain("find_posts"); expect(edits).toHaveLength(0); expect(text).toMatch(/which|clarify|specify|choose/i); }
      else { expect(edits).toHaveLength(0); expect(schedules).toHaveLength(1); expect(schedules[0]).toMatchObject({ contentItemId: itemId, time: "10:15", timezone: "Asia/Karachi" }); }
    }
  }, 900000);
});
