import { Sidebar } from "@/components/layout/sidebar";
import { requireWorkspace } from "@/lib/workspace";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        workspaces={ctx.allWorkspaces.map((w) => ({ id: w.id, name: w.name }))}
        activeWorkspaceId={ctx.workspace.id}
        activeWorkspaceName={ctx.workspace.name}
        userEmail={ctx.user.email}
        role={ctx.role}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
