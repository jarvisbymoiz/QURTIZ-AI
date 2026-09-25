import { describe, expect, it, vi } from "vitest";
import { agentRuns } from "@/db/schema";
import { CORE_AGENT_IDENTITY, CORE_IDENTITY_VERSION } from "../identity";
import { buildSystemPrompt } from "../agent";
import { buildAgentTools } from "../tools";
import { generateAndPersistContent } from "../content";
import { RateLimitExceededError } from "../provider";
import { ContentQuotaExceededError } from "@/lib/content/entitlement";
import { readFileSync } from "node:fs";

vi.mock("@/lib/ai/content", async importOriginal => ({ ...await importOriginal<typeof import("../content")>(), generateAndPersistContent: vi.fn() }));
vi.mock("@/lib/ai/config", () => ({ getWorkspaceTextModel: async () => ({ provider: "custom", modelId: "example/model" }) }));
vi.mock("@/lib/workspace", () => ({ getMembership: async () => ({ role: "editor" }) }));
vi.mock("@/db", () => ({ getDb: () => ({
  select: () => ({ from: (table: unknown) => ({ where: async () => table === agentRuns ? [{ status: "running" }] : [] }) }),
  insert: () => ({ values: async () => ({}) }),
}) }));

describe("proactive protected identity", () => {
  it("publishes the same immutable release in code and SQL without replacing earlier identity", () => {
    expect(CORE_IDENTITY_VERSION).toBe(4);
    const sql = readFileSync("src/db/migrations/0024_agent_editing_identity.sql", "utf8").replace(/\r\n/g, "\n");
    expect(sql).toContain("$qurtiz$" + CORE_AGENT_IDENTITY + "$qurtiz$");
    expect(sql).not.toMatch(/UPDATE|DELETE|DROP/);
    const prompt = buildSystemPrompt({ workspaceName: "A", brandSummary: "", memories: [], lazyContext: true });
    expect(prompt.split(CORE_AGENT_IDENTITY)).toHaveLength(2);
    expect(prompt).not.toContain("plan, discuss, and prepare");
    expect(prompt).toContain("Ask only when an essential fact");
    expect(prompt).toContain("never silently approve");
    expect(prompt).toContain("use edit_content on the existing post");
  });
  it("loads detailed visual guidance only for relevant tasks; creation engine retains it", () => {
    const base = { workspaceName: "A", brandSummary: "", memories: [] };
    const greeting = buildSystemPrompt({ ...base, currentTask: "Hi" });
    const visual = buildSystemPrompt({ ...base, currentTask: "Write a visual prompt" });
    expect(visual).toContain("Layout and exact text placement");
    expect(greeting).not.toContain("Layout and exact text placement");
    expect(visual.length).toBeGreaterThan(greeting.length);
  });
  it.each(["carousel", "reel", "single_image"] as const)("routes requested %s and refinement tone through the existing creation service", async preferredFormat => {
    vi.mocked(generateAndPersistContent).mockResolvedValue({ itemId: "saved-real-item", qa: { score: 95, passed: true, issues: [] } } as Awaited<ReturnType<typeof generateAndPersistContent>>);
    const tools = buildAgentTools({ workspaceId: "a", userId: "u", runId: "r" });
    const result = await tools.create_content.execute!({ topic: "Canva Pro offer", platforms: ["facebook"], preferredFormat, toneOverride: "More professional; use usual style" }, { toolCallId: "c", messages: [] });
    expect(generateAndPersistContent).toHaveBeenLastCalledWith(expect.objectContaining({ workspaceId: "a", userId: "u", input: expect.objectContaining({ preferredFormat, toneOverride: "More professional; use usual style" }) }));
    expect(result).toMatchObject({ created: true, itemId: "saved-real-item" });
  });
  it("never reports successful creation when the content pipeline fails", async () => {
    vi.mocked(generateAndPersistContent).mockRejectedValueOnce(new Error("Generation unavailable"));
    const tools = buildAgentTools({ workspaceId: "a", userId: "u", runId: "r" });
    const result = await tools.create_content.execute!({ topic: "Offer", platforms: ["facebook"] }, { toolCallId: "failure", messages: [] });
    expect(result).toMatchObject({ created: false });
  });
  it("identifies a provider token quota without calling it a workspace content limit", async () => {
    vi.mocked(generateAndPersistContent).mockRejectedValueOnce(new RateLimitExceededError({
      kind: "tpd", limit: 200000, used: 199147, requested: 2075, retryAfterSeconds: 527,
    }, new Error("provider rejected request")));
    const tools = buildAgentTools({ workspaceId: "a", userId: "u", runId: "r" });
    const result = await tools.create_content.execute!({ topic: "Offer", platforms: ["facebook"] }, { toolCallId: "quota", messages: [] });
    expect(result).toMatchObject({
      created: false, errorCode: "AI_PROVIDER_RATE_LIMIT",
      quota: { source: "ai_provider", provider: "custom", model: "example/model", type: "tpd", limit: 200000, used: 199147, remaining: 853 },
    });
    expect(result.error).not.toMatch(/workspace.content.creation quota/i);
  });
  it("returns structured workspace allowance details only for a real configured limit", async () => {
    vi.mocked(generateAndPersistContent).mockRejectedValueOnce(new ContentQuotaExceededError({
      type: "content_creation", limit: 2, used: 2, remaining: 0, resetAt: "2026-10-01T00:00:00.000Z",
      period: "month", source: "workspace_settings", plan: "free",
    }));
    const tools = buildAgentTools({ workspaceId: "a", userId: "u", runId: "r" });
    const result = await tools.create_content.execute!({ topic: "Offer", platforms: ["facebook"] }, { toolCallId: "content-quota", messages: [] });
    expect(result).toMatchObject({
      created: false, errorCode: "CONTENT_QUOTA_EXHAUSTED",
      quota: { source: "workspace_settings", limit: 2, used: 2, remaining: 0, resetAt: "2026-10-01T00:00:00.000Z" },
    });
  });
});
