import { withSchemaGuard } from "@/components/system/schema-guard";
﻿import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { UIMessage } from "ai";

import { getDb } from "@/db";
import { chatMessages, chatThreads } from "@/db/schema";
import { hasWorkspaceAIConfig } from "@/lib/ai/config";
import { requireWorkspace } from "@/lib/workspace";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ThreadList } from "@/components/chat/thread-list";
import { MobileThreads } from "@/components/chat/mobile-threads";
import { PageHeader } from "@/components/layout/page-header";
import {
  filterEmptyAssistantPlaceholders,
  resolveStaleAssistantMetadata,
} from "@/lib/ai/chat-persistence";

export const metadata = { title: "AI Chat" };

async function ThreadPage({
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
        isNull(chatThreads.deletedAt),
      ),
    );
  if (!thread) notFound();

  // Resolve any assistant message whose metadata still says "running"
  // against the real agent_runs state (rows are updated in place). A
  // reloaded thread must never render a phantom "running" bubble when the
  // run is actually terminal — server restarts and dropped SSE connections
  // used to leave these stuck. Best-effort; the loader also filters empty
  // placeholders.
  await resolveStaleAssistantMetadata(threadId);

  const rows = await db
    .select({ message: chatMessages.message })
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(asc(chatMessages.createdAt));

  const initialMessages = filterEmptyAssistantPlaceholders(
    rows
      .map((r) => r.message as unknown as UIMessage)
      .filter((m) => m && typeof m.role === "string" && Array.isArray(m.parts)),
  );



  return (
    <div className="space-y-6">
      <PageHeader title={thread.title} description="Conversation with your workspace agent." />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden h-[calc(100vh-10rem)] lg:block">
          <ThreadList activeThreadId={thread.id} />
        </aside>
        <div className="mb-3 lg:hidden">
          <MobileThreads activeThreadId={thread.id} />
        </div>
        <ChatPanel
          key={thread.id}
          workspaceId={ctx.workspace.id}
          workspaceName={ctx.workspace.name}
          threadId={thread.id}
          initialMessages={initialMessages}
          targetMessageId={targetMessageId ?? null}
          aiConfigured={await hasWorkspaceAIConfig(ctx.workspace.id)}
        />
      </div>
    </div>
  );
}

export default withSchemaGuard("(app)/chat/[threadId]/page.tsx", ThreadPage);
