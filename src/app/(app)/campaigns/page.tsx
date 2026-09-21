import { withSchemaGuard } from "@/components/system/schema-guard";
﻿import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { campaignItems, campaigns, contentItems, jobs } from "@/db/schema";
import { hasWorkspaceAIConfig } from "@/lib/ai/config";
import { requireWorkspace } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignsClient } from "@/components/campaigns/campaigns-client";

export const metadata = { title: "Campaigns" };

async function CampaignsPage() {
  const ctx = await requireWorkspace();
  const db = getDb();

  const list = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.workspaceId, ctx.workspace.id))
    .orderBy(desc(campaigns.createdAt))
    .limit(30);

  const campaignIds = list.map((c) => c.id);
  const items = campaignIds.length
    ? await db.select().from(campaignItems).where(inArray(campaignItems.campaignId, campaignIds))
    : [];
  const contentIds = items.map((i) => i.contentItemId).filter((x): x is string => Boolean(x));
  const content = contentIds.length
    ? await db.select({ id: contentItems.id, topic: contentItems.topic, status: contentItems.status }).from(contentItems).where(inArray(contentItems.id, contentIds))
    : [];
  const jobIds = list.map((c) => c.jobId).filter((x): x is string => Boolean(x));
  const jobRows = jobIds.length ? await db.select().from(jobs).where(inArray(jobs.id, jobIds)) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Day-by-day campaign arcs: announcement → problem → benefits → demonstration → social proof → urgency → final reminder. Content is generated per day in the background."
      />
      <CampaignsClient
        campaigns={list}
        items={items}
        content={content}
        jobs={jobRows.map((j) => ({ id: j.id, status: j.status, progress: j.progress, total: j.total, error: j.error }))}
        aiConfigured={await hasWorkspaceAIConfig(ctx.workspace.id)}
        editable={can(ctx.role, "brand:write")}
      />
    </div>
  );
}

export default withSchemaGuard("(app)/campaigns/page.tsx", CampaignsPage);
