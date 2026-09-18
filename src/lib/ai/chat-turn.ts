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
    const history = prior.map(row => row.message as unknown as UIMessage);
    while (history.length && history[0].role !== "user") history.shift();
    const messages = history.map(m => ({ ...m, parts: m.parts.filter(p => {
      if (p.type === "text") return p.text.trim().length > 0;
      if (!p.type.startsWith("tool-")) return true;
      return ["output-available", "output-error"].includes((p as { state?: string }).state ?? "");
    }) })).filter(m => m.parts.length > 0);
    return { run, context: thread.context, messages: [...messages, args.message] as UIMessage[] };
  });
}
