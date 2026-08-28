import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { contentItems, publishingJobs } from "@/db/schema";
import { requireWorkspace } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { CalendarClient } from "@/components/calendar/calendar-client";

export const metadata = { title: "Content Calendar" };

export default async function CalendarPage() {
  const ctx = await requireWorkspace();
  const db = getDb();

  const items = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.workspaceId, ctx.workspace.id)))
    .orderBy(desc(contentItems.createdAt))
    .limit(120);


  // Publishing jobs in a window around today for failure visibility
  const itemIds = items.map((i) => i.id);
  const now = new Date();
  const windowStart = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 31);
  const windowEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 62);
  const pJobs = itemIds.length
    ? await db
        .select()
        .from(publishingJobs)
        .where(
          and(
            eq(publishingJobs.workspaceId, ctx.workspace.id),
            inArray(publishingJobs.contentItemId, itemIds),
            gte(publishingJobs.scheduledAt, windowStart),
            lte(publishingJobs.scheduledAt, windowEnd),
          ),
        )
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Calendar"
        description="Drag content onto a day to schedule it (default slot 18:30 in your workspace timezone). Publishing runs through official integrations from M4 — failed publishes show honestly."
      />
      <CalendarClient
        items={items}
        pJobs={pJobs}
        timezone={ctx.workspace.timezone}
        editable={can(ctx.role, "brand:write")}
      />
    </div>
  );
}
