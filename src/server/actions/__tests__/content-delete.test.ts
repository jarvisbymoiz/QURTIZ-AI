import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ context: vi.fn(), transaction: vi.fn(), remove: vi.fn(), eligibility: vi.fn(), done: vi.fn(), retry: vi.fn() }));
vi.mock("@/db", () => ({ getDb: () => ({ transaction: mock.transaction }) }));
vi.mock("@/lib/workspace", () => ({ getActiveContext: mock.context }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ storage: { from: () => ({ remove: mock.remove }) } }) }));
vi.mock("@/lib/media/lifecycle", () => ({ evaluateCleanupEligibility: mock.eligibility, markCleanupDone: mock.done, recordCleanupAttempt: mock.retry }));
vi.mock("@/lib/ai/content", () => ({ generateAndPersistContent: vi.fn() }));
vi.mock("@/lib/content/edit", () => ({ editContent: vi.fn() }));
vi.mock("@/lib/content/lifecycle", () => ({ approveItem: vi.fn(), rejectItem: vi.fn(), archiveItem: vi.fn(), getItem: vi.fn(), transitionItem: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: vi.fn() }));
import { deleteContentAction } from "../content";
const id = "00000000-0000-4000-8000-000000000001";
let selects: unknown[][];
let events: string[];
let queueFails = false;
const asset = { id, storagePath: "workspace/file.png", meta: { sizeBytes: 20 } };
beforeEach(() => {
  vi.clearAllMocks(); events = []; queueFails = false;
  selects = [[{ id, status: "draft" }], [], [], [asset]];
  mock.context.mockResolvedValue({ workspaceId: "workspace", userId: id });
  mock.eligibility.mockResolvedValue("delete"); mock.remove.mockResolvedValue({ error: null });
  mock.transaction.mockImplementation(async callback => callback({
    select: () => { const rows = selects.shift(); return { from: () => ({ where: () => ({ for: async () => rows, then: (resolve: (value: unknown) => void) => Promise.resolve(rows).then(resolve) }) }) }; },
    insert: () => ({ values: () => ({ returning: async () => { events.push("queue"); if (queueFails) throw Error("Queue unavailable"); return [{ id, storagePath: asset.storagePath, sourceRowId: id, bytes: 20 }]; } }) }),
    delete: () => ({ where: async () => { events.push("delete"); } }),
  }));
});
describe("post deletion and durable file cleanup", () => {
  it("rejects unauthorized deletion before database access", async () => {
    mock.context.mockResolvedValue({ error: "Forbidden" });
    expect(await deleteContentAction(id)).toEqual({ ok: false, error: "Forbidden" });
    expect(mock.transaction).not.toHaveBeenCalled();
  });
  it("persists cleanup before deletion and removes the real storage path", async () => {
    expect(await deleteContentAction(id)).toEqual({ ok: true });
    expect(events).toEqual(["queue", "delete"]);
    expect(mock.remove).toHaveBeenCalledWith(["workspace/file.png"]);
    expect(mock.done).toHaveBeenCalledWith({ queueId: id, cleanedBytes: 20 });
  });
  it("does not delete records if durable cleanup cannot be persisted", async () => {
    queueFails = true;
    expect(await deleteContentAction(id)).toEqual({ ok: false, error: "Queue unavailable" });
    expect(events).toEqual(["queue"]); expect(mock.remove).not.toHaveBeenCalled();
  });
  it("reports pending cleanup instead of claiming file deletion on storage failure", async () => {
    mock.remove.mockResolvedValue({ error: { message: "Storage unavailable" } });
    const result = await deleteContentAction(id);
    expect(result.ok).toBe(true); expect(result).toHaveProperty("warning");
    expect(mock.retry).toHaveBeenCalled(); expect(mock.done).not.toHaveBeenCalled();
  });
  it("preserves shared media", async () => {
    mock.eligibility.mockResolvedValue("rowonly");
    expect(await deleteContentAction(id)).toEqual({ ok: true });
    expect(mock.remove).not.toHaveBeenCalled(); expect(mock.done).toHaveBeenCalledWith({ queueId: id, cleanedBytes: 0 });
  });
  it.each(["published", "scheduled", "generating"])("protects %s posts", async status => {
    selects[0] = [{ id, status }];
    expect((await deleteContentAction(id)).ok).toBe(false); expect(events).toEqual([]);
  });
  it("rejects media outside the current workspace", async () => {
    selects[3] = [{ ...asset, storagePath: "other/file.png" }];
    expect((await deleteContentAction(id)).ok).toBe(false); expect(events).toEqual([]);
  });
  it("protects a published platform variant even when the parent status is stale", async () => {
    selects[2] = [{ status: "published" }];
    expect((await deleteContentAction(id)).ok).toBe(false);
    expect(events).toEqual([]);
  });
});
