import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { brandAssets, brandMemory, brands } from "@/db/schema";
import { listAssetSignedUrls } from "@/server/actions/visuals";
import { requireWorkspace } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { BrandBrainTabs } from "@/components/brand/brand-brain-tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";

export const metadata = { title: "Brand Brain" };

export default async function BrandBrainPage() {
  const ctx = await requireWorkspace();
  const db = getDb();

  const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, ctx.workspace.id));
  const memories = await db
    .select()
    .from(brandMemory)
    .where(eq(brandMemory.workspaceId, ctx.workspace.id))
    .orderBy(desc(brandMemory.createdAt));

  const assets = await db
    .select()
    .from(brandAssets)
    .where(eq(brandAssets.workspaceId, ctx.workspace.id))
    .orderBy(desc(brandAssets.createdAt));
  const signedUrls = assets.length
    ? await listAssetSignedUrls(assets.map((a) => a.storagePath))
    : {};
  const editable = can(ctx.role, "brand:write");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand Brain"
        description="Everything the AI agent knows about this brand. It applies all of this automatically when you chat."
      />
      {!editable ? (
        <Alert>
          <Lock className="size-4" aria-hidden />
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            Your role ({ctx.role}) can view the Brand Brain but not edit it. Ask a
            workspace admin for access.
          </AlertDescription>
        </Alert>
      ) : null}
      <BrandBrainTabs brand={brand ?? null} memories={memories} assets={assets} assetUrls={signedUrls} editable={editable} />
    </div>
  );
}

