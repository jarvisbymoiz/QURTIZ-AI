import { isAiConfigured } from "@/lib/ai/provider";
import { requireWorkspace } from "@/lib/workspace";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ThreadList } from "@/components/chat/thread-list";
import { MobileThreads } from "@/components/chat/mobile-threads";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "AI Chat" };

export default async function ChatIndexPage() {
  const ctx = await requireWorkspace();

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Chat"
        description="Your primary control surface. The agent knows your Brand Brain and remembers durable preferences."
      />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden h-[calc(100vh-10rem)] lg:block">
          <ThreadList activeThreadId={null} />
        </aside>
        <div className="mb-3 lg:hidden">
          <MobileThreads activeThreadId={null} />
        </div>
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



