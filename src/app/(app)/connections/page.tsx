import { withSchemaGuard } from "@/components/system/schema-guard";
import { Suspense } from "react";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { platformConnections, settings } from "@/db/schema";
import { bufferConfigured } from "@/lib/buffer/client";
import { metaConfigured } from "@/lib/meta/oauth";
import { getWorkspacePublishProvider, isPublishProvider } from "@/lib/publish/provider";
import { getServerStorageConfigStatus } from "@/lib/supabase/storage-status";
import { requireWorkspace } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { ConnectionsClient } from "@/components/connections/connections-client";
import { Badge } from "@/components/ui/badge";
import type { ClientMetaDiscovery } from "@/server/actions/connections";

export const metadata = { title: "Connections" };

async function ConnectionsPage() {
  const ctx = await requireWorkspace();
  const db = getDb();

  const [connections, publishingProvider, serverStorage, [discoveryRow]] = await Promise.all([
    db.select().from(platformConnections).where(eq(platformConnections.workspaceId, ctx.workspace.id)),
    getWorkspacePublishProvider(ctx.workspace.id),
    getServerStorageConfigStatus(),
    can(ctx.role, "workspace:manage") ? db
      .select()
      .from(settings)
      .where(and(eq(settings.workspaceId, ctx.workspace.id), eq(settings.key, "meta_discovery"))) : Promise.resolve([]),
  ]);

  let pendingDiscovery: ClientMetaDiscovery | null = null;
  if (discoveryRow?.value) {
    const raw = discoveryRow.value as {
      authorizedUser?: { id: string; name: string };
      grantedScopes?: string[];
      expiresAt?: string | null;
      createdAt?: string;
      diagnostics?: {
        totalFacebookPages: number;
        eligibleFacebookPages: number;
        totalInstagramAccounts: number;
        eligibleInstagramAccounts: number;
        warnings: string[];
      };
      pages?: Array<{
        id: string;
        name: string;
        category?: string | null;
        tasks?: string[];
        canPost?: boolean;
        unavailableReason?: string | null;
        instagramAccount?: {
          id: string;
          username: string | null;
          name: string | null;
          profilePictureUrl: string | null;
          followersCount: number | null;
          linkedPageId: string;
          linkedPageName: string;
          isEligible: boolean;
          unavailableReason: string | null;
          status: "eligible" | "ineligible_personal" | "not_linked" | "permission_missing";
        } | null;
      }>;
    };

    pendingDiscovery = {
      authorizedUser: raw.authorizedUser ?? { id: "", name: "Facebook User" },
      grantedScopes: raw.grantedScopes ?? [],
      expiresAt: raw.expiresAt ?? null,
      createdAt: raw.createdAt ?? new Date().toISOString(),
      diagnostics: raw.diagnostics ?? {
        totalFacebookPages: 0,
        eligibleFacebookPages: 0,
        totalInstagramAccounts: 0,
        eligibleInstagramAccounts: 0,
        warnings: [],
      },
      pages: (raw.pages ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category ?? null,
        tasks: p.tasks ?? [],
        canPost: Boolean(p.canPost),
        unavailableReason: p.unavailableReason ?? null,
        instagramAccount: p.instagramAccount ?? null,
      })),
    };
  }



  // Server-side storage status (visual publishing signs URLs through it).
  const storageChip = !serverStorage.configured
    ? { label: "Missing configuration", dot: "bg-amber-500" }
    : serverStorage.connected
      ? { label: "Connected", dot: "bg-emerald-500" }
      : { label: "Unreachable", dot: "bg-destructive" };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections"
        description="Official Meta and Buffer integrations. Tokens are encrypted at rest and never exposed to the browser."
      />
      <div>
        <Badge variant="secondary" className="gap-1.5">
          <span className={cn("size-1.5 shrink-0 rounded-full", storageChip.dot)} aria-hidden />
          Supabase server storage: {storageChip.label}
        </Badge>
      </div>
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
          pendingDiscovery={pendingDiscovery}
        />
      </Suspense>
    </div>
  );
}


export default withSchemaGuard("(app)/connections/page.tsx", ConnectionsPage);
