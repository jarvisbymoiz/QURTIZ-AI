import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { streamText, stepCountIs } from "ai";
import type { LanguageModelV2, LanguageModelV2StreamPart } from "@ai-sdk/provider";
import { and, eq, sql } from "drizzle-orm";
import { getDb, resetDbPool } from "@/db";
import { agentIdentities, agentRuns, brandMemory, userAgentMemories, workspaceAiConfig, workspaceMembers, workspaces } from "@/db/schema";
import { CORE_IDENTITY_VERSION } from "../identity";
import { buildAgentTools } from "../tools";
import { createLazyChatTools } from "../chat-tools";
import { buildSystemPrompt } from "../agent";
import { boundedAgentReference } from "../memory-policy";
import { getWorkspaceTextModel } from "../config";
import { createBudgetedChatModel, resolveChatBudget } from "../chat-budget";
import { forgetAgentMemory, listAgentMemory, retrieveAgentMemory, saveAgentMemory, saveAgentProfile } from "../persistent-memory";

describe.skipIf(process.env.RUN_LIVE_TESTS !== "true")("database-backed isolated agent memory", { timeout: 30000 }, () => {
  const a = randomUUID(), b = randomUUID(), user = randomUUID(), teammate = randomUUID(), viewer = randomUUID();
  const actor = { workspaceId: a, userId: user };
  beforeAll(async () => {
    config({ path: ".env.local", quiet: true, override: true });
    const db = getDb();
    await db.insert(workspaces).values([{ id: a, name: "Memory isolation test A", slug: a, createdBy: user }, { id: b, name: "Memory isolation test B", slug: b, createdBy: user }]);
    await db.insert(workspaceMembers).values([{ workspaceId: a, userId: user, role: "owner" }, { workspaceId: b, userId: user, role: "owner" }, { workspaceId: a, userId: teammate, role: "editor" }, { workspaceId: a, userId: viewer, role: "viewer" }]);
  });
  afterAll(async () => {
    await getDb().delete(workspaces).where(eq(workspaces.id, a));
    await getDb().delete(workspaces).where(eq(workspaces.id, b));
  });
  it("persists, deduplicates and supersedes personal preferences for a new context", async () => {
    const input = { scope: "user" as const, type: "preference" as const, category: "copy" as const, content: "Always generate captions in English" };
    const first = await saveAgentMemory(actor, input);
    expect((await saveAgentMemory(actor, input)).id).toBe(first.id);
    expect((await retrieveAgentMemory({ ...actor }, "Write a caption")).personal[0].content).toContain("English");
    await saveAgentMemory(actor, { ...input, content: "From now on generate captions in Urdu" });
    const active = await listAgentMemory(actor);
    expect(active.personal).toHaveLength(1); expect(active.personal[0].content).toContain("Urdu");
    const versions = await getDb().select().from(userAgentMemories).where(and(eq(userAgentMemories.workspaceId, a), eq(userAgentMemories.userId, user)));
    expect(versions).toHaveLength(2); expect(versions.find(row => !row.active)?.supersededAt).not.toBeNull();
  });
  it("isolates personal user/workspace context while sharing authorized workspace facts", async () => {
    expect((await listAgentMemory({ workspaceId: a, userId: teammate })).personal).toEqual([]);
    expect((await listAgentMemory({ workspaceId: b, userId: user })).personal).toEqual([]);
    await expect(listAgentMemory({ workspaceId: b, userId: teammate })).rejects.toThrow("permission");
    await saveAgentMemory(actor, { scope: "workspace", type: "rule", category: "copy", key: "copy.cta", content: "Our content CTA is learn more" });
    expect((await retrieveAgentMemory({ workspaceId: a, userId: teammate }, "Write content")).workspace).toHaveLength(1);
    expect((await retrieveAgentMemory({ workspaceId: b, userId: user }, "Write content")).workspace).toEqual([]);
    await expect(saveAgentMemory({ workspaceId: a, userId: viewer }, { scope: "workspace", type: "fact", category: "copy", content: "No emojis" })).rejects.toThrow("permission");
    await expect(saveAgentProfile({ workspaceId: a, userId: teammate }, { operatingInstructions: "x", strategy: "", workflow: "", platforms: "" })).rejects.toThrow("permission");
    await saveAgentProfile(actor, { operatingInstructions: "Use concise copy", strategy: "Educational posts", workflow: "Review required", platforms: "Facebook" });
    expect((await retrieveAgentMemory(actor, "Create content")).profile?.strategy).toBe("Educational posts");
    expect((await retrieveAgentMemory(actor, "Hi")).profile).toBeNull();
  });
  it("enforces actual RLS if browser grants are accidentally introduced", async () => {
    // Grants and test reads share a connection and are rolled back. No production grants change.
    const rollback = new Error("ROLLBACK TEST GRANTS");
    try {
      await getDb().transaction(async tx => {
        await tx.execute(sql`GRANT SELECT ON user_agent_memories,brand_memory,workspace_agent_profiles TO authenticated`);
        await tx.execute(sql`select set_config('request.jwt.claim.sub', ${teammate}, true)`);
        await tx.execute(sql`SET LOCAL ROLE authenticated`);
        expect((await tx.select().from(userAgentMemories)).filter(row => row.workspaceId === a)).toEqual([]);
        expect((await tx.select().from(brandMemory)).filter(row => row.workspaceId === b)).toEqual([]);
        expect((await tx.select().from(brandMemory)).filter(row => row.workspaceId === a)).toHaveLength(1);
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
  });
  it("forgets all versions, without removing other scopes", async () => {
    expect((await forgetAgentMemory(actor, "user", "caption.language")).removed).toBe(2);
    expect((await listAgentMemory(actor)).personal).toEqual([]);
    expect((await listAgentMemory(actor)).workspace).toHaveLength(1);
    await expect(forgetAgentMemory({ workspaceId: b, userId: teammate }, "workspace", "copy.cta")).rejects.toThrow("permission");
  });
  it("learns through streaming tools and remembers after a fresh connection/new chat", async () => {
    const [run] = await getDb().insert(agentRuns).values({ workspaceId: a, userId: user, kind: "chat", status: "running" }).returning();
    const lazy = createLazyChatTools(buildAgentTools({ workspaceId: a, userId: user, runId: run.id, currentTask: "Remember: don't use emojis" }));
    let calls = 0;
    const model: LanguageModelV2 = { specificationVersion: "v2", provider: "test", modelId: "test", supportedUrls: {},
      doGenerate: async () => { throw Error("Not used"); }, doStream: async () => {
        const parts: LanguageModelV2StreamPart[] = calls++ === 0
          ? [{ type: "tool-call", toolName: "update_brand_memory", toolCallId: "remember", input: JSON.stringify({ scope: "user", type: "preference", category: "copy", content: "Do not use emojis" }) }, { type: "finish", finishReason: "tool-calls", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }]
          : [{ type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: "Remembered." }, { type: "text-end", id: "t" }, { type: "finish", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }];
        return { stream: new ReadableStream({ start(controller) { parts.forEach(part => controller.enqueue(part)); controller.close(); } }) };
      } };
    const result = streamText({ model, messages: [{ role: "user", content: "Remember: don't use emojis" }], tools: lazy.tools, prepareStep: lazy.prepareStep, stopWhen: stepCountIs(3) });
    expect(await result.text).toBe("Remembered.");
    expect((await result.steps)[0].toolResults[0].output).toMatchObject({ saved: true, scope: "user" });
    resetDbPool();
    const fresh = await retrieveAgentMemory({ userId: user, workspaceId: a }, "Create a caption");
    expect(fresh.personal).toEqual([{ key: "copy.emojis", content: "Do not use emojis" }]);
    expect((await retrieveAgentMemory({ userId: user, workspaceId: a }, "Create a caption", false)).personal).toEqual([]);
    await getDb().delete(agentRuns).where(eq(agentRuns.id, run.id));
  });
  it("edits metadata and changes a memory subject atomically without leaking across users", async () => {
    const first = await saveAgentMemory(actor, { scope: "user", type: "preference", category: "copy", content: "Generate captions in English" }, "manual");
    await expect(saveAgentMemory({ workspaceId: a, userId: teammate }, { scope: "user", type: "preference", category: "copy", content: "Generate captions in Urdu" }, "manual", first.id)).rejects.toThrow("scope");
    const changed = await saveAgentMemory(actor, { scope: "user", type: "preference", category: "general", content: "Generate captions in English" }, "manual", first.id);
    expect((await listAgentMemory(actor)).personal.find(row => row.id === changed.id)?.category).toBe("general");
    const renamed = await saveAgentMemory(actor, { scope: "user", type: "preference", category: "copy", content: "Use a professional tone" }, "manual", changed.id);
    const active = (await listAgentMemory(actor)).personal;
    expect(active.some(row => row.memoryKey === "caption.language")).toBe(false);
    expect(active.some(row => row.id === renamed.id)).toBe(true);
    await forgetAgentMemory(actor, "user", "caption.language");
    await forgetAgentMemory(actor, "user", "copy.tone");
  });
  it("serializes overlapping shared-memory writes and supersedes a changed value", async () => {
    const input = { scope: "workspace" as const, type: "rule" as const, category: "workflow" as const, key: "workflow.approval", content: "The content workflow requires review" };
    const results = await Promise.all([saveAgentMemory(actor, input), saveAgentMemory({ workspaceId: a, userId: teammate }, input), saveAgentMemory(actor, input)]);
    expect(new Set(results.map(result => result.id)).size).toBe(1);
    await saveAgentMemory(actor, { ...input, content: "The content workflow requires owner review" });
    const active = (await listAgentMemory(actor)).workspace.filter(row => row.memoryKey === input.key);
    expect(active).toHaveLength(1); expect(active[0].content).toContain("owner");
    expect((await retrieveAgentMemory(actor, "Schedule approved posts")).workspace.some(row => row.key === input.key)).toBe(true);
    expect((await forgetAgentMemory(actor, "workspace", input.key)).removed).toBe(2);
  });
  it("rejects forged private writes, viewer workspace writes and identity mutation", async () => {
    const unexpectedlyAllowed = new Error("Unexpectedly allowed RLS write");
    const rejectsWrite = async (attempt: () => Promise<unknown>) => {
      try { await attempt(); throw new Error("Test transaction must roll back"); }
      catch (error) {
        if (error === unexpectedlyAllowed) throw error;
        expect((error as { cause?: { code?: string }; code?: string }).cause?.code ?? (error as { code?: string }).code).toBe("42501");
      }
    };
    await rejectsWrite(() => getDb().transaction(async tx => {
      await tx.execute(sql`GRANT INSERT ON user_agent_memories TO authenticated`);
      await tx.execute(sql`select set_config('request.jwt.claim.sub', ${teammate}, true)`);
      await tx.execute(sql`SET LOCAL ROLE authenticated`);
      await tx.insert(userAgentMemories).values({ workspaceId: a, userId: user, memoryKey: "forged.memory", type: "fact", content: "Forged preference", source: "test" });
      throw unexpectedlyAllowed;
    }));
    await rejectsWrite(() => getDb().transaction(async tx => {
      await tx.execute(sql`GRANT INSERT ON brand_memory TO authenticated`);
      await tx.execute(sql`select set_config('request.jwt.claim.sub', ${viewer}, true)`);
      await tx.execute(sql`SET LOCAL ROLE authenticated`);
      await tx.insert(brandMemory).values({ workspaceId: a, createdBy: viewer, type: "fact", content: "Forged workspace memory" });
      throw unexpectedlyAllowed;
    }));
    await expect(getDb().update(agentIdentities).set({ instructions: "Rewritten" }).where(eq(agentIdentities.version, 1))).rejects.toThrow();
    await expect(getDb().update(agentIdentities).set({ instructions: "Rewritten" }).where(eq(agentIdentities.version, CORE_IDENTITY_VERSION))).rejects.toThrow();
  });
  it.skipIf(process.env.RUN_LIVE_MEMORY_PROVIDER !== "true")("learns, updates and forgets natural commands with the configured provider", async () => {
    const [configRow] = await getDb().select({ workspaceId: workspaceAiConfig.workspaceId }).from(workspaceAiConfig).limit(1);
    if (!configRow) throw new Error("A configured AI provider is required for this opt-in test.");
    const resolved = await getWorkspaceTextModel(configRow.workspaceId, "chat");
    for (const request of ["Remember: always generate my captions in English. This is my private preference, not a shared workspace rule.", "From now on my captions must be in Urdu. Update my private caption language preference.", "Forget my private caption language preference."]) {
      const [run] = await getDb().insert(agentRuns).values({ workspaceId: a, userId: user, kind: "chat", status: "running" }).returning();
      try {
        const memories = await retrieveAgentMemory(actor, request);
        const lazy = createLazyChatTools(buildAgentTools({ ...actor, runId: run.id, currentTask: request }));
        const model = createBudgetedChatModel({ model: resolved.model, scope: resolved.provider + "/" + resolved.modelId, budget: resolveChatBudget(resolved.provider, resolved.modelId), save: async () => {} });
        const result = streamText({ model, system: buildSystemPrompt({ workspaceName: "Temporary memory test", brandSummary: "", memories: [], lazyContext: true, identity: memories.identity, persistentContext: boundedAgentReference(memories, 1200) }),
          messages: [{ role: "user", content: request }], tools: lazy.tools, prepareStep: lazy.prepareStep, stopWhen: stepCountIs(5), abortSignal: AbortSignal.timeout(60000) });
        expect((await result.text).trim().length).toBeGreaterThan(0);
        const steps = await result.steps;
        expect(steps.flatMap(step => step.toolResults).some(tool => tool.toolName === (request.startsWith("Forget") ? "forget_agent_memory" : "update_brand_memory") && (tool.output as { saved?: boolean; ok?: boolean }).saved !== false && (tool.output as { ok?: boolean }).ok !== false)).toBe(true);
        const active = (await listAgentMemory(actor)).personal.filter(row => row.memoryKey === "caption.language");
        if (request.startsWith("Forget")) expect(active).toEqual([]);
        else { expect(active).toHaveLength(1); expect(active[0].content.toLowerCase()).toContain(request.startsWith("Remember") ? "english" : "urdu"); }
        console.info("[memory:provider]", { provider: resolved.provider, model: resolved.modelId, steps: steps.length, command: request.startsWith("Forget") ? "forget" : request.startsWith("Remember") ? "remember" : "update" });
      } finally { await getDb().delete(agentRuns).where(eq(agentRuns.id, run.id)); }
    }
  }, 180000);
});
