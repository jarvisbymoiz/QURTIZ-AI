import { withSchemaGuard } from "@/components/system/schema-guard";
﻿import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { campaignItems, campaigns, contentItems, jobs } from "@/db/schema";
import { hasWorkspaceAIConfig } from "@/lib/ai/config";
import { requireWorkspace } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignsClient } from "@/components/campaigns/campaigns-client";
import { campaignReport } from "@/lib/campaigns/manage";

export const metadata = { title: "Campaigns" };
export const maxDuration = 300;

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
  const content = await db.select({ id: contentItems.id, topic: contentItems.topic, status: contentItems.status }).from(contentItems).where(and(eq(contentItems.workspaceId,ctx.workspace.id),isNull(contentItems.deletedAt))).orderBy(desc(contentItems.createdAt));
  const reports=await Promise.all(list.map(c=>campaignReport(ctx.workspace.id,c.id)));
  const jobIds = list.map((c) => c.jobId).filter((x): x is string => Boolean(x));
  const jobRows = jobIds.length ? await db.select().from(jobs).where(inArray(jobs.id, jobIds)) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Day-by-day campaign arcs: announcement → problem → benefits → demonstration → social proof → urgency → final reminder. Content is generated per day in the background."
      />
      <CampaignsClient
        campaigns={list.map((c,i)=>({...c,status:reports[i].status}))}
        reports={Object.fromEntries(list.map((c,i)=>[c.id,reports[i]]))}
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
