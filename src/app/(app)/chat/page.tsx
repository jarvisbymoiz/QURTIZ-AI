import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { MessageSquare, Plus } from "lucide-react";
import { getDb } from "@/db";
import { chatThreads } from "@/db/schema";
import { isAiConfigured } from "@/lib/ai/provider";
import { requireWorkspace } from "@/lib/workspace";
import { ChatPanel } from "@/components/chat/chat-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "AI Chat" };

export default async function ChatIndexPage() {
  const ctx = await requireWorkspace();
  const db = getDb();

  const threads = await db
    .select({ id: chatThreads.id, title: chatThreads.title, updatedAt: chatThreads.updatedAt })
    .from(chatThreads)
    .where(eq(chatThreads.workspaceId, ctx.workspace.id))
    .orderBy(desc(chatThreads.updatedAt))
    .limit(30);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Chat"
        description="Your primary control surface. The agent knows your Brand Brain and remembers durable preferences."
      />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-2">
          <Button nativeButton={false} variant="outline" className="w-full justify-start gap-2" render={<Link href="/chat" />}><Plus className="size-4" aria-hidden /> New chat</Button>
          {threads.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No conversations yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/chat/${t.id}`}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent"
                  >
                    <MessageSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{t.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <ChatPanel
          workspaceId={ctx.workspace.id}
          workspaceName={ctx.workspace.name}
          threadId={null}
          initialMessages={[]}
          aiConfigured={isAiConfigured()}
        />
      </div>
    </div>
  );
}



