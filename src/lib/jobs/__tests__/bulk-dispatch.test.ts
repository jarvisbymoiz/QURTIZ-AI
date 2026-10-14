import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ after: vi.fn(), send: vi.fn(), boss: vi.fn(), inserted: vi.fn(), updated: vi.fn() }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/jobs/boss", () => ({ getBoss: mocks.boss, QUEUES: { bulkGenerate: "bulk-generate" } }));
vi.mock("@/db", () => ({ getDb: () => ({
  select: () => ({ from: () => ({ where: async () => [{ timezone: "UTC" }] }) }),
  insert: () => ({ values: (values: unknown) => { mocks.inserted(values); return { returning: async () => [{ id: "job1" }] }; } }),
  update: () => ({ set: (values: unknown) => { mocks.updated(values); return { where: async () => [] }; } }),
}) }));
import { startBulkPlanCore } from "../bulk";
const args = { workspaceId: "workspace1", userId: "owner1", count: 2, niche: "accessible design" };
beforeEach(() => { vi.clearAllMocks(); mocks.boss.mockResolvedValue({ send: mocks.send }); mocks.send.mockResolvedValue("queue1"); });
afterEach(() => vi.unstubAllEnvs());

it("persists a resumable Vercel job and registers the initial request-owned wake without pg-boss", async () => {
  vi.stubEnv("VERCEL", "1");
  expect(await startBulkPlanCore(args)).toEqual({ ok: true, jobId: "job1" });
  expect(mocks.inserted).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "workspace1", userId: "owner1", status: "queued", type: "bulk_plan", input: expect.objectContaining({ count: 2, niche: "accessible design", executionVersion: 2 }) }));
  expect(mocks.after).toHaveBeenCalledExactlyOnceWith(expect.any(Function));
  expect(mocks.boss).not.toHaveBeenCalled();
});
it("keeps local pg-boss dispatch and reports a real queue rejection", async () => {
  vi.stubEnv("VERCEL", "");
  mocks.send.mockResolvedValue(null);
  expect(await startBulkPlanCore(args)).toMatchObject({ ok: false, error: expect.stringContaining("Queue did not accept") });
  expect(mocks.send).toHaveBeenCalledWith("bulk-generate", { jobId: "job1" });
  expect(mocks.after).not.toHaveBeenCalled();
  expect(mocks.updated).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
});
it("rejects an invalid quantity before creating a job", async () => {
  expect(await startBulkPlanCore({ ...args, count: 31 })).toMatchObject({ ok: false });
  expect(mocks.inserted).not.toHaveBeenCalled();
});
