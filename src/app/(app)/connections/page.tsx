import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { Plug } from "lucide-react";
import { getDb } from "@/db";
import { platformConnections } from "@/db/schema";
import { bufferConfigured } from "@/lib/buffer/client";
import { metaConfigured } from "@/lib/meta/oauth";
import { getWorkspacePublishProvider, isPublishProvider } from "@/lib/publish/provider";
import { requireWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/layout/page-header";
import { ConnectionsClient } from "@/components/connections/connections-client";

export const metadata = { title: "Connections" };

const META_REQUIREMENTS = [
  "META_APP_ID and META_APP_SECRET set in .env.local (Meta app from developers.facebook.com)",
  "Facebook Page + Instagram Professional account linked to that page",
  "Until Meta App Review is approved, only accounts with a role in the Meta app can connect",
];

const BUFFER_REQUIREMENTS = [
  "BUFFER_CLIENT_ID and BUFFER_CLIENT_SECRET set in .env.local (Buffer developer app from buffer.com/developers)",
  "A Buffer account with the Facebook Page and Instagram channels you want to publish to",
  "Buffer owns channel auth — after authorizing here, link pages/channels inside Buffer and reconnect so they appear below",
];

export default async function ConnectionsPage() {
  const ctx = await requireWorkspace();
  const db = getDb();

  const [connections, publishingProvider] = await Promise.all([
    db.select().from(platformConnections).where(eq(platformConnections.workspaceId, ctx.workspace.id)),
    getWorkspacePublishProvider(ctx.workspace.id),
  ]);

  const requirements = publishingProvider === "buffer" ? BUFFER_REQUIREMENTS : META_REQUIREMENTS;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections"
        description="Official Meta and Buffer integrations. Tokens are encrypted at rest and never exposed to the browser."
      />
      <Suspense>
        <ConnectionsClient
          connections={connections.map((c) => ({
            platform: c.platform,
            provider: isPublishProvider(c.provider) ? c.provider : "meta",
            status: c.status,
            channelRef: c.channelRef,
            meta: (c.meta ?? {}) as Record<string, string>,
          }))}
          publishingProvider={publishingProvider}
          metaConfigured={metaConfigured()}
          bufferConfigured={bufferConfigured()}
        />
      </Suspense>
      <div className="flex items-start gap-3 rounded-lg border p-4 text-xs text-muted-foreground">
        <Plug className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium text-foreground">Requirements for connecting</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {requirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
