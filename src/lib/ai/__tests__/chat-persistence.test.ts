import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentRuns, chatMessages, chatThreads } from "@/db/schema";
import { unregisterRunController } from "@/lib/ai/run-registry";
import type { UIMessage } from "ai";

/**
 * Hermetic tests for server-side chat persistence (src/lib/ai/chat-persistence.ts).
 *
 * Covers the guarantees this task ships:
 * - the stream's terminal callback UPSERTS the assistant row (parts verbatim,
 *   terminal runStatus) and never leaves a phantom "running" row;
 * - a retry collapses onto the same (thread_id, message->>'id') key instead of
 *   appending a second assistant row for the same turn;
 * - interrupted-run recovery: the boot sweep fails every running chat run,
 *   the registry-aware cron sweep fails only stale ones, and the loader
 *   resolves stale "running" metadata against agent_runs;
 * - title generation is bounded, silent on failure, and never overrides a
 *   user rename.
 *
 * The fake db applies chat_message insert/delete so the "one row per message
 * id" invariant is exercised behaviorally; every other chain is recorded.
 */

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/ai/config", () => ({ getWorkspaceTextModel: vi.fn() }));
vi.mock("ai", () => ({ generateText: vi.fn() }));

const { getDb } = await import("@/db");
const mockedGetDb = vi.mocked(getDb);
const { getWorkspaceTextModel } = await import("@/lib/ai/config");
const mockedGetModel = vi.mocked(getWorkspaceTextModel);
const { generateText } = await import("ai");
const mockedGenerateText = vi.mocked(generateText);

const {
  assistantMessageIdForTurn,
  failInterruptedChatRuns,
  filterEmptyAssistantPlaceholders,
  maybeAutoTitleThread,
  persistAssistantMessage,
  recoverStaleChatRuns,
  resolveStaleAssistantMetadata,
  resolveTerminalRunState,
} = await import("@/lib/ai/chat-persistence");

type Write = {
  kind: "insert" | "update" | "delete" | "select";
  table: unknown;
  values?: Record<string, unknown>;
  set?: Record<string, unknown>;
  where?: unknown;
};

/** Collect the bound values embedded in a drizzle SQL condition tree. */
function sqlParams(value: unknown): unknown[] {
  const out: unknown[] = [];
  const visit = (v: unknown): void => {
    if (v == null || typeof v !== "object") return;
    const obj = v as Record<string, unknown>;
    if (Array.isArray(obj)) {
      for (const el of obj) visit(el); // inArray embeds its values as an array chunk
      return;
    }
    if (Array.isArray(obj.queryChunks)) {
      for (const c of obj.queryChunks) visit(c);
      return;
    }
    // A drizzle Param carries value + encoder (Columns/tables have neither).
    if ("value" in obj && "encoder" in obj) out.push(obj.value);
  };
  visit(value);
  return out.flat();
}

/** Find one recorded write or fail the test with a clear message. */
function findWrite(writes: Write[], kind: Write["kind"], table: unknown): Write {
  const found = writes.find((w) => w.kind === kind && w.table === table);
  if (!found) throw new Error(`expected a ${kind} write`);
  return found;
}

/** Simulated chat_messages rows: keyed by (thread_id, message->>'id'). */
type SimRow = { threadId: string; uiId: string; row: Record<string, unknown> };

function makeFakeDb(overrides?: {
  chatMessageRows?: SimRow[];
  agentRunRows?: { id: string; status: string; error: string | null }[];
  threadRows?: { id: string; title: string }[];
  updateReturning?: { id: string }[];
}) {
  const writes: Write[] = [];
  const rows: SimRow[] = overrides?.chatMessageRows ?? [];
  const agentRunRows = overrides?.agentRunRows ?? [];
  const threadRows = overrides?.threadRows ?? [];
  const updateReturning = overrides?.updateReturning ?? [];

  const db = {
    transaction: (fn: (tx: unknown) => Promise<void>) => fn(tx),
    select: () => ({
      from: (table: unknown) => ({
        where: (cond: unknown) => {
          writes.push({ kind: "select", table, where: cond });
          const source =
            table === agentRuns ? agentRunRows : table === chatThreads ? threadRows : rows.map((r) => r.row);
          const thenable = Promise.resolve(source) as Promise<unknown[]> & {
            orderBy: () => Promise<unknown[]>;
          };
          thenable.orderBy = () => thenable;
          return thenable;
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        writes.push({ kind: "insert", table, values });
        if (table === chatMessages) {
          const message = values.message as unknown as { id?: string };
          rows.push({ threadId: values.threadId as string, uiId: message?.id ?? "", row: values });
        }
        return Promise.resolve();
      },
    }),
    update: (table: unknown) => ({
      set: (set: Record<string, unknown>) => ({
        where: (cond: unknown) => {
          writes.push({ kind: "update", table, set, where: cond });
          const thenable = Promise.resolve() as Promise<unknown> & {
            returning: () => Promise<{ id: string }[]>;
          };
          thenable.returning = () => Promise.resolve(updateReturning);
          return thenable;
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: (cond: unknown) => {
        writes.push({ kind: "delete", table, where: cond });
        if (table === chatMessages) {
          const params = sqlParams(cond);
          const threadId = params[0] as string;
          const uiId = params[1] as string;
          for (let i = rows.length - 1; i >= 0; i--) {
            if (rows[i].threadId === threadId && rows[i].uiId === uiId) rows.splice(i, 1);
          }
        }
        return Promise.resolve();
      },
    }),
  };

  const tx = {
    insert: db.insert,
    update: db.update,
    delete: db.delete,
    execute: async () => {
      /* unused in the current code paths */
    },
  };

  // Expose the recording buffers on the db handle for test assertions.
  const handle = db as typeof db & { writes: Write[]; rows: SimRow[] };
  handle.writes = writes;
  handle.rows = rows;

  return { db: handle, writes, rows, tx };
}

function uidMessage(partial: Partial<UIMessage> & { id: string }): UIMessage {
  return {
    role: "assistant",
    parts: [{ type: "text", text: "hi" }],
    metadata: { runId: "r1", runStatus: "running" },
    ...partial,
  } as unknown as UIMessage;
}

const THREAD = "6a4d0737-a40b-4df8-97c1-000000000001";
const WORKSPACE = "a3193a10-a40b-4df8-97c1-000000000002";
const USER = "a3193a10-a40b-4df8-97c1-000000000003";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  unregisterRunController("run-live");
  unregisterRunController("run-dead");
});

// ---------------------------------------------------------------------------
// Fix 1 — stream terminal persistence
// ---------------------------------------------------------------------------

describe("persistAssistantMessage", () => {
  it("upserts the assistant row with parts verbatim and runStatus completed", async () => {
    const parts = [
      { type: "text", text: "Done." },
      { type: "tool-create_content", state: "output-available", input: { topic: "x" }, output: { ok: true } },
    ];
    const message = uidMessage({ id: "u1:a", parts: parts as never });
    const { db } = makeFakeDb();
    mockedGetDb.mockReturnValue(db as never);

    await persistAssistantMessage({
      threadId: THREAD,
      workspaceId: WORKSPACE,
      userId: USER,
      message,
      runStatus: "completed",
      runError: null,
    });

    const inserts = db.writes.filter((w) => w.kind === "insert" && w.table === chatMessages);
    expect(inserts).toHaveLength(1);
    const row = inserts[0].values as Record<string, unknown>;
    expect(row.role).toBe("assistant");
    expect(row.content).toBe("Done.");
    expect((row.message as { parts: unknown }).parts).toEqual(parts);
    const meta = (row.message as { metadata: Record<string, unknown> }).metadata;
    expect(meta.runId).toBe("r1");
    expect(meta.runStatus).toBe("completed");
    expect(meta.runError).toBeUndefined();
    // The delete-then-insert upsert: one delete keyed on (thread_id, id).
    const deletes = db.writes.filter((w) => w.kind === "delete" && w.table === chatMessages);
    expect(deletes).toHaveLength(1);
    expect(sqlParams(deletes[0].where)).toEqual([THREAD, "u1:a"]);
    // Thread updated_at bump (loadThreadsAction sorts by it).
    const threadUpdates = db.writes.filter((w) => w.kind === "update" && w.table === chatThreads);
    expect(threadUpdates).toHaveLength(1);
    expect((threadUpdates[0].set as { updatedAt: unknown }).updatedAt).toBeInstanceOf(Date);
  });

  it("persists runStatus failed + runError when the stream errored", async () => {
    const message = uidMessage({ id: "u1:a", parts: [{ type: "text", text: "partial" }] as never });
    const { db } = makeFakeDb();
    mockedGetDb.mockReturnValue(db as never);

    await persistAssistantMessage({
      threadId: THREAD,
      workspaceId: WORKSPACE,
      userId: USER,
      message,
      runStatus: "failed",
      runError: "Provider stream error",
    });

    const row = db.writes.find((w) => w.kind === "insert" && w.table === chatMessages)?.values as Record<string, unknown>;
    const meta = (row.message as { metadata: Record<string, unknown> }).metadata;
    expect(meta.runStatus).toBe("failed");
    expect(meta.runError).toBe("Provider stream error");
  });

  it("never leaves a 'running' row: metadata is always overwritten with the terminal state", async () => {
    const message = uidMessage({ id: "u1:a" });
    const { db } = makeFakeDb();
    mockedGetDb.mockReturnValue(db as never);

    await persistAssistantMessage({
      threadId: THREAD,
      workspaceId: WORKSPACE,
      userId: USER,
      message, // metadata still says runStatus "running"
      runStatus: "failed",
      runError: "Stream interrupted before completion",
    });

    const row = db.writes.find((w) => w.kind === "insert" && w.table === chatMessages)?.values as Record<string, unknown>;
    expect((row.message as { metadata: Record<string, unknown> }).metadata.runStatus).toBe("failed");
  });

  it("drops empty assistant placeholders instead of persisting phantom rows", async () => {
    const message = uidMessage({ id: "u1:a", parts: [] as never });
    const { db } = makeFakeDb();
    mockedGetDb.mockReturnValue(db as never);

    await persistAssistantMessage({
      threadId: THREAD,
      workspaceId: WORKSPACE,
      userId: USER,
      message,
      runStatus: "failed",
      runError: "Provider stream error",
    });

    expect(db.writes.filter((w) => w.kind === "insert")).toHaveLength(0);
    expect(db.writes.filter((w) => w.kind === "update" && w.table === chatThreads)).toHaveLength(0);
  });

  it("is idempotent: re-persisting the same message id (client re-post / retry) keeps ONE row", async () => {
    const message = uidMessage({ id: "u1:a" });
    const { db } = makeFakeDb();
    mockedGetDb.mockReturnValue(db as never);

    await persistAssistantMessage({
      threadId: THREAD,
      workspaceId: WORKSPACE,
      userId: USER,
      message,
      runStatus: "failed",
      runError: "boom",
    });
    await persistAssistantMessage({
      threadId: THREAD,
      workspaceId: WORKSPACE,
      userId: USER,
      message,
      runStatus: "completed",
      runError: null,
    });

    // The simulated chat_messages table has exactly one row for the id, with
    // the LAST terminal state (the retry replaced the failed tail).
    const inserts = db.writes.filter((w) => w.kind === "insert" && w.table === chatMessages);
    expect(inserts).toHaveLength(2);
    const deletes = db.writes.filter((w) => w.kind === "delete" && w.table === chatMessages);
    expect(deletes).toHaveLength(2);
    for (const d of deletes) expect(sqlParams(d.where)).toEqual([THREAD, "u1:a"]);
    expect(db.rows).toHaveLength(1);
    expect((db.rows[0].row.message as { metadata: Record<string, unknown> }).metadata.runStatus).toBe("completed");
  });
});

describe("resolveTerminalRunState", () => {
  it("classifies every stream end honestly", () => {
    expect(resolveTerminalRunState({ isAborted: true, abortOutcome: null, finishReason: undefined, streamError: null })).toEqual({
      status: "cancelled",
      error: "Run cancelled by user",
    });
    expect(resolveTerminalRunState({ isAborted: false, abortOutcome: "user", streamError: null })).toEqual({
      status: "cancelled",
      error: "Run cancelled by user",
    });
    expect(resolveTerminalRunState({ isAborted: true, abortOutcome: "timeout", streamError: null })).toEqual({
      status: "failed",
      error: "Generation timed out (600s safety cap)",
    });
    expect(resolveTerminalRunState({ isAborted: false, abortOutcome: null, streamError: "Provider stream error" })).toEqual({
      status: "failed",
      error: "Provider stream error",
    });
    expect(resolveTerminalRunState({ isAborted: false, abortOutcome: null, finishReason: "error", streamError: null })).toEqual({
      status: "failed",
      error: "Generation failed (finishReason=error)",
    });
    // Client-disconnect cancel() path: no finish chunk ever arrived.
    expect(resolveTerminalRunState({ isAborted: false, abortOutcome: null, finishReason: undefined, streamError: null })).toEqual({
      status: "failed",
      error: "Stream interrupted before completion",
    });
    expect(resolveTerminalRunState({ isAborted: false, abortOutcome: null, finishReason: "stop", streamError: null })).toEqual({
      status: "completed",
      error: null,
    });
    expect(resolveTerminalRunState({ isAborted: false, abortOutcome: null, finishReason: "tool-calls", streamError: null })).toEqual({
      status: "completed",
      error: null,
    });
  });
});

describe("assistantMessageIdForTurn", () => {
  it("derives the turn key from the seed user message so a retry replaces the row", () => {
    expect(assistantMessageIdForTurn({ id: "u1", role: "user", parts: [] } as UIMessage, "run1")).toBe("u1:a");
    expect(assistantMessageIdForTurn(undefined, "run1")).toBe("run1:assistant");
    expect(assistantMessageIdForTurn({ id: "a1", role: "assistant", parts: [] } as UIMessage, "run1")).toBe(
      "run1:assistant",
    );
  });
});

// ---------------------------------------------------------------------------
// Fix 2 — interrupted-run recovery
// ---------------------------------------------------------------------------

describe("failInterruptedChatRuns (boot sweep)", () => {
  it("marks every running chat run failed with the restart error", async () => {
    const { db } = makeFakeDb({ updateReturning: [{ id: "r1" }, { id: "r2" }] });
    mockedGetDb.mockReturnValue(db as never);

    const count = await failInterruptedChatRuns();

    expect(count).toBe(2);
    const update = findWrite(db.writes, "update", agentRuns);
    expect(update).toBeDefined();
    expect((update.set as Record<string, unknown>).status).toBe("failed");
    expect((update.set as Record<string, unknown>).error).toBe("Interrupted by server restart");
    expect((update.set as Record<string, unknown>).finishedAt).toBeInstanceOf(Date);
  });
});

describe("recoverStaleChatRuns (cron sweep)", () => {
  it("fails only runs older than 30 minutes with no live controller", async () => {
    const { db } = makeFakeDb({
      agentRunRows: [
        { id: "run-live", status: "running", error: null },
        { id: "run-dead", status: "running", error: null },
      ],
      updateReturning: [{ id: "run-dead" }],
    });
    mockedGetDb.mockReturnValue(db as never);
    // "run-live" is registered in the controller registry → treated as alive.
    const { registerRunController } = await import("@/lib/ai/run-registry");
    registerRunController("run-live", new AbortController());

    const count = await recoverStaleChatRuns();

    expect(count).toBe(1);
    const update = findWrite(db.writes, "update", agentRuns);
    const whereParams = sqlParams(update?.where);
    expect(whereParams).toContain("run-dead");
    expect(whereParams).not.toContain("run-live");
    expect((update.set as Record<string, unknown>).error).toBe("Run timed out (stale)");
  });
});

describe("resolveStaleAssistantMetadata (loader)", () => {
  it("resolves a stale 'running' message to the run's terminal truth (row updated in place)", async () => {
    const message = {
      id: "u1:a",
      role: "assistant",
      parts: [{ type: "text", text: "x" }],
      metadata: { runId: "r1", runStatus: "running" },
    };
    const { db } = makeFakeDb({
      chatMessageRows: [{ threadId: THREAD, uiId: "u1:a", row: { id: "row-1", message } }],
      agentRunRows: [{ id: "r1", status: "failed", error: "Provider stream error" }],
    });
    mockedGetDb.mockReturnValue(db as never);

    await resolveStaleAssistantMetadata(THREAD);

    const update = findWrite(db.writes, "update", chatMessages);
    expect(update).toBeDefined();
    const updatedMessage = (update.set as { message: Record<string, unknown> }).message;
    expect((updatedMessage.metadata as Record<string, unknown>).runStatus).toBe("failed");
    expect((updatedMessage.metadata as Record<string, unknown>).runError).toBe("Provider stream error");
  });

  it("leaves rows alone when the run is still live in this process", async () => {
    const message = {
      id: "u1:a",
      role: "assistant",
      parts: [{ type: "text", text: "x" }],
      metadata: { runId: "r1", runStatus: "running" },
    };
    const { db } = makeFakeDb({
      chatMessageRows: [{ threadId: THREAD, uiId: "u1:a", row: { id: "row-1", message } }],
      agentRunRows: [{ id: "r1", status: "running", error: null }],
    });
    mockedGetDb.mockReturnValue(db as never);

    await resolveStaleAssistantMetadata(THREAD);

    expect(db.writes.filter((w) => w.kind === "update" && w.table === chatMessages)).toHaveLength(0);
  });

  it("resolves a row whose run is missing entirely to failed", async () => {
    const message = {
      id: "u1:a",
      role: "assistant",
      parts: [{ type: "text", text: "x" }],
      metadata: { runId: "gone", runStatus: "running" },
    };
    const { db } = makeFakeDb({
      chatMessageRows: [{ threadId: THREAD, uiId: "u1:a", row: { id: "row-1", message } }],
      agentRunRows: [],
    });
    mockedGetDb.mockReturnValue(db as never);

    await resolveStaleAssistantMetadata(THREAD);

    const update = findWrite(db.writes, "update", chatMessages);
    const updatedMessage = (update.set as { message: { metadata: Record<string, unknown> } }).message;
    expect(updatedMessage.metadata.runStatus).toBe("failed");
  });
});

describe("filterEmptyAssistantPlaceholders", () => {
  it("keeps user rows and drops empty assistant placeholders", () => {
    const user = { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] } as unknown as UIMessage;
    const good = uidMessage({ id: "u1:a" });
    const empty = uidMessage({ id: "u2:a", parts: [] as never });
    const out = filterEmptyAssistantPlaceholders([user, empty, good]);
    expect(out).toEqual([user, good]);
  });
});

// ---------------------------------------------------------------------------
// Fix 4 — conversation title generation
// ---------------------------------------------------------------------------

describe("maybeAutoTitleThread", () => {
  beforeEach(() => {
    mockedGetModel.mockResolvedValue({ model: {}, modelId: "test-model" } as never);
  });

  it("generates a useful title for a first exchange on a default thread", async () => {
    const { db } = makeFakeDb({ threadRows: [{ id: THREAD, title: "New chat" }] });
    mockedGetDb.mockReturnValue(db as never);
    mockedGenerateText.mockResolvedValue({ text: '"Facebook AI Marketing Post"' } as never);

    maybeAutoTitleThread({ threadId: THREAD, workspaceId: WORKSPACE, firstUserText: "Create a Facebook AI marketing post" });
    await vi.waitFor(() => {
      expect(db.writes.filter((w) => w.kind === "update" && w.table === chatThreads)).toHaveLength(1);
    });

    const update = findWrite(db.writes, "update", chatThreads);
    expect((update.set as Record<string, unknown>).title).toBe("Facebook AI Marketing Post");
    // Bounded call: small output budget.
    expect(mockedGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({ maxOutputTokens: 24, abortSignal: expect.any(AbortSignal) }),
    );
  });

  it("never overrides a user rename", async () => {
    const { db } = makeFakeDb({ threadRows: [{ id: THREAD, title: "My Renamed Chat" }] });
    mockedGetDb.mockReturnValue(db as never);

    maybeAutoTitleThread({ threadId: THREAD, workspaceId: WORKSPACE, firstUserText: "Create posts" });
    await new Promise((r) => setTimeout(r, 20));

    expect(db.writes.filter((w) => w.kind === "update" && w.table === chatThreads)).toHaveLength(0);
    expect(mockedGenerateText).not.toHaveBeenCalled();
  });

  it("upgrades a still-auto title that matches the first-message truncation", async () => {
    const firstUserText = "Create a full campaign for the product launch next week please";
    const { db } = makeFakeDb({ threadRows: [{ id: THREAD, title: firstUserText.slice(0, 60) }] });
    mockedGetDb.mockReturnValue(db as never);
    mockedGenerateText.mockResolvedValue({ text: "Product Launch Campaign" } as never);

    maybeAutoTitleThread({ threadId: THREAD, workspaceId: WORKSPACE, firstUserText });
    await vi.waitFor(() => {
      expect(db.writes.filter((w) => w.kind === "update" && w.table === chatThreads)).toHaveLength(1);
    });
    const update = findWrite(db.writes, "update", chatThreads);
    expect((update.set as Record<string, unknown>).title).toBe("Product Launch Campaign");
  });

  it("falls back silently to the truncated first message when AI fails", async () => {
    const firstUserText = "Tell me everything about how to market my new bakery in Boston this spring".repeat(2);
    const { db } = makeFakeDb({ threadRows: [{ id: THREAD, title: "New chat" }] });
    mockedGetDb.mockReturnValue(db as never);
    mockedGenerateText.mockRejectedValue(new Error("provider down"));

    maybeAutoTitleThread({ threadId: THREAD, workspaceId: WORKSPACE, firstUserText });
    await vi.waitFor(() => {
      expect(db.writes.filter((w) => w.kind === "update" && w.table === chatThreads)).toHaveLength(1);
    });

    const update = findWrite(db.writes, "update", chatThreads);
    const title = (update.set as Record<string, unknown>).title as string;
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…")).toBe(true);
  });

  it("is a no-op when the thread title was already auto-generated by AI (not the default)", async () => {
    const { db } = makeFakeDb({ threadRows: [{ id: THREAD, title: "Facebook AI Marketing Post" }] });
    mockedGetDb.mockReturnValue(db as never);

    maybeAutoTitleThread({ threadId: THREAD, workspaceId: WORKSPACE, firstUserText: "Create a Facebook AI marketing post" });
    await new Promise((r) => setTimeout(r, 20));

    expect(db.writes.filter((w) => w.kind === "update" && w.table === chatThreads)).toHaveLength(0);
  });
});
