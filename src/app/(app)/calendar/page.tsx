import { and, desc, eq, gte, inArray, isNotNull, lte, or } from "drizzle-orm";
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

  // Exactly what the client renders: grid day cells (any item carrying a
  // scheduledAt) plus the drag-to-schedule queue (approved items without
  // one). No "latest N by createdAt" cap here — an AI-scheduled post that is
  // old by creation date but still upcoming must reach its day cell, or it
  // shows as scheduled in Chat/Studio while never appearing on the calendar.
  // The 1000 cap is only a runaway-data safety valve, not a feature limit.
  const items = await db
    .select()
    .from(contentItems)
    .where(
      and(
        eq(contentItems.workspaceId, ctx.workspace.id),
        or(eq(contentItems.status, "approved"), isNotNull(contentItems.scheduledAt)),
      ),
    )
    .orderBy(desc(contentItems.createdAt))
    .limit(1000);


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
        description="Drag an approved post onto a day and pick its publish time (workspace timezone). Publishing runs through your connected Meta accounts — failed publishes show honestly."
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
