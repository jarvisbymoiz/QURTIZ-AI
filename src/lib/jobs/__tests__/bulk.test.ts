import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobs } from "@/db/schema";
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/ai/content", () => ({ generateAndPersistContent: vi.fn(), AI_GENERATION_TIMEOUT_MS: 120000 }));
vi.mock("@/lib/content/intelligence", () => ({ prepareContentIntelligence: vi.fn() }));
vi.mock("@/lib/visuals/template", () => ({ renderTemplateVisual: vi.fn() }));
vi.mock("@/lib/ai/config", () => ({ getWorkspaceTextModel: vi.fn() }));
import { getDb } from "@/db";
import { generateAndPersistContent } from "@/lib/ai/content";
import { prepareContentIntelligence } from "@/lib/content/intelligence";
import { bulkContentId, runBulkPlan } from "../bulk";

const intelligence = { planningContext: "Measured analytics and Brand Brain", researchContext: "Actual web/trend snippets with sources", evidence: {
  checkedAt: new Date().toISOString(), sources: [{ url: "https://example.test", title: "Evidence", strategy: "web" }], warnings: [] } };

function setup() {
  const job = { id: "bulk1", workspaceId: "ws1", userId: "user1", status: "queued", type: "bulk_plan", input: { count: 2 }, progress: 0,
    result: { checkpoint: { plan: [{ topic: "Useful Canva tutorial", pillar: "education", angle: "Specific audience", format: "text_post" },
      { topic: "Design workflow improvements", pillar: "education", angle: "Original", format: "text_post" }], intelligence, runId: "run1", nextIndex: 0 } } };
  const notifications: unknown[] = [];
  const db = {
    select: () => ({ from: () => ({ where: async () => [structuredClone(job)] }) }),
    update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: () => {
      const claim = table === jobs && values.status === "running";
      const claimed = claim && job.status === "queued";
      if (table === jobs && job.status !== "cancelled" && (!claim || claimed)) Object.assign(job, structuredClone(values));
      return Object.assign(Promise.resolve([]), { returning: async () => claimed ? [structuredClone(job)] : [] });
    } }) }),
    insert: () => ({ values: async (values: unknown) => { notifications.push(values); } }),
  };
  vi.mocked(getDb).mockReturnValue(db as never);
  vi.mocked(generateAndPersistContent).mockImplementation(async args => ({ itemId: args.contentItemId!, qa: { passed: true, score: 95, issues: [] } as never }));
  return { job, notifications };
}
beforeEach(() => vi.clearAllMocks());
describe("durable Studio bulk slices", () => {
  it("resumes a saved plan with the same research, checkpoints each post, and never repeats completed posts", async () => {
    const { job, notifications } = setup();
    await runBulkPlan(job.id, { onePost: true });
    expect(job.status).toBe("queued"); expect(job.progress).toBe(1);
    expect(job.result.checkpoint.nextIndex).toBe(1);
    expect(generateAndPersistContent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ workspaceId: "ws1", userId: "user1",
      contentItemId: bulkContentId(job.id, 0, 0), input: expect.objectContaining({ researchContext: intelligence.researchContext, planningContext: intelligence.planningContext, researchEvidence: intelligence.evidence }) }));
    expect(notifications).toHaveLength(0);
    await runBulkPlan(job.id, { onePost: true });
    expect(job.status).toBe("completed"); expect(job.progress).toBe(2);
    expect(generateAndPersistContent).toHaveBeenCalledTimes(2);
    expect(prepareContentIntelligence).not.toHaveBeenCalled(); // cached research reused, no new quota/cost
    expect(notifications).toHaveLength(1);
    await runBulkPlan(job.id, { onePost: true });
    expect(generateAndPersistContent).toHaveBeenCalledTimes(2);
  });
  it("does not execute a cancelled job", async () => {
    const { job } = setup(); job.status = "cancelled";
    await runBulkPlan(job.id, { onePost: true });
    expect(generateAndPersistContent).not.toHaveBeenCalled();
  });
  it("preserves cancellation during generation and sends no completion notification", async () => {
    const { job, notifications } = setup();
    vi.mocked(generateAndPersistContent).mockImplementationOnce(async args => {
      job.status = "cancelled";
      return { itemId: args.contentItemId!, qa: { passed: true, score: 95, issues: [] } as never };
    });
    await runBulkPlan(job.id, { onePost: true });
    expect(job.status).toBe("cancelled");
    expect(notifications).toHaveLength(0);
  });
  it("uses distinct stable IDs for retries and different workspaces' job identities", () => {
    expect(bulkContentId("a", 0, 0)).toBe(bulkContentId("a", 0, 0));
    expect(new Set([bulkContentId("a", 0, 0), bulkContentId("a", 0, 1), bulkContentId("a", 1, 0), bulkContentId("b", 0, 0)]).size).toBe(4);
  });
});
