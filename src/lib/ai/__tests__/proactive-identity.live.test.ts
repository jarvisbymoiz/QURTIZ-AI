import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { streamText, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { getDb } from "@/db";
import { workspaceAiConfig } from "@/db/schema";
import { getWorkspaceTextModel } from "../config";
import { buildSystemPrompt } from "../agent";
import { createLazyChatTools } from "../chat-tools";
import { createBudgetedChatModel, resolveChatBudget, type ConversationContext } from "../chat-budget";

// Real configured provider; controlled tool fixtures prevent writes/publishing.
// Tests reasoning and tool routing, not provider publishing or browser E2E.
describe("proactive identity with configured provider", () => {
  it.skipIf(process.env.RUN_LIVE_IDENTITY_PROVIDER !== "true")("acts across creation, refinement, carousel, Studio, scheduling and usual style", async () => {
    config({ path: ".env.local", quiet: true, override: true });
    const [row] = await getDb().select({ workspaceId: workspaceAiConfig.workspaceId }).from(workspaceAiConfig).limit(1);
    if (!row) throw Error("Configured provider required");
    const resolved = await getWorkspaceTextModel(row.workspaceId, "chat");
    const created: { id: string; topic: string; format: string; status: string }[] = [];
    let schedules = 0;
    const tools = {
      get_brand_brain: tool({ description: "Read Brand Brain", inputSchema: z.object({}), execute: async () => ({ businessName: "Creative Supplies", offer: "Canva Pro annual access; CTA: message us for current pricing", platforms: ["facebook"], tone: "professional", language: "English" }) }),
      list_workspace_facts: tool({ description: "Read relevant shared preferences", inputSchema: z.object({}), execute: async () => ({ facts: ["Professional English copy; no emojis"] }) }),
      create_content: tool({ description: "Create a complete post and save in Content Studio for review", inputSchema: z.object({ topic: z.string(), platforms: z.array(z.enum(["facebook", "instagram"])), preferredFormat: z.enum(["single_image", "carousel", "reel", "story", "text_post"]).optional(), toneOverride: z.string().optional(), objective: z.string().optional() }), execute: async input => { const item = { id: "post-" + (created.length + 1), topic: input.topic, format: input.preferredFormat ?? "single_image", status: "ready_for_review" }; created.push(item); return { created: true, itemId: item.id, status: item.status }; } }),
      get_content: tool({ description: "Read a saved post and variants", inputSchema: z.object({ itemId: z.string() }), execute: async ({ itemId }) => ({ item: created.find(item => item.id === itemId), variants: [{ platform: "facebook", caption: "Create more with Canva Pro. Message us for current pricing.", hashtags: ["CanvaPro"], visualPrompt: "Professional branded offer design" }] }) }),
      schedule_content: tool({ description: "Schedule APPROVED content in workspace timezone; default time if omitted", inputSchema: z.object({ contentItemId: z.string(), date: z.string(), time: z.string().optional(), timezone: z.string().optional() }), execute: async input => { expect(created.find(item => item.id === input.contentItemId)?.status).toBe("approved"); schedules++; return { scheduled: true, scheduledAt: input.date, status: "queued" }; } }),
    };
    const messages: ModelMessage[] = [];
    const from = process.env.LIVE_IDENTITY_FROM;
    if (from) {
      created.push({ id: "post-1", topic: "Canva Pro offer", format: "single_image", status: "ready_for_review" }, { id: "post-2", topic: "Professional Canva Pro offer", format: "single_image", status: "ready_for_review" }, { id: "post-3", topic: "Canva Pro offer", format: "carousel", status: "approved" });
      messages.push({ role: "user", content: "Create a Facebook post for my Canva Pro annual-access offer and turn it into a carousel. Use professional English, no emojis and message us for current pricing." }, { role: "assistant", content: "Created carousel post-3 in Content Studio, approved and scheduled for tomorrow. Earlier versions post-1 and post-2 are ready for review." });
    }
    let context: ConversationContext | null = null;
    let lastRequestAt = 0;
    const spacing = Number(process.env.LIVE_IDENTITY_SPACING_MS ?? 30000);
    const pacedModel = { ...resolved.model, doGenerate: resolved.model.doGenerate.bind(resolved.model),
      doStream: async (options: Parameters<typeof resolved.model.doStream>[0]) => {
        const delay = Math.max(0, lastRequestAt + spacing - Date.now());
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        lastRequestAt = Date.now();
        return resolved.model.doStream(options);
      } };

    const system = buildSystemPrompt({ workspaceName: "Provider test fixture", workspaceTimezone: "Asia/Karachi", brandSummary: "", memories: [], lazyContext: true, persistentContext: JSON.stringify({ personal: [{ key: "copy.tone", content: "Professional English captions, no emojis" }], workspace: [], profile: { platforms: "Facebook" } }) });
    const requests = ["Create a Facebook post for my new offer", "Make it more professional", "Turn this into a carousel", "Create it in Content Studio", "Schedule it for tomorrow", "Use my usual style", "Make another version"];
    for (const request of from ? requests.slice(requests.indexOf(from)) : requests) {
      if (request.startsWith("Schedule")) created.at(-1)!.status = "approved"; // approved fixture, never implicit Agent approval
      messages.push({ role: "user", content: request });
      const lazy = createLazyChatTools(tools, request);
      const model = createBudgetedChatModel({ model: pacedModel, context, scope: resolved.provider + "/" + resolved.modelId, budget: resolveChatBudget(resolved.provider, resolved.modelId), save: async value => { context = value; }, onDiagnostic: value => { if (value.phase === "ready") console.info("[identity:fixture-budget]", { total: value.contributions.total, usable: value.usableInputTokens }); } });
      const before = created.length;
      const result = streamText({ model, system, messages, tools: lazy.tools, prepareStep: lazy.prepareStep, stopWhen: stepCountIs(6), abortSignal: AbortSignal.timeout(240000) });
      const text = await result.text;
      console.info("[identity:synthetic-fixture-response]", { request, text });
      const steps = await result.steps;
      console.info("[identity:fixture-actions]", steps.flatMap(step => step.toolResults.map(result => result.toolName)));
      expect(text.trim().length).toBeGreaterThan(0);
      if (request.startsWith("Create a Facebook")) expect(created.length).toBeGreaterThan(before);
      if (request.startsWith("Turn this")) expect(created.at(-1)?.format).toBe("carousel");
      if (request === "Create it in Content Studio") expect(created.length).toBe(before);
      if (request.startsWith("Schedule")) expect(schedules).toBe(1);
      if (request === "Make another version") expect(created.length).toBeGreaterThan(before);
      expect(text).not.toMatch(/what (tone|audience|CTA|style) (do|would)/i);
      messages.push(...(await result.response).messages);
      console.info("[identity:provider]", { request, steps: steps.length, actions: steps.flatMap(step => step.toolResults.map(result => result.toolName)) });
    }
  }, 1200000);
});
