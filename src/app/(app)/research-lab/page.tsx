import { withSchemaGuard } from "@/components/system/schema-guard";
﻿import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { aiInsights, researchItems } from "@/db/schema";
import { hasWorkspaceAIConfig } from "@/lib/ai/config";
import { requireWorkspace } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { ResearchClient } from "@/components/research/research-client";

export const metadata = { title: "Research Lab" };

async function ResearchLabPage() {
  const ctx = await requireWorkspace();
  const db = getDb();

  const items = await db
    .select()
    .from(researchItems)
    .where(eq(researchItems.workspaceId, ctx.workspace.id))
    .orderBy(desc(researchItems.createdAt))
    .limit(60);

  const [growthPlan] = await db
    .select()
    .from(aiInsights)
    .where(and(eq(aiInsights.workspaceId, ctx.workspace.id), eq(aiInsights.kind, "growth_plan")))
    .orderBy(desc(aiInsights.createdAt))
    .limit(1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Research Lab"
        description="Find content opportunities for your niche. Scores are AI-estimated and clearly labeled — sources are shown when live web data is available."
      />
      <ResearchClient
        items={items}
        aiConfigured={await hasWorkspaceAIConfig(ctx.workspace.id)}
        editable={can(ctx.role, "brand:write")}
        growthPlan={growthPlan?.content ?? null}
      />
    </div>
  );
}

export default withSchemaGuard("(app)/research-lab/page.tsx", ResearchLabPage);
