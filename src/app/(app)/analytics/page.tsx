import { withSchemaGuard } from "@/components/system/schema-guard";
﻿import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { aiInsights, contentItems, platformConnections, postMetrics } from "@/db/schema";
import { sumTotals, groupPerformance, bestPostingHours, type MetricsRow } from "@/lib/analytics/compute";
import { getWorkspacePublishProvider } from "@/lib/publish/provider";
import { requireWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/layout/page-header";
import { AnalyticsClient } from "@/components/analytics/analytics-client";

export const metadata = { title: "Analytics" };

async function AnalyticsPage() {
  const ctx = await requireWorkspace();
  const db = getDb();

  const rows = await db
    .select()
    .from(postMetrics)
    .where(eq(postMetrics.workspaceId, ctx.workspace.id))
    .orderBy(desc(postMetrics.postedAt))
    .limit(200);

  const connections = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.workspaceId, ctx.workspace.id));

  const [latestInsight] = await db
    .select()
    .from(aiInsights)
    .where(and(eq(aiInsights.workspaceId, ctx.workspace.id), eq(aiInsights.kind, "performance")))
    .orderBy(desc(aiInsights.createdAt))
    .limit(1);

  const publishingProvider = await getWorkspacePublishProvider(ctx.workspace.id);

  // Insights sync is Meta-provider only (lib/analytics/sync.ts) — Buffer
  // connections never feed analytics. `connected` therefore lists Meta-
  // connected platforms, so the sync button stays honest when publishing is
  // routed to Buffer.
  const connected = Array.from(
    new Set(
      connections
        .filter((c) => c.provider === "meta" && c.status === "connected")
        .map((c) => c.platform),
    ),
  );
  const hasMetaConnection = connections.some((c) => c.provider === "meta" && c.status === "connected");
  const hasBufferConnection = connections.some((c) => c.provider === "buffer" && c.status === "connected");

  const items = await db
    .select({ id: contentItems.id, format: contentItems.format })
    .from(contentItems)
    .where(eq(contentItems.workspaceId, ctx.workspace.id));
  const formatById = new Map(items.map((i) => [i.id, i.format]));

  const tzFmt = new Intl.DateTimeFormat("en-US", { timeZone: ctx.workspace.timezone, hour: "numeric", hour12: false });
  const metricRows: MetricsRow[] = rows.map((r) => ({
    platform: r.platform,
    contentItemId: r.contentItemId,
    metrics: (r.metrics ?? {}) as MetricsRow["metrics"],
    postedAt: r.postedAt,
    hourOfDay: r.postedAt ? Number(tzFmt.format(new Date(r.postedAt))) : null,
    format: r.contentItemId ? formatById.get(r.contentItemId) ?? null : null,
    topic: null,
  }));

  const totals = sumTotals(metricRows);
  const byPlatform = groupPerformance(metricRows, (r) => r.platform);
  const byFormat = groupPerformance(metricRows, (r) => r.format ?? "unknown");
  const hours = bestPostingHours(metricRows);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Measured performance from official platform APIs. Sections fill in as accounts are connected and insights sync."
      />
      <AnalyticsClient
        totals={totals}
        byPlatform={byPlatform}
        byFormat={byFormat}
        hours={hours}
        connected={connected}
        insight={latestInsight?.content ?? null}
        publishingProvider={publishingProvider}
        hasMetaConnection={hasMetaConnection}
        hasBufferConnection={hasBufferConnection}
      />
    </div>
  );
}


export default withSchemaGuard("(app)/analytics/page.tsx", AnalyticsPage);
