import { withSchemaGuard } from "@/components/system/schema-guard";
﻿import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { competitorSnapshots, competitors, platformConnections } from "@/db/schema";
import { getWorkspacePublishProvider } from "@/lib/publish/provider";
import { requireWorkspace } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { CompetitorsClient } from "@/components/competitors/competitors-client";

export const metadata = { title: "Competitors" };

async function CompetitorsPage() {
  const ctx = await requireWorkspace();
  const db = getDb();

  const list = await db
    .select()
    .from(competitors)
    .where(eq(competitors.workspaceId, ctx.workspace.id))
    .orderBy(desc(competitors.createdAt));

  const ids = list.map((c) => c.id);
  const snapshots = ids.length
    ? await db.select().from(competitorSnapshots).where(eq(competitorSnapshots.workspaceId, ctx.workspace.id))
    : [];

  // Snapshot data comes from Meta (IG Business Discovery), so the page needs
  // the same data-path honesty as analytics: when publishing is routed to
  // Buffer with no Meta connection, tell the user instead of implying Buffer
  // can power competitor research.
  const connections = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.workspaceId, ctx.workspace.id));
  const publishingProvider = await getWorkspacePublishProvider(ctx.workspace.id);
  const hasMetaConnection = connections.some((c) => c.provider === "meta" && c.status === "connected");
  const hasBufferConnection = connections.some((c) => c.provider === "buffer" && c.status === "connected");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Competitors"
        description="Official IG Business Discovery only — no scraping. Targets must be public Business/Creator accounts. Facebook public-page data requires an extra Meta review, so it is not attempted."
      />
      <CompetitorsClient
        competitors={list}
        snapshots={snapshots}
        editable={can(ctx.role, "brand:write")}
        publishingProvider={publishingProvider}
        hasMetaConnection={hasMetaConnection}
        hasBufferConnection={hasBufferConnection}
      />
    </div>
  );
}

export default withSchemaGuard("(app)/competitors/page.tsx", CompetitorsPage);
