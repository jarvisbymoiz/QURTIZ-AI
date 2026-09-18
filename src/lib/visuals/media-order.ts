import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { contentItems, contentVariants, publishingJobs, visualAssets, workspaceMembers, workspaces } from "@/db/schema";
import { can } from "@/lib/permissions";

/** Existing upload order service, shared by Studio and authenticated Agent. */
export async function reorderVisualUploads(ctx: { workspaceId: string; userId: string }, itemId: string, orderedIds: string[], mediaType?: "image/" | "video/"): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!itemId || !Array.isArray(orderedIds) || orderedIds.length === 0 || orderedIds.length > 10) return { ok: false, error: "Invalid media order." };
  if (mediaType !== undefined && mediaType !== "image/" && mediaType !== "video/") return { ok: false, error: "Invalid media type." };

  const db = getDb();
  const [membership] = await db.select({ role: workspaceMembers.role }).from(workspaceMembers).innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id)).where(and(eq(workspaceMembers.workspaceId, ctx.workspaceId), eq(workspaceMembers.userId, ctx.userId), isNull(workspaces.deletedAt)));
  if (!membership || !can(membership.role, "brand:write")) return { ok: false, error: "Permission to change media denied." };
  try { await db.transaction(async tx => {
  const [item] = await tx.select({ status: contentItems.status }).from(contentItems)
    .where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, ctx.workspaceId), isNull(contentItems.deletedAt))).for("update");
  if (!item || !["draft", "ready_for_review", "failed", "rejected"].includes(item.status)) {
    throw new Error("Move this post back to review before changing its media.");
  }
  const active = await tx.select({ id: publishingJobs.id }).from(publishingJobs)
    .where(and(eq(publishingJobs.contentItemId, itemId), eq(publishingJobs.status, "processing")));
  if (active.length) throw new Error("Publishing is in progress; media cannot be changed.");
  const accepted = await tx.select({ id: publishingJobs.id }).from(publishingJobs).where(and(eq(publishingJobs.contentItemId, itemId), sql`(${publishingJobs.providerPostId} IS NOT NULL OR ${publishingJobs.result}->>'reconciliationRequired'='true')`));
  const published = await tx.select({ id: contentVariants.id }).from(contentVariants).where(and(eq(contentVariants.contentItemId, itemId), eq(contentVariants.status, "published")));
  if (accepted.length || published.length) throw new Error("Published media relationships cannot be changed.");
  const rows = await tx
    .select({ id: visualAssets.id })
    .from(visualAssets)
    .where(
      and(
        eq(visualAssets.contentItemId, itemId),
        eq(visualAssets.workspaceId, ctx.workspaceId),
        eq(visualAssets.kind, "upload"),
        ...(mediaType ? [sql`${visualAssets.mimeType} like ${mediaType + "%"}`] : []),
      ),
    );
  const known = new Set(rows.map((r) => r.id));
  if (orderedIds.length !== known.size || new Set(orderedIds).size !== orderedIds.length || orderedIds.some((id) => !known.has(id))) {
    throw new Error("The media list changed. Refresh the post before reordering.");
  }

  for (let i = 0; i < orderedIds.length; i++) {
    await tx
      .update(visualAssets)
      .set({ slideIndex: i })
      .where(eq(visualAssets.id, orderedIds[i]));
  }
  }); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not reorder media." }; }
  return { ok: true };
}
