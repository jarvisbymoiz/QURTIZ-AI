import "server-only";
import type { UIMessage } from "ai";
import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, chatMessages, chatThreads } from "@/db/schema";
import { assistantMessageIdForTurn, textOf } from "./chat-persistence";

export class ChatTurnError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Serialize turns under the thread row lock. Store the user and run before
 * starting a provider request; client-supplied assistant/tool results are never
 * used as trusted context. Editing/retrying replaces the selected tail. */
export async function prepareChatTurn(args: {
  threadId: string; createThread: boolean; workspaceId: string; userId: string;
  message: UIMessage; model: string;
}) {
  // The seed MUST be a well-formed user message with content. Without a user
  // seed there is no deterministic assistant id (assistantMessageIdForTurn
  // falls back to `runId:assistant`, which produces a different id on every
  // retry — duplicate rows instead of upserts).
  if (!args.message || args.message.role !== "user" || typeof args.message.id !== "string" || !args.message.id) {
    throw new ChatTurnError("Your message could not be saved. Please resend it.", 400);
  }
  const db = getDb();
  return db.transaction(async tx => {
    if (args.createThread) {
      await tx.insert(chatThreads).values({ id: args.threadId, workspaceId: args.workspaceId,
        userId: args.userId, title: textOf(args.message).slice(0, 60) || "New chat" }).onConflictDoNothing();
    }
    const [thread] = await tx.select().from(chatThreads).where(and(eq(chatThreads.id, args.threadId),
      eq(chatThreads.workspaceId, args.workspaceId), eq(chatThreads.userId, args.userId), isNull(chatThreads.deletedAt))).for("update");
    if (!thread) throw new ChatTurnError("Conversation not found.", 404);
    const rows = await tx.select().from(chatMessages).where(eq(chatMessages.threadId, args.threadId)).orderBy(asc(chatMessages.createdAt));
    const runIds = rows.flatMap(row => {
      const meta = (row.message as UIMessage).metadata as { runId?: string; runStatus?: string } | undefined;
      return meta?.runId && meta.runStatus === "running" ? [meta.runId] : [];
    });
    if (runIds.length) {
      const active = await tx.select({ id: agentRuns.id }).from(agentRuns)
        .where(and(inArray(agentRuns.id, runIds), eq(agentRuns.status, "running"),
          gt(agentRuns.startedAt, new Date(Date.now() - 11 * 60_000))));
      if (active.length) throw new ChatTurnError("This conversation is still running. Wait for it to finish or stop it before sending again.", 409);
    }
    const existingIndex = rows.findIndex(row => (row.message as UIMessage).id === args.message.id && row.role === "user");
    const prior = existingIndex >= 0 ? rows.slice(0, existingIndex) : rows;
    if (existingIndex >= 0) {
      await tx.delete(chatMessages).where(inArray(chatMessages.id, rows.slice(existingIndex).map(row => row.id)));
    }
    const lastTime = prior.at(-1)?.createdAt.getTime() ?? 0;
    const createdAt = new Date(Math.max(Date.now(), lastTime + 1));
    await tx.insert(chatMessages).values({ threadId: args.threadId, workspaceId: args.workspaceId,
      role: "user", content: textOf(args.message), message: args.message as unknown as Record<string, unknown>, createdAt });
    const [run] = await tx.insert(agentRuns).values({ workspaceId: args.workspaceId, userId: args.userId, kind: "chat", model: args.model }).returning();
    await tx.insert(chatMessages).values({ threadId: args.threadId, workspaceId: args.workspaceId, role: "assistant",
      message: { id: assistantMessageIdForTurn(args.message, run.id), role: "assistant", parts: [{ type: "text", text: "" }],
        metadata: { runId: run.id, runStatus: "running" } }, createdAt: new Date(createdAt.getTime() + 1) });
    await tx.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, args.threadId));
    // Never cut a tool exchange in half: keep complete UI messages and start
    // at a user turn. Unfinished tool parts cannot enter the next model call.
    //
    // Order matters: filter empty parts FIRST, then strip leading non-user
    // messages. Doing it the other way around can leave a non-user row at the
    // head when the leading shift removed one empty-text assistant placeholder
    // but exposed another below it — AI SDK v5's streamText() rejects any
    // history whose first message is not a user role ("first message must be
    // user role"), which was the source of intermittent multi-turn failures.
    const history = prior.map(row => row.message as unknown as UIMessage);
    const messages = history.map(m => ({ ...m, parts: m.parts.filter(p => {
      if (p.type === "text") return p.text.trim().length > 0;
      if (!p.type.startsWith("tool-")) return true;
      return ["output-available", "output-error"].includes((p as { state?: string }).state ?? "");
    }) })).filter(m => m.parts.length > 0);
    while (messages.length && messages[0].role !== "user") messages.shift();
    // The first turn has no prior history — that's fine (the new user
    // message below IS the first message). We only hard-fail when prior
    // history existed but every row was filtered out (corrupt thread).
    if (messages.length === 0 && prior.length > 0) {
      throw new ChatTurnError("Your conversation history is empty or invalid. Start a new chat.", 400);
    }
    return { run, context: thread.context, messages: [...messages, args.message] as UIMessage[] };
  });
}
