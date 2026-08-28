import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { Plug } from "lucide-react";
import { getDb } from "@/db";
import { platformConnections } from "@/db/schema";
import { metaConfigured } from "@/lib/meta/oauth";
import { requireWorkspace } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { ConnectionsClient } from "@/components/connections/connections-client";

export const metadata = { title: "Connections" };

export default async function ConnectionsPage() {
  const ctx = await requireWorkspace();
  const db = getDb();

  const connections = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.workspaceId, ctx.workspace.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections"
        description="Official Meta integrations. Tokens are encrypted at rest and never exposed to the browser."
      />
      <Suspense>
        <ConnectionsClient
          connections={connections.map((c) => ({
            platform: c.platform,
            status: c.status,
            meta: (c.meta ?? {}) as Record<string, string>,
          }))}
          configured={metaConfigured()}
          canManage={can(ctx.role, "workspace:manage")}
        />
      </Suspense>
      <div className="flex items-start gap-3 rounded-lg border p-4 text-xs text-muted-foreground">
        <Plug className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium text-foreground">Requirements for connecting</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>META_APP_ID and META_APP_SECRET set in .env.local (Meta app from developers.facebook.com)</li>
            <li>Facebook Page + Instagram Professional account linked to that page</li>
            <li>Until Meta App Review is approved, only accounts with a role in the Meta app can connect</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

