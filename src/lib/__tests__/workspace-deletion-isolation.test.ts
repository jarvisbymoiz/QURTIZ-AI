import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { SQL } from "drizzle-orm";
const A = "11111111-1111-4111-8111-111111111111"; const B = "22222222-2222-4222-8222-222222222222";
const owner = "33333333-3333-4333-8333-333333333333";
type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));
const dialect = new PgDialect();
const name = (table: unknown) => (table as Record<symbol, string>)[Symbol.for("drizzle:Name")];
const property = (column: string) => column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
function matches(row: Row, condition: SQL) {
  const query = dialect.sqlToQuery(condition);
  const comparisons = [...query.sql.matchAll(/"\w+"\."(\w+)"\s*(=|<>)\s*\$(\d+)/g)];
  if (!comparisons.some(match => ["workspace_id", "id"].includes(match[1]))) throw new Error("Unscoped fixture mutation");
  for (const [, column, operator, index] of comparisons) {
    const actual = row[property(column)], expected = query.params[Number(index) - 1];
    if (operator === "=" ? actual !== expected : actual === expected) return false;
  }
  for (const [, column, parameters] of query.sql.matchAll(/"\w+"\."(\w+)" in \(([^)]+)\)/g)) {
    const values = [...parameters.matchAll(/\$(\d+)/g)].map(match => query.params[Number(match[1]) - 1]);
    if (!values.includes(row[property(column)])) return false;
  }
  return true;
}
function tx() {
  return {
    select: () => ({ from: (table: unknown) => ({ where: (condition: SQL) => {
      const rows = (state.tables[name(table)] ?? []).filter(row => matches(row, condition));
      return Object.assign(Promise.resolve(rows), { for: async () => rows });
    } }) }),
    update: (table: unknown) => ({ set: (changes: Row) => ({ where: async (condition: SQL) => {
      for (const row of state.tables[name(table)] ?? []) if (matches(row, condition)) {
        Object.assign(row, changes, changes.value instanceof SQL ? { value: { ...(row.value as Row), enabled: false } } : {});
      }
    } }) }),
    delete: (table: unknown) => ({ where: async (condition: SQL) => { state.tables[name(table)] = (state.tables[name(table)] ?? []).filter(row => !matches(row, condition)); } }),
    insert: (table: unknown) => ({ values: async (value: Row) => { (state.tables[name(table)] ??= []).push(value); } }),
  };
}
vi.mock("@/db", () => ({ getDb: () => ({ transaction: async (fn: (handle: ReturnType<typeof tx>) => Promise<unknown>) => fn(tx()) }) }));
import { queueWorkspaceDeletion } from "@/lib/workspace-deletion";
beforeEach(() => {
  state.tables = { workspaces: [A, B].map(id => ({ id, createdBy: owner, deletedAt: null })),
    workspace_members: [A, B].map(workspaceId => ({ workspaceId, userId: owner, role: "owner" })) };
  for (const table of ["content_items", "content_variants", "publishing_jobs", "jobs", "agent_runs", "companion_devices", "companion_image_jobs", "platform_connections", "workspace_ai_config", "settings"]) {
    state.tables[table] = [A, B].map(workspaceId => ({ workspaceId, id: `row-${workspaceId}`, status: table === "publishing_jobs" ? "pending" : table === "agent_runs" ? "running" : "queued", type: "bulk_plan", key: "autopilot", value: { enabled: true }, encryptedToken: "dummy-encrypted", createdBy: owner }));
  }
});
function otherWorkspaceSnapshot() { return Object.fromEntries(Object.entries(state.tables).map(([table, rows]) => [table, structuredClone(rows.filter(row => row.workspaceId === B || row.id === B))])); }
describe("selected tenant deletion transaction", () => {
  it("tombstones and freezes only the selected workspace, leaving all other tenant rows unchanged", async () => {
    const other = otherWorkspaceSnapshot();
    expect(await queueWorkspaceDeletion({ workspaceId: A, userId: owner })).toEqual({ ok: true });
    expect(otherWorkspaceSnapshot()).toEqual(other);
    expect(state.tables.workspaces[0].deletedAt).toBeInstanceOf(Date);
    expect(state.tables.workspace_members.map(row => row.workspaceId)).toEqual([B]);
    expect(state.tables.platform_connections[0].encryptedToken).toBeNull();
    expect(state.tables.publishing_jobs[0].status).toBe("cancelled");
    expect(state.tables.jobs.filter(row => row.type === "workspace_delete")).toHaveLength(1);
    expect(state.tables.jobs.at(-1)).toMatchObject({ workspaceId: A, type: "workspace_delete", input: {} });
  });
  it("refuses a non-owner even when they can select a workspace UUID", async () => {
    const before = structuredClone(state.tables);
    expect((await queueWorkspaceDeletion({ workspaceId: A, userId: "foreign" })).ok).toBe(false);
    expect(state.tables).toEqual(before);
  });
  it("does not race an in-flight publish into deletion", async () => {
    state.tables.publishing_jobs[0].status = "processing";
    const before = structuredClone(state.tables);
    expect(await queueWorkspaceDeletion({ workspaceId: A, userId: owner })).toMatchObject({ ok: false });
    expect(state.tables).toEqual(before);
  });
  it("does not let another workspace's in-flight publish block this deletion", async () => {
    state.tables.publishing_jobs[1].status = "processing";
    expect((await queueWorkspaceDeletion({ workspaceId: A, userId: owner })).ok).toBe(true);
    expect(state.tables.publishing_jobs[1].status).toBe("processing");
  });
  it("does not enqueue duplicate cleanup for repeated accepted requests", async () => {
    await queueWorkspaceDeletion({ workspaceId: A, userId: owner });
    await queueWorkspaceDeletion({ workspaceId: A, userId: owner });
    expect(state.tables.jobs.filter(row => row.type === "workspace_delete")).toHaveLength(1);
  });
});
