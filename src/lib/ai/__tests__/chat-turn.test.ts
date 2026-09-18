import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import { agentRuns, chatMessages, chatThreads } from "@/db/schema";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/ai/chat-persistence", () => ({
  textOf: (message: UIMessage) => message.parts.filter(part => part.type === "text").map(part => (part as { text: string }).text).join(""),
  assistantMessageIdForTurn: (message: UIMessage) => `${message.id}:a`,
}));
const { getDb } = await import("@/db");
const { prepareChatTurn } = await import("../chat-turn");

type Row = { id: string; role: string; message: UIMessage; createdAt: Date };
const user = (id: string, text: string): UIMessage => ({ id, role: "user", parts: [{ type: "text", text }] });
const args = { threadId: "thread-1", workspaceId: "workspace-1", userId: "user-1", createThread: false,
  model: "test-model", message: user("u2", "Continue") };

function fakeDatabase(history: Row[] = [], active = false, ownsThread = true) {
  const writes: { table: unknown; value: Record<string, unknown> }[] = [];
  const locks: unknown[] = [];
  const deletes: unknown[] = [];
  const db = {
    transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(db),
    select: () => ({ from: (table: unknown) => ({ where: () => {
      const rows = table === chatThreads ? (ownsThread ? [{ id: args.threadId }] : [])
        : table === chatMessages ? history : active ? [{ id: "old-run" }] : [];
      const result = Promise.resolve(rows) as Promise<unknown[]> & { for: () => Promise<unknown[]>; orderBy: () => Promise<unknown[]> };
      result.for = () => { locks.push(table); return result; };
      result.orderBy = () => result;
      return result;
    } }) }),
    insert: (table: unknown) => ({ values: (value: Record<string, unknown>) => {
      writes.push({ table, value });
      const result = Promise.resolve() as Promise<void> & { returning: () => Promise<unknown[]>; onConflictDoNothing: () => Promise<void> };
      result.returning = async () => [{ id: "new-run", ...value }];
      result.onConflictDoNothing = () => result;
      return result;
    } }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    delete: () => ({ where: async (condition: unknown) => { deletes.push(condition); } }),
  };
  vi.mocked(getDb).mockReturnValue(db as never);
  return { writes, locks, deletes };
}

function row(message: UIMessage, timestamp = Date.now() - 1000): Row {
  return { id: `db-${message.id}`, role: message.role, message, createdAt: new Date(timestamp) };
}

beforeEach(() => vi.clearAllMocks());

describe("prepareChatTurn", () => {
  it("saves the first user turn and recoverable run before returning provider context", async () => {
    const fake = fakeDatabase();
    const result = await prepareChatTurn({ ...args, createThread: true });
    expect(fake.locks).toEqual([chatThreads]);
    expect(fake.writes.map(write => write.table)).toEqual([chatThreads, chatMessages, agentRuns, chatMessages]);
    expect(fake.writes.at(-1)?.value.message).toMatchObject({ id: "u2:a", metadata: { runId: "new-run", runStatus: "running" } });
    expect(result.messages).toEqual([args.message]);
  });

  it("rejects a concurrent live turn before inserting a second run", async () => {
    const running: UIMessage = { id: "u1:a", role: "assistant", parts: [], metadata: { runId: "old-run", runStatus: "running" } };
    const fake = fakeDatabase([row(user("u1", "First")), row(running)], true);
    await expect(prepareChatTurn(args)).rejects.toMatchObject({ status: 409 });
    expect(fake.writes).toHaveLength(0);
  });

  it("does not start a provider run for a thread outside the authorized scope", async () => {
    const fake = fakeDatabase([], false, false);
    await expect(prepareChatTurn(args)).rejects.toMatchObject({ status: 404 });
    expect(fake.writes).toHaveLength(0);
  });

  it("retries replace the selected tail and cannot replay its stale assistant output", async () => {
    const fake = fakeDatabase([row(user("u1", "Earlier")), row(args.message),
      row({ id: "u2:a", role: "assistant", parts: [{ type: "text", text: "Stale answer" }] })]);
    const result = await prepareChatTurn({ ...args, message: user("u2", "Edited request") });
    expect(fake.deletes).toHaveLength(1);
    expect(result.messages.map(message => message.id)).toEqual(["u1", "u2"]);
    expect(result.messages.at(-1)?.parts).toEqual([{ type: "text", text: "Edited request" }]);
  });

  it("drops empty and unfinished assistant parts from the next provider request", async () => {
    const incomplete = { id: "u1:a", role: "assistant", parts: [
      { type: "text", text: "" },
      { type: "tool-get_brand", state: "input-available", toolCallId: "pending", input: {} },
    ] } as UIMessage;
    fakeDatabase([row(user("u1", "First")), row(incomplete)]);
    const result = await prepareChatTurn(args);
    expect(result.messages.map(message => message.id)).toEqual(["u1", "u2"]);
  });
  it("returns older trusted messages for budgeted compression instead of dropping a fixed tail", async () => {
    const messages = Array.from({ length: 40 }, (_, i) => row(user("old-" + i, "Requirement " + i)));
    fakeDatabase(messages);
    const result = await prepareChatTurn(args);
    expect(result.messages).toHaveLength(41);
    expect(result.messages[0].id).toBe("old-0");
  });

});
