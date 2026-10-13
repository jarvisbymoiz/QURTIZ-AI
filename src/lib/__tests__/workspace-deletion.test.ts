import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { SQL } from "drizzle-orm";
import { jobs } from "@/db/schema";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const state = vi.hoisted(() => ({ job: null as Record<string, unknown> | null, workspaces: [] as Record<string, unknown>[], deletes: [] as string[], failStorage: false, keys: new Set<string>() }));
const dialect = new PgDialect();
function queryParams(where: SQL) { return dialect.sqlToQuery(where).params; }
function makeDb() {
  return {
    select: () => ({ from: (table: unknown) => ({ where: (where: SQL) => {
      const params = queryParams(where);
      const requiresTombstone = dialect.sqlToQuery(where).sql.includes('"deleted_at" is not null');
      const rows = table === jobs ? (state.job ? [state.job] : []) : state.workspaces.filter(row => params.includes(row.id) && (!requiresTombstone || row.deletedAt));
      return Object.assign(Promise.resolve(rows), { orderBy: () => ({ limit: async () => rows }), for: async () => rows });
    } }) }),
    update: () => ({ set: (values: Record<string, unknown>) => ({ where: async () => { if (state.job) Object.assign(state.job, values); } }) }),
    delete: () => ({ where: (where: SQL) => ({ returning: async () => {
      const params = queryParams(where);
      const rows = state.workspaces.filter(row => params.includes(row.id) && row.deletedAt);
      state.deletes.push(...rows.map(row => String(row.id)));
      state.workspaces = state.workspaces.filter(row => !rows.includes(row));
      if (rows.length) state.job = null;
      return rows;
    } }) }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => fn(makeDb()),
  };
}
vi.mock("@/db", () => ({ getDb: () => makeDb() }));
function bucket() {
  return {
    list: async (prefix: string) => {
      if (state.failStorage) return { data: null, error: { message: "unavailable" } };
      const entries = new Map<string, { name: string; id: string | null; metadata: object | null }>();
      for (const key of state.keys) {
        if (!key.startsWith(prefix + "/")) continue;
        const rest = key.slice(prefix.length + 1); const name = rest.split("/")[0];
        entries.set(name, { name, id: rest.includes("/") ? null : key, metadata: rest.includes("/") ? null : { size: 1 } });
      }
      return { data: [...entries.values()].slice(0, 100), error: null };
    },
    remove: async (paths: string[]) => { paths.forEach(path => state.keys.delete(path)); return { error: null }; },
  };
}
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ storage: { from: () => bucket() } }) }));
import { purgeWorkspaceStorageBatch, workspaceDeletionTick, WORKSPACE_UPLOAD_DRAIN_MS } from "@/lib/workspace-deletion";
beforeEach(() => { state.keys = new Set(); state.job = null; state.workspaces = []; state.deletes = []; state.failStorage = false; });
describe("storage namespace isolation and bounded cleanup", () => {
  it("removes nested and orphaned files in only the selected workspace", async () => {
    state.keys = new Set([`${A}/logo/file.png`, `${A}/visuals/post/raw`, `${A}/reference/old.png`, `${B}/logo/keep.png`]);
    expect(await purgeWorkspaceStorageBatch(bucket() as never, A)).toEqual({ removed: 3, empty: true });
    expect([...state.keys]).toEqual([`${B}/logo/keep.png`]);
  });
  it("continues across ticks without dropping files beyond a batch", async () => {
    state.keys = new Set(Array.from({ length: 150 }, (_, i) => `${A}/file-${i}`));
    expect(await purgeWorkspaceStorageBatch(bucket() as never, A)).toEqual({ removed: 100, empty: false });
    expect(state.keys.size).toBe(50);
    expect(await purgeWorkspaceStorageBatch(bucket() as never, A)).toEqual({ removed: 50, empty: true });
  });
  it("rejects a traversal workspace selector before storage access", async () => {
    await expect(purgeWorkspaceStorageBatch(bucket() as never, `${A}/../${B}`)).rejects.toThrow("invalid_workspace_scope");
  });
});
function queue(age: number) {
  state.workspaces = [{ id: A, deletedAt: new Date(Date.now() - age) }, { id: B, deletedAt: null }];
  state.job = { id: "job", workspaceId: A, userId: "owner", type: "workspace_delete", status: "queued", result: {}, updatedAt: new Date(0) };
}
describe("durable background deletion", () => {
  it("cascades only the selected tombstone after uploads drain", async () => {
    queue(WORKSPACE_UPLOAD_DRAIN_MS + 1000);
    state.keys = new Set([`${A}/logo/file.png`, `${B}/logo/keep.png`]);
    expect((await workspaceDeletionTick()).completed).toBe(1);
    expect(state.deletes).toEqual([A]); expect(state.workspaces.map(row => row.id)).toEqual([B]); expect(state.keys.has(`${B}/logo/keep.png`)).toBe(true);
  });
  it("retains the durable job to catch late signed uploads", async () => {
    queue(1000);
    expect((await workspaceDeletionTick()).pending).toBe(1);
    expect(state.deletes).toEqual([]); expect(state.job?.status).toBe("queued");
    state.keys.add(`${A}/visuals/late-upload`);
    state.workspaces[0].deletedAt = new Date(Date.now() - WORKSPACE_UPLOAD_DRAIN_MS - 1000);
    state.job!.result = {};
    expect((await workspaceDeletionTick()).completed).toBe(1); expect(state.keys.size).toBe(0);
  });
  it("retries storage failure without deleting database records", async () => {
    queue(WORKSPACE_UPLOAD_DRAIN_MS + 1000); state.failStorage = true;
    expect((await workspaceDeletionTick()).failed).toBe(1);
    expect(state.deletes).toEqual([]); expect(state.job?.status).toBe("queued"); expect(state.job?.result).toMatchObject({ failures: 1, reason: "storage_list_failed" });
  });
  it("never purges an active workspace even if a job incorrectly targets it", async () => {
    queue(WORKSPACE_UPLOAD_DRAIN_MS + 1000); state.workspaces[0].deletedAt = null;
    expect((await workspaceDeletionTick()).completed).toBe(0); expect(state.deletes).toEqual([]); expect(state.job?.status).toBe("failed");
  });
});
