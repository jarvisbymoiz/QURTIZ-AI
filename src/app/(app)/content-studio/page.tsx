import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { contentItems, contentPillars, contentVariants, visualAssets } from "@/db/schema";
import { listAssetSignedUrls } from "@/server/actions/visuals";
import { isAiConfigured } from "@/lib/ai/provider";
import { requireWorkspace } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { StudioClient } from "@/components/studio/studio-client";

export const metadata = { title: "Content Studio" };

export default async function ContentStudioPage() {
  const ctx = await requireWorkspace();
  const db = getDb();

  const items = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.workspaceId, ctx.workspace.id))
    .orderBy(desc(contentItems.createdAt))
    .limit(50);

  const itemIds = items.map((i) => i.id);
  const variants = itemIds.length
    ? await db
        .select()
        .from(contentVariants)
        .where(inArray(contentVariants.contentItemId, itemIds))
    : [];

  const pillars = await db
    .select()
    .from(contentPillars)
    .where(eq(contentPillars.workspaceId, ctx.workspace.id));

  const visuals = itemIds.length
    ? await db
        .select()
        .from(visualAssets)
        .where(inArray(visualAssets.contentItemId, itemIds))
    : [];
  const visualUrls = visuals.length
    ? await listAssetSignedUrls(visuals.map((v) => v.storagePath))
    : {};
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Studio"
        description="Generate, review, and manage posts. Every post is AI-estimated and QA-checked before review — nothing publishes from here."
      />
      <StudioClient
        items={items}
        variants={variants}
        pillars={pillars}
        visuals={visuals}
        visualUrls={visualUrls}
        aiConfigured={isAiConfigured()}
        editable={can(ctx.role, "brand:write")}
      />
    </div>
  );
}
