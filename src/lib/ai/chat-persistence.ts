import "server-only";

/**
 * Server-side chat persistence — the BACKEND is the source of truth for
 * assistant messages, not the client.
 *
 * ── Assistant upsert (fix 1) ─────────────────────────────────────────────
 * The chat route calls `persistAssistantMessage` from the SDK v5
 * `toUIMessageStreamResponse({ onFinish })` terminal callback with the
 * assembled `responseMessage` (parts verbatim: tool inputs/outputs,
 * reasoning, runId/runStatus metadata). Failed/aborted/interrupted runs
 * still persist whatever partial content exists with a terminal runStatus,
 * so a phantom "running" row can never outlive its stream.
 *
 * Upsert key: `(thread_id, message->>'id')` — chat_messages has no natural
 * unique index and migrations are out of scope, so the upsert is
 * delete-then-insert inside one transaction. Retries re-derive the SAME
 * assistant id from the retried user message id
 * (`assistantMessageIdForTurn`), so the replaced tail collapses into one
 * row — never a duplicate.
 *
 * Late-flush safety: if the SDK fires `onFinish` AFTER the placeholder was
 * already gone (interrupted SSE that finally reconnected, or a retry that
 * raced past the original), the function now INSERTS the late response
 * rather than silently dropping it. A newer run that owns the same key
 * still wins via the `existingRunId` guard.
 *
 * ── Interrupted-run recovery (fix 2) ────────────────────────────────────
 * `failInterruptedChatRuns` (boot) and `recoverStaleChatRuns` (every-minute
 * cron) mark dead chat runs failed; `resolveStaleAssistantMetadata` resolves
 * stale "running" message metadata against agent_runs at thread load.
 *
 * ── Title generation (fix 4) ────────────────────────────────────────────
 * `maybeAutoTitleThread` fires from the same terminal callback (and from the
 * first-exchange persist path): one bounded generateText call, silent
 * fallback to the truncated first user message, user renames always win.
 */

import { generateText, type UIMessage } from "ai";
import { and, asc, eq, inArray, lt, param, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, chatMessages, chatThreads } from "@/db/schema";
import { getWorkspaceTextModel } from "@/lib/ai/config";
import { isRunRegistered } from "@/lib/ai/run-registry";

const DEFAULT_TITLE = "New chat";
export const MAX_TITLE_LEN = 60;
const STALE_RUN_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const TITLE_ABORT_MS = 120_000;
const TITLE_MAX_OUTPUT_TOKENS = 24;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function textOf(message: UIMessage): string {
  return (message.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function isEmptyAssistantPlaceholder(message: UIMessage): boolean {
  if (message.role !== "assistant") return false;
  const parts = message.parts ?? [];
  // True empties — the old phantom "running" bubble.
  if (parts.length === 0) return true;
  // A single empty text part is equally empty: nothing to render, nothing
  // useful to retry from, and the SDK treats it as a non-message. Drop it
  // at every load boundary so the chat panel never paints a blank bubble.
  if (
    parts.length === 1 &&
    parts[0].type === "text" &&
    (parts[0] as { text?: string }).text?.trim() === ""
  ) {
    return true;
  }
  return false;
}

/** Drop empty assistant placeholders — they carry zero information and were
 * the root cause of phantom "running" bubbles (thread 510a7260, msg2). */
export function filterEmptyAssistantPlaceholders(messages: UIMessage[]): UIMessage[] {
  return messages.filter((m) => !isEmptyAssistantPlaceholder(m));
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

// ---------------------------------------------------------------------------
// Fix 1 — server-side assistant persistence
// ---------------------------------------------------------------------------

/**
 * The deterministic assistant message id for the turn responding to
 * `seedMessage` (the LAST message of the request history — after the SDK's
 * regenerate() slicing that is always the retried/sent user message).
 *
 * Deriving the id from the user message (instead of the run id) is what makes
 * a retry REPLACE its failed row instead of appending a second assistant row
 * for the same turn: the retried request carries the same user message id,
 * so the upsert key is identical.
 */
export function assistantMessageIdForTurn(
  seedMessage: UIMessage | undefined,
  runId: string,
): string {
  const seedId = seedMessage && typeof seedMessage.id === "string" ? seedMessage.id : null;
  return seedMessage?.role === "user" && seedId ? seedId + ":a" : runId + ":assistant";
}

/**
 * Honest terminal classification for a finished stream.
 * - user cancel (abort part)            → cancelled
 * - 600s safety cap / non-user abort    → failed (matches the run row)
 * - provider stream error               → failed
 * - stream ended WITHOUT a finishReason → failed ("interrupted"): this is the
 *   client-disconnect path — the SDK fires onFinish from the stream's
 *   cancel() with no finish chunk, and persisting that as "completed" would
 *   be a lie.
 * - otherwise (stop/length/tool-calls)  → completed
 */
export function resolveTerminalRunState(input: {
  isAborted: boolean;
  abortOutcome: "user" | "timeout" | null;
  finishReason?: string;
  streamError: string | null;
}): { status: "completed" | "failed" | "cancelled"; error: string | null } {
  if (input.abortOutcome === "user") return { status: "cancelled", error: "Run cancelled by user" };
  if (input.abortOutcome === "timeout") {
    return { status: "failed", error: "Generation timed out (600s safety cap)" };
  }
  if (input.isAborted) return { status: "cancelled", error: "Run cancelled by user" };
  if (input.streamError) return { status: "failed", error: input.streamError };
  if (input.finishReason === "error") {
    return { status: "failed", error: "Generation failed (finishReason=error)" };
  }
  if (input.finishReason == null) {
    return { status: "failed", error: "Stream interrupted before completion" };
  }
  return { status: "completed", error: null };
}

export type PersistArgs = {
  threadId: string;
  workspaceId: string;
  userId: string;
  message: UIMessage;
  runStatus: "completed" | "failed" | "cancelled";
  runError?: string | null;
};

/**
 * Upsert one assistant message by `(thread_id, message->>'id')`.
 * - Parts are stored VERBATIM (tool inputs/outputs, reasoning, metadata).
 * - The metadata's runStatus is always overwritten with the caller's terminal
 *   state; a "running" claim never survives persistence.
 * - Bumps chat_threads.updated_at (loadThreadsAction sorts by it).
 *
 * Race safety: the SDK may fire `onFinish` AFTER a later turn has already
 * overwritten the placeholder (e.g. user closed the tab mid-stream, another
 * tab retried the turn, then a stranded SSE finally flushed). The unique
 * guard is `existing.metadata.runId === incomingRunId`: if a NEWER run owns
 * the same message id, the old run silently loses — but if NO row exists at
 * all (placeholder deleted, thread not edited, late flush from the same run),
 * we INSERT instead of dropping the user's response on the floor.
 */
export async function persistAssistantMessage(args: PersistArgs): Promise<void> {
  if (!args.threadId || !args.workspaceId || !args.userId) return;

  const messageId = typeof args.message.id === "string" ? args.message.id : null;
  if (!messageId) return;

  const incomingMeta = (args.message.metadata ?? {}) as Record<string, unknown>;
  const metadata: Record<string, unknown> = { ...incomingMeta };
  if (typeof incomingMeta.runId === "string") metadata.runId = incomingMeta.runId;
  metadata.runStatus = args.runStatus;
  if (args.runError) metadata.runError = args.runError;
  else delete metadata.runError;

  // Retain the terminal metadata even when the provider produced no parts.
  // The saved placeholder is the user's retry/recovery anchor.
  const finalMessage: UIMessage = { ...args.message,
    parts: args.message.parts.length ? args.message.parts : [{ type: "text", text: "" }],
    metadata: metadata as UIMessage["metadata"] };

  const db = getDb();
  await db.transaction(async (tx) => {
    // The same row lock is used when starting/editing a turn. Delayed stream
    // completion cannot overwrite a newer retry or resurrect an edited tail.
    await tx.execute(sql`select id from ${chatThreads} where id = ${param(args.threadId)} for update`);
    const [existing] = await tx.select().from(chatMessages).where(and(eq(chatMessages.threadId, args.threadId),
      sql`${chatMessages.message} ->> 'id' = ${param(messageId)}`));
    const existingRunId = (existing?.message as { metadata?: { runId?: string } } | undefined)?.metadata?.runId;
    // Race-safety guard: a newer run owns this key. The old run silently
    // loses (its onFinish was late) — the right behaviour.
    if (existingRunId && existingRunId !== incomingMeta.runId) return;
    if (existing) {
      await tx.delete(chatMessages).where(
        and(
          eq(chatMessages.threadId, args.threadId),
          // param(): plain strings in sql`` are interpolated as RAW SQL — the
          // message id is client-influenced and must be a bound parameter.
          sql`${chatMessages.message} ->> 'id' = ${param(messageId)}`,
        ),
      );
    }
    await tx.insert(chatMessages).values({
      threadId: args.threadId,
      workspaceId: args.workspaceId,
      role: args.message.role,
      content: textOf(args.message),
      message: finalMessage as unknown as Record<string, unknown>,
      // No existing row → use "now" (we don't know the original createdAt).
      // The thread's updated_at bump below keeps loadThreadsAction sorted.
      createdAt: existing?.createdAt ?? new Date(),
    });
    await tx
      .update(chatThreads)
      .set({ updatedAt: new Date() })
      .where(eq(chatThreads.id, args.threadId));
    if (typeof incomingMeta.runId === "string") {
      await tx.update(agentRuns).set({ status: args.runStatus, error: args.runError ?? null, finishedAt: new Date() })
        .where(and(eq(agentRuns.id, incomingMeta.runId), eq(agentRuns.workspaceId, args.workspaceId),
          eq(agentRuns.userId, args.userId), eq(agentRuns.status, "running")));
    }
  });
}

// ---------------------------------------------------------------------------
// Fix 2 — interrupted-run recovery
// ---------------------------------------------------------------------------

/** A new process cannot infer that runs owned by other processes are dead. */
export async function failInterruptedChatRuns(): Promise<number> {
  return recoverStaleChatRuns();
}

/**
 * Every-minute sweep: chat runs "running" for > 30 minutes with no live
 * controller in the in-process registry (the liveness source) are failed.
 * Chat streams are capped at 600s, so a 30-min-old running row is dead by
 * construction — the registry check is belt-and-braces for long-lived rows
 * from other kinds of bookkeeping mistakes.
 */
export async function recoverStaleChatRuns(): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - STALE_RUN_TIMEOUT_MS);
  const candidates = await db
    .select({ id: agentRuns.id })
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.kind, "chat"),
        eq(agentRuns.status, "running"),
        lt(agentRuns.startedAt, cutoff),
      ),
    );
  const staleIds = candidates.map((c) => c.id).filter((id) => !isRunRegistered(id));
  if (staleIds.length === 0) return 0;
  const result = await db
    .update(agentRuns)
    .set({
      status: "failed",
      error: "Run timed out (stale)",
      finishedAt: new Date(),
    })
    .where(and(inArray(agentRuns.id, staleIds), eq(agentRuns.status, "running"), lt(agentRuns.startedAt, cutoff)))
    .returning({ id: agentRuns.id });
  return result.length;
}

/**
 * Resolve assistant rows whose metadata claims runStatus "running" but whose
 * run is terminal (or missing) in agent_runs — at thread LOAD time.
 *
 * Strategy (documented, consistent): UPDATE the row in place so the DB itself
 * becomes truthful; the response then renders from resolved rows. Rows whose
 * run is still live in this process are left alone — the stream's own
 * terminal callback finalizes them. Runs that are missing entirely are
 * resolved to "failed" (the run row was never written or was lost).
 */
export async function resolveStaleAssistantMetadata(threadId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: chatMessages.id, message: chatMessages.message })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.threadId, threadId),
        eq(chatMessages.role, "assistant"),
        sql`${chatMessages.message} -> 'metadata' ->> 'runStatus' = 'running'`,
      ),
    )
    .orderBy(asc(chatMessages.createdAt));
  if (rows.length === 0) return;

  const runIds = rows
    .map((r) => {
      const meta = (r.message as Record<string, unknown> | null)?.metadata as
        | Record<string, unknown>
        | undefined;
      return typeof meta?.runId === "string" ? meta.runId : null;
    })
    .filter((id): id is string => id !== null);
  if (runIds.length === 0) return;

  const runRows = await db
    .select({ id: agentRuns.id, status: agentRuns.status, error: agentRuns.error })
    .from(agentRuns)
    .where(inArray(agentRuns.id, runIds));
  const runById = new Map(runRows.map((r) => [r.id, r]));

  for (const row of rows) {
    const msg = row.message as Record<string, unknown> | null;
    const meta = msg?.metadata as Record<string, unknown> | undefined;
    if (!meta || meta.runStatus !== "running" || typeof meta.runId !== "string") continue;
    const run = runById.get(meta.runId);
    // Still live (another tab is streaming this run) — leave it alone.
    if (run && run.status === "running") continue;
    const status =
      run && (run.status === "completed" || run.status === "failed" || run.status === "cancelled")
        ? run.status
        : "failed";
    const newMeta: Record<string, unknown> = { ...meta, runStatus: status };
    if (run?.error) newMeta.runError = run.error;
    const newMessage = { ...msg, metadata: newMeta };
    await db
      .update(chatMessages)
      .set({ message: newMessage as Record<string, unknown> })
      .where(and(eq(chatMessages.id, row.id),
        sql`${chatMessages.message} -> 'metadata' ->> 'runStatus' = 'running'`));
  }
}

// ---------------------------------------------------------------------------
// Fix 4 — conversation title generation
// ---------------------------------------------------------------------------

function sanitizeTitle(raw: string): string {
  const line = raw.replace(/\s+/g, " ").trim();
  const unquoted = line.replace(/^["'“”«»]+|["'“”«»]+$/g, "").trim();
  return unquoted;
}

/** Only auto-titles still carry the default: empty, the generic default, or
 * the first-message truncation the auto-creation paths write. A user rename
 * (renameThreadAction) never matches → user renames always win. */
function isAutoTitleDefault(current: string, firstUserText: string): boolean {
  const trimmed = current.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.toLowerCase() === DEFAULT_TITLE.toLowerCase()) return true;
  return trimmed === firstUserText.slice(0, MAX_TITLE_LEN).trim();
}

/**
 * Fire-and-forget title generation for a thread still carrying its
 * auto-default title. One bounded generateText (~24 output tokens, 120s
 * abort); on ANY failure (config missing, provider error, timeout, empty
 * output) it falls back to the truncated first user message. Never throws,
 * never blocks the caller, and re-checks the title before writing so a
 * concurrent user rename always wins.
 */
export function maybeAutoTitleThread(args: {
  threadId: string;
  workspaceId: string;
  firstUserText: string;
}): void {
  const text = args.firstUserText.trim();
  if (!text) return;

  void (async () => {
    try {
      const db = getDb();
      const [thread] = await db
        .select({ id: chatThreads.id, title: chatThreads.title })
        .from(chatThreads)
        .where(eq(chatThreads.id, args.threadId));
      if (!thread || !isAutoTitleDefault(thread.title, text)) return;

      let generated: string | null = null;
      try {
        const { model } = await getWorkspaceTextModel(args.workspaceId, "chat");
        const result = await generateText({
          model,
          prompt:
            "Generate a short chat title (3-6 words) for a conversation that starts with the message below. " +
            "Reply with the title only — no quotes, no punctuation at the end, no explanation.\n\n" +
            "<first_message>\n" +
            text.slice(0, 500) +
            "\n</first_message>",
          maxOutputTokens: TITLE_MAX_OUTPUT_TOKENS,
          abortSignal: AbortSignal.timeout(TITLE_ABORT_MS),
        });
        generated = sanitizeTitle(result.text);
      } catch {
        // Silent: AI config errors, provider errors and timeouts all fall
        // back to the deterministic truncation below.
        generated = null;
      }

      const final = (generated && generated.length > 0 ? generated : truncate(text, MAX_TITLE_LEN)).trim();
      if (!final) return;

      // Rename-wins re-check: the user may have renamed while we generated.
      const [fresh] = await db
        .select({ title: chatThreads.title })
        .from(chatThreads)
        .where(eq(chatThreads.id, args.threadId));
      if (!fresh || fresh.title !== thread.title) return;

      await db
        .update(chatThreads)
        .set({ title: final.slice(0, 100) })
        .where(and(eq(chatThreads.id, args.threadId), eq(chatThreads.title, thread.title)));
    } catch {
      // Title generation is best-effort; never propagate.
    }
  })();
}
