import { beforeEach, describe, expect, it, vi } from "vitest";
import { brandAssets, brands, mediaCleanupQueue, workspaces } from "@/db/schema";

type Asset = { id: string; workspaceId: string; kind: string; storagePath: string;
  cleanupStatus: string; refCount: number; sizeBytes: number };
const state = vi.hoisted(() => ({ workspaceId: "workspace-a", userId: "user-a",
  assets: [] as Asset[], brandRows: [] as Array<Record<string, unknown>>,
  queue: [] as Array<Record<string, unknown>>, stored: new Set<string>(),
  failUpload: false, failCommit: false, removeCalls: 0, cleanupCalls: 0 }));

function tableName(table: unknown) {
  return (table as Record<symbol, string>)[Symbol.for("drizzle:Name")];
}

function makeHandle(assets: Asset[], queue: Array<Record<string, unknown>>, brandRows: Array<Record<string, unknown>>) {
  return {
    select: () => ({ from: (table: unknown) => ({ where: () => {
      const name = tableName(table);
      const rows = name === tableName(workspaces) ? [{ id: state.workspaceId }]
        : name === tableName(brandAssets) ? assets.filter(a => a.workspaceId === state.workspaceId && a.cleanupStatus === "permanent" && a.refCount > 0)
          : name === tableName(brands) ? brandRows.filter(b => b.workspaceId === state.workspaceId) : [];
      const result = Promise.resolve(rows);
      return Object.assign(result, { for: () => result });
    } }) }),
    insert: (table: unknown) => ({ values: async (value: Record<string, unknown>) => {
      if (tableName(table) === tableName(brandAssets)) assets.push({
        id: `asset-${assets.length + 1}`, workspaceId: String(value.workspaceId), kind: String(value.kind),
        storagePath: String(value.storagePath), cleanupStatus: "permanent", refCount: 1,
        sizeBytes: Number(value.sizeBytes),
      });
      else if (tableName(table) === tableName(mediaCleanupQueue)) {
        if (state.failCommit) throw new Error("queue insert failed");
        queue.push(value);
      } else if (tableName(table) === tableName(brands)) brandRows.push(value);
    } }),
    update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: async (condition: unknown) => {
      if (tableName(table) === tableName(brands)) {
        const row = brandRows.find(b => b.workspaceId === state.workspaceId);
        if (row) Object.assign(row, values);
        return;
      }
      const params: unknown[] = [];
      const visit = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        const value = node as { constructor?: { name?: string }; value?: unknown; queryChunks?: unknown[] };
        if (value.constructor?.name === "Param") params.push(value.value);
        value.queryChunks?.forEach(visit);
      };
      visit(condition);
      const old = assets.find(a => params.includes(a.id) && a.workspaceId === state.workspaceId);
      if (old) Object.assign(old, values);
    } }) }),
  };
}

vi.mock("@/db", () => ({ getDb: () => ({
  ...makeHandle(state.assets, state.queue, state.brandRows),
  transaction: async (fn: (tx: ReturnType<typeof makeHandle>) => Promise<unknown>) => {
    const assets = state.assets.map(a => ({ ...a }));
    const queue = state.queue.map(q => ({ ...q }));
    const brandsCopy = state.brandRows.map(b => ({ ...b }));
    const result = await fn(makeHandle(assets, queue, brandsCopy));
    state.assets = assets;
    state.queue = queue;
    state.brandRows = brandsCopy;
    return result;
  },
}) }));
vi.mock("@/lib/workspace", () => ({ getActiveContext: async () => ({ workspaceId: state.workspaceId, userId: state.userId }) }));
vi.mock("@/server/actions/workspace", () => ({ requireRoleForActiveWorkspace: async () => ({ workspaceId: state.workspaceId }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ storage: { from: () => ({
  upload: async (path: string) => {
    if (state.failUpload) return { error: { message: "storage rejected" } };
    state.stored.add(path); return { error: null };
  },
  remove: async (paths: string[]) => { state.removeCalls++; paths.forEach(path => state.stored.delete(path)); return { error: null }; },
}) } }) }));
vi.mock("@/lib/media/lifecycle", () => ({ DEFAULT_SOFT_DELETE_GRACE_HOURS: 24,
  markBrandAssetForCleanup: async (args: { brandAssetId: string; explicitLogoRemoval?: boolean }) => {
    state.cleanupCalls++;
    const row = state.assets.find(a => a.id === args.brandAssetId && a.workspaceId === state.workspaceId);
    if (!row || (row.kind === "logo" && !args.explicitLogoRemoval)) return null;
    row.cleanupStatus = "soft_deleted"; row.refCount = 0;
    return { storagePath: row.storagePath, bytes: row.sizeBytes };
  },
  markVisualAssetForCleanup: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deleteBrandAssetAction, uploadBrandAssetAction } from "@/server/actions/visuals";
import { updateBusinessInfoAction, updateVisualIdentityAction } from "@/server/actions/brand";

const file = () => new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" });
const upload = () => { const data = new FormData(); data.set("kind", "logo"); data.set("file", file()); return uploadBrandAssetAction(data); };
const active = (workspace = state.workspaceId) => state.assets.filter(a => a.workspaceId === workspace &&
  a.kind === "logo" && a.cleanupStatus === "permanent" && a.refCount > 0);

beforeEach(() => {
  state.workspaceId = "workspace-a"; state.assets = []; state.brandRows = [{ workspaceId: "workspace-a" }, { workspaceId: "workspace-b" }];
  state.queue = []; state.stored = new Set(); state.failUpload = false; state.failCommit = false;
  state.removeCalls = 0; state.cleanupCalls = 0;
});

describe("canonical Brand Brain logo", () => {
  it("persists an upload across Brand Brain text saves and simulated reloads", async () => {
    expect(await upload()).toEqual({ ok: true });
    const id = active()[0].id;
    const data = new FormData(); data.set("primaryColor", "#123456"); data.set("notes", "Updated text");
    expect(await updateVisualIdentityAction(data)).toEqual({ ok: true });
    const business = new FormData(); business.set("businessName", "Updated brand");
    expect(await updateBusinessInfoAction(business)).toEqual({ ok: true });
    const invalid = new FormData(); invalid.set("notes", "x".repeat(2001));
    expect(await updateVisualIdentityAction(invalid)).toMatchObject({ ok: false });
    expect(active()[0].id).toBe(id);
    expect(state.stored.has(active()[0].storagePath)).toBe(true);
    expect(state.queue).toHaveLength(0);
  });

  it("uploads a replacement before retiring the original, scoped to one workspace", async () => {
    expect(await upload()).toEqual({ ok: true });
    const first = active()[0];
    state.workspaceId = "workspace-b";
    expect(await upload()).toEqual({ ok: true });
    const other = active()[0];
    state.workspaceId = "workspace-a";
    expect(await upload()).toEqual({ ok: true });
    expect(active()).toHaveLength(1);
    expect(active()[0].id).not.toBe(first.id);
    expect(active("workspace-b")[0].id).toBe(other.id);
    expect(state.stored.has(active()[0].storagePath)).toBe(true);
    expect(state.stored.has(first.storagePath)).toBe(true); // old object waits for safe cleanup
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].sourceRowId).toBe(first.id);
  });

  it("preserves the old logo when Storage upload or DB replacement fails", async () => {
    expect(await upload()).toEqual({ ok: true });
    const original = active()[0];
    state.failUpload = true;
    expect(await upload()).toMatchObject({ ok: false });
    expect(active()[0].id).toBe(original.id);
    const empty = new FormData(); empty.set("kind", "logo");
    expect(await uploadBrandAssetAction(empty)).toMatchObject({ ok: false });
    state.failUpload = false; state.failCommit = true;
    expect(await upload()).toMatchObject({ ok: false });
    expect(active()[0].id).toBe(original.id);
    expect(state.stored.has(original.storagePath)).toBe(true);
    expect(state.queue).toHaveLength(0);
    expect(state.removeCalls).toBe(1);
  });

  it("requires an explicit Remove Logo action before cleanup", async () => {
    expect(await upload()).toEqual({ ok: true });
    const id = active()[0].id;
    expect(await deleteBrandAssetAction(id)).toMatchObject({ ok: false });
    expect(state.cleanupCalls).toBe(0);
    expect(active()[0].id).toBe(id);
    expect(await deleteBrandAssetAction(id, { removeLogo: true })).toEqual({ ok: true });
    expect(active()).toHaveLength(0);
  });
});
