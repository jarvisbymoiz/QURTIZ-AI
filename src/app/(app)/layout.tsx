import { Sidebar } from "@/components/layout/sidebar";
import { requireWorkspace } from "@/lib/workspace";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  const db = getDb();
  const latestNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.workspaceId, ctx.workspace.id))
    .orderBy(desc(notifications.createdAt))
    .limit(8);
  const unreadCount = latestNotifications.filter((n) => !n.read).length;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        workspaces={ctx.allWorkspaces.map((w) => ({ id: w.id, name: w.name }))}
        activeWorkspaceId={ctx.workspace.id}
        activeWorkspaceName={ctx.workspace.name}
        userEmail={ctx.user.email}
        role={ctx.role}
        unreadCount={unreadCount}
      />
      <main className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="mx-auto max-w-6xl p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

