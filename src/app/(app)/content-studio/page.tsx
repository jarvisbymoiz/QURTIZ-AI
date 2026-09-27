import { withSchemaGuard } from "@/components/system/schema-guard";
import { effectiveContent } from "@/lib/content/edit";
﻿import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { contentItems, contentPillars, contentVariants, imageModePreferences, visualAssets } from "@/db/schema";
import { listAssetSignedUrls } from "@/server/actions/visuals";
import { hasWorkspaceAIConfig } from "@/lib/ai/config";
import { requireWorkspace } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { StudioClient } from "@/components/studio/studio-client";

export const metadata = { title: "Content Studio" };

async function ContentStudioPage() {
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
  const display = items.map(item => effectiveContent(item, variants.filter(variant => variant.contentItemId === item.id)));
  const [localMode] = await db.select({ mode: imageModePreferences.mode }).from(imageModePreferences)
    .where(and(eq(imageModePreferences.workspaceId, ctx.workspace.id), eq(imageModePreferences.userId, ctx.user.id))).limit(1);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Studio"
        description="Generate, review, and manage posts. Every post is AI-estimated and QA-checked before review — nothing publishes from here."
      />
      <StudioClient
        workspaceId={ctx.workspace.id}
        items={display.map(record => record.item)}
        variants={display.flatMap(record => record.variants)}
        pillars={pillars}
        visuals={visuals}
        visualUrls={visualUrls}
        aiConfigured={localMode?.mode === "local_companion" || await hasWorkspaceAIConfig(ctx.workspace.id)}
        editable={can(ctx.role, "brand:write")}
        timezone={ctx.workspace.timezone}
      />
    </div>
  );
}

export default withSchemaGuard("(app)/content-studio/page.tsx", ContentStudioPage);
