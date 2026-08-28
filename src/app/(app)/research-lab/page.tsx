import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { researchItems } from "@/db/schema";
import { isAiConfigured } from "@/lib/ai/provider";
import { requireWorkspace } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { ResearchClient } from "@/components/research/research-client";

export const metadata = { title: "Research Lab" };

export default async function ResearchLabPage() {
  const ctx = await requireWorkspace();
  const db = getDb();

  const items = await db
    .select()
    .from(researchItems)
    .where(eq(researchItems.workspaceId, ctx.workspace.id))
    .orderBy(desc(researchItems.createdAt))
    .limit(60);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Research Lab"
        description="Find content opportunities for your niche. Scores are AI-estimated and clearly labeled — sources are shown when live web data is available."
      />
      <ResearchClient
        items={items}
        aiConfigured={isAiConfigured()}
        editable={can(ctx.role, "brand:write")}
      />
    </div>
  );
}
