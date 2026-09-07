"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { chatMessages, chatThreads } from "@/db/schema";
import { getSessionUser, resolveActionWorkspace } from "@/lib/workspace";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Soft delete: chat_threads.deleted_at (the column exists for exactly this).
// Every thread/message query below scopes with isNull(deleted_at).
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
        isNull(chatThreads.deletedAt),
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
  // Soft delete — chat_threads.deleted_at. History is kept (audit/recovery),
  // every thread query filters isNull(deleted_at), so the thread disappears
  // from the list, search, routing and the chat/persist APIs.
  await db
    .update(chatThreads)
    .set({ deletedAt: new Date() })
    .where(eq(chatThreads.id, threadId));
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

  // Ownership scope for every search surface: threads owned by this user in
  // the active workspace and not soft-deleted. Expressed as a subquery so
  // neither the title search nor the message search can leak another user's
  // threads in the same workspace.
  const ownedThreadIds = db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(
      and(
        eq(chatThreads.workspaceId, workspaceId),
        eq(chatThreads.userId, user.id),
        isNull(chatThreads.deletedAt),
      ),
    );

  // 1) Title matches.
  const titleRows = await db
    .select({ id: chatThreads.id, title: chatThreads.title, updatedAt: chatThreads.updatedAt })
    .from(chatThreads)
    .where(and(inArray(chatThreads.id, ownedThreadIds), ilike(chatThreads.title, like)))
    .orderBy(desc(chatThreads.updatedAt))
    .limit(15);

  const results: ThreadSearchResult[] = titleRows.map((t) => ({
    threadId: t.id,
    title: t.title,
    snippet: "Title match",
    messageId: null,
    updatedAt: t.updatedAt.toISOString(),
  }));

  // 2) Message content matches (raw stored text of messages, tool-safe).
  const msgRows = await db
    .select({
      threadId: chatMessages.threadId,
      messageId: chatMessages.id,
      content: chatMessages.content,
      uiId: sql<string>`${chatMessages.message} ->> 'id'`,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.workspaceId, workspaceId),
        inArray(chatMessages.threadId, ownedThreadIds),
        ilike(chatMessages.content, like),
      ),
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(20);

  const hitThreadIds = Array.from(new Set(msgRows.map((m) => m.threadId)));
  const threadTitles = new Map<string, string>();
  if (hitThreadIds.length > 0) {
    const titles = await db
      .select({ id: chatThreads.id, title: chatThreads.title })
      .from(chatThreads)
      .where(inArray(chatThreads.id, hitThreadIds));
    for (const t of titles) threadTitles.set(t.id, t.title);
  }

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
      updatedAt: m.createdAt.toISOString(),
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
    .where(
      and(
        eq(chatThreads.workspaceId, workspaceId),
        eq(chatThreads.userId, user.id),
        isNull(chatThreads.deletedAt),
      ),
    )
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

