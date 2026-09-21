import { withSchemaGuard } from "@/components/system/schema-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { requireWorkspace } from "@/lib/workspace";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";

async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  const db = getDb();
  let unreadCount = 0;
  try {
    const latestNotifications = await db
      .select({ read: notifications.read })
      .from(notifications)
      .where(eq(notifications.workspaceId, ctx.workspace.id))
      .orderBy(desc(notifications.createdAt))
      .limit(8);
    unreadCount = latestNotifications.filter((n) => !n.read).length;
  } catch (err) {
    console.warn("[AppLayout] Could not load notifications:", err);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      <Sidebar
        workspaces={ctx.allWorkspaces.map((w) => ({ id: w.id, name: w.name }))}
        activeWorkspaceId={ctx.workspace.id}
        activeWorkspaceName={ctx.workspace.name}
        userEmail={ctx.user.email}
        role={ctx.role}
        unreadCount={unreadCount}
      />
      <main id="main-content" className="min-h-0 min-w-0 flex-1 overflow-y-auto scrollbar-hide">
        <div className="mx-auto max-w-6xl p-3 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

export default withSchemaGuard("(app)/layout.tsx", AppLayout);
