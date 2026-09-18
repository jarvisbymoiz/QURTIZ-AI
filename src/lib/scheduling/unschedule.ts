import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { contentItems, contentVariants, publishingJobs, workspaceMembers, workspaces } from "@/db/schema";
import { can } from "@/lib/permissions";
export async function unscheduleContent(actor: { workspaceId: string; userId: string }, itemId: string) {
  return getDb().transaction(async tx => {
    const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers).innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id)).where(and(eq(workspaceMembers.workspaceId, actor.workspaceId), eq(workspaceMembers.userId, actor.userId), isNull(workspaces.deletedAt)));
    if (!member || !can(member.role, "brand:write")) throw Error("Permission to unschedule denied.");
    const [item] = await tx.select().from(contentItems).where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, actor.workspaceId), isNull(contentItems.deletedAt))).for("update");
    if (!item) throw Error("Content not found.");
    const delivery = await tx.select().from(publishingJobs).where(and(eq(publishingJobs.contentItemId, itemId), eq(publishingJobs.workspaceId, actor.workspaceId)));
    if (delivery.some(job => (job.result as Record<string, unknown> | null)?.reconciliationRequired)) throw Error("Publishing delivery is unconfirmed. Verify its result before unscheduling.");
    if (delivery.some(job => job.status === "processing")) throw Error("Publishing is in progress; wait before unscheduling.");
    const variants = await tx.select().from(contentVariants).where(and(eq(contentVariants.contentItemId, itemId), eq(contentVariants.workspaceId, actor.workspaceId), inArray(contentVariants.status, ["approved", "scheduled"])));
    const ids = variants.filter(variant => !delivery.some(job => job.contentVariantId === variant.id && !!job.providerPostId)).map(variant => variant.id);
    if (ids.length) {
      await tx.update(publishingJobs).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(publishingJobs.contentItemId, itemId), eq(publishingJobs.workspaceId, actor.workspaceId), inArray(publishingJobs.contentVariantId, ids), eq(publishingJobs.status, "pending")));
      await tx.update(contentVariants).set({ status: "approved", updatedAt: new Date() }).where(and(eq(contentVariants.workspaceId, actor.workspaceId), inArray(contentVariants.id, ids)));
      await tx.update(contentItems).set({ scheduledAt: null, status: item.status === "scheduled" ? "approved" : item.status, updatedAt: new Date() }).where(eq(contentItems.id, itemId));
    }
    return { ok: true, updated: true, itemId, unscheduledVariants: ids.length, message: "Pending deliveries cancelled; published variants and delivery history preserved." };
  });
}
