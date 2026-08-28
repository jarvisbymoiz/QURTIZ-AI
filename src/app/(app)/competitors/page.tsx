import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { competitorSnapshots, competitors } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { CompetitorsClient } from "@/components/competitors/competitors-client";

export const metadata = { title: "Competitors" };

export default async function CompetitorsPage() {
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
      />
    </div>
  );
}
