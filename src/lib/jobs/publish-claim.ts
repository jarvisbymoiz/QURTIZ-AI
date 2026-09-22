import "server-only";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { contentItems, publishingJobs } from "@/db/schema";

/** Use the same item lock as Publish Now, reschedule and unschedule. A pending
 * row's conditional UPDATE alone does not serialize those other writers. */
export async function claimScheduledPublishJob(id: string) {
  return getDb().transaction(async tx => {
    const [candidate] = await tx.select().from(publishingJobs).where(eq(publishingJobs.id, id));
    if (!candidate) return undefined;
    const [item] = await tx.select({ id: contentItems.id }).from(contentItems)
      .where(and(eq(contentItems.id, candidate.contentItemId), eq(contentItems.workspaceId, candidate.workspaceId))).for("update");
    if (!item) return undefined;
    const [claimed] = await tx.update(publishingJobs).set({
      status: "processing", attempts: sql`${publishingJobs.attempts} + 1`, updatedAt: new Date(),
    }).where(and(eq(publishingJobs.id, id), eq(publishingJobs.status, "pending"),
      isNull(publishingJobs.providerPostId), lte(publishingJobs.scheduledAt, new Date())))
      .returning();
    return claimed;
  });
}
