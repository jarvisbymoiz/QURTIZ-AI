"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { chatMessages, chatThreads } from "@/db/schema";
import { getSessionUser, resolveActionWorkspace } from "@/lib/workspace";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireThreadIdAccess(threadId: string): Promise<{ ok: true; workspaceId: string } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) return { ok: false, error: "Create or join a workspace first." };

  const db = getDb();
  const [thread] = await db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(
      and(
        eq(chatThreads.id, threadId),
        eq(chatThreads.workspaceId, workspaceId),
        eq(chatThreads.userId, user.id),
      ),
    );
  if (!thread) return { ok: false, error: "Thread not found." };
  return { ok: true, workspaceId };
}

export async function renameThreadAction(threadId: string, title: string): Promise<ActionResult> {
  const access = await requireThreadIdAccess(threadId);
  if (!access.ok) return { ok: false, error: access.error };
  const clean = title.trim();
  if (clean.length < 1 || clean.length > 100) return { ok: false, error: "Title must be 1-100 characters." };

  const db = getDb();
  await db
    .update(chatThreads)
    .set({ title: clean, updatedAt: new Date() })
    .where(eq(chatThreads.id, threadId));
  revalidatePath("/chat");
  revalidatePath("/chat/" + threadId);
  return { ok: true };
}

export async function deleteThreadAction(threadId: string): Promise<ActionResult> {
  const access = await requireThreadIdAccess(threadId);
  if (!access.ok) return { ok: false, error: access.error };
  const db = getDb();
  await db.delete(chatThreads).where(eq(chatThreads.id, threadId));
  revalidatePath("/chat");
  return { ok: true };
}

export async function setThreadPinnedAction(threadId: string, pinned: boolean): Promise<ActionResult> {
  const access = await requireThreadIdAccess(threadId);
  if (!access.ok) return { ok: false, error: access.error };
  const db = getDb();
  await db.update(chatThreads).set({ pinned, updatedAt: new Date() }).where(eq(chatThreads.id, threadId));
  revalidatePath("/chat");
  revalidatePath("/chat/" + threadId);
  return { ok: true };
}

export async function setThreadArchivedAction(threadId: string, archived: boolean): Promise<ActionResult> {
  const access = await requireThreadIdAccess(threadId);
  if (!access.ok) return { ok: false, error: access.error };
  const db = getDb();
  await db.update(chatThreads).set({ archived, updatedAt: new Date() }).where(eq(chatThreads.id, threadId));
  revalidatePath("/chat");
  revalidatePath("/chat/" + threadId);
  return { ok: true };
}

export async function clearConversationAction(threadId: string): Promise<ActionResult> {
  const access = await requireThreadIdAccess(threadId);
  if (!access.ok) return { ok: false, error: access.error };
  const db = getDb();
  await db.delete(chatMessages).where(eq(chatMessages.threadId, threadId));
  revalidatePath("/chat/" + threadId);
  return { ok: true };
}

export type ThreadSearchResult = {
  threadId: string;
  title: string;
  snippet: string;
  messageId: string | null;
  updatedAt: string;
};

export async function searchChatsAction(query: string): Promise<{ ok: boolean; results: ThreadSearchResult[] }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, results: [] };
  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) return { ok: false, results: [] };

  const clean = query.trim();
  if (clean.length < 2) return { ok: true, results: [] };

  const db = getDb();
  const like = "%" + clean + "%";

  const threads = await db
    .select({ id: chatThreads.id, title: chatThreads.title, updatedAt: chatThreads.updatedAt })
    .from(chatThreads)
    .where(
      and(
        eq(chatThreads.workspaceId, workspaceId),
        eq(chatThreads.userId, user.id),
        ilike(chatThreads.title, like),
      ),
    )
    .limit(15);

  const results: ThreadSearchResult[] = threads.map((t) => ({
    threadId: t.id,
    title: t.title,
    snippet: "Title match",
    messageId: null,
    updatedAt: t.updatedAt.toISOString(),
  }));

  // Message content matches (search raw text of stored messages)
  const msgRows = await db
    .select({
      threadId: chatMessages.threadId,
      messageId: chatMessages.id,
      content: chatMessages.content,
      uiId: sql<string>`${chatMessages.message} ->> 'id'`,
      updatedAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.workspaceId, workspaceId),
        ilike(chatMessages.content, like),
      ),
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(20);

  const threadTitles = new Map(results.map((r) => [r.threadId, r.title]));
  const allThreads = await db
    .select({ id: chatThreads.id, title: chatThreads.title, updatedAt: chatThreads.updatedAt })
    .from(chatThreads)
    .where(and(eq(chatThreads.workspaceId, workspaceId), eq(chatThreads.userId, user.id)));
  for (const t of allThreads) threadTitles.set(t.id, t.title);

  for (const m of msgRows) {
    if (results.length >= 20) break;
    if (results.some((r) => r.threadId === m.threadId && r.messageId === m.uiId)) continue;
    const idx = m.content.toLowerCase().indexOf(clean.toLowerCase());
    const snippet =
      idx === -1
        ? m.content.slice(0, 120)
        : (idx > 40 ? "…" : "") + m.content.slice(Math.max(0, idx - 40), idx + 80) + (m.content.length > idx + 80 ? "…" : "");
    results.push({
      threadId: m.threadId,
      title: threadTitles.get(m.threadId) ?? "Untitled chat",
      snippet,
      messageId: m.uiId ?? m.messageId,
      updatedAt: m.updatedAt.toISOString(),
    });
  }

    return { ok: true, results };
}

export async function loadThreadsAction(): Promise<{
  ok: boolean;
  threads: { id: string; title: string; pinned: boolean; archived: boolean; updatedAt: string }[];
}> {
  const user = await getSessionUser();
  if (!user) return { ok: false, threads: [] };
  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId) return { ok: false, threads: [] };

  const db = getDb();
  const rows = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.workspaceId, workspaceId), eq(chatThreads.userId, user.id)))
    .orderBy(desc(chatThreads.pinned), desc(chatThreads.updatedAt))
    .limit(100);

  return {
    ok: true,
    threads: rows.map((t) => ({
      id: t.id,
      title: t.title,
      pinned: t.pinned,
      archived: t.archived,
      updatedAt: t.updatedAt.toISOString(),
    })),
  };
}

