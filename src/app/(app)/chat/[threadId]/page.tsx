import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import type { UIMessage } from "ai";

import { getDb } from "@/db";
import { chatMessages, chatThreads } from "@/db/schema";
import { isAiConfigured } from "@/lib/ai/provider";
import { requireWorkspace } from "@/lib/workspace";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ThreadList } from "@/components/chat/thread-list";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "AI Chat" };

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { threadId } = await params;
  const { m: targetMessageId } = await searchParams;
  const ctx = await requireWorkspace();
  const db = getDb();

  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(
      and(
        eq(chatThreads.id, threadId),
        eq(chatThreads.workspaceId, ctx.workspace.id),
        eq(chatThreads.userId, ctx.user.id),
      ),
    );
  if (!thread) notFound();

  const rows = await db
    .select({ message: chatMessages.message })
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(asc(chatMessages.createdAt));

  const initialMessages = rows
    .map((r) => r.message as unknown as UIMessage)
    .filter((m) => m && typeof m.role === "string" && Array.isArray(m.parts));

  const threads = await db
    .select({ id: chatThreads.id, title: chatThreads.title })
    .from(chatThreads)
    .where(eq(chatThreads.workspaceId, ctx.workspace.id))
    .orderBy(desc(chatThreads.updatedAt))
    .limit(30);

  return (
    <div className="space-y-6">
      <PageHeader title={thread.title} description="Conversation with your workspace agent." />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden h-[calc(100vh-10rem)] lg:block">
          <ThreadList activeThreadId={thread.id} />
        </aside>
        <ChatPanel
          workspaceId={ctx.workspace.id}
          workspaceName={ctx.workspace.name}
          threadId={thread.id}
          initialMessages={initialMessages}
          targetMessageId={targetMessageId ?? null}
          aiConfigured={isAiConfigured()}
        />
      </div>
    </div>
  );
}
