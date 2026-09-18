import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { brands, contentItems, contentVariants, publishingJobs } from "@/db/schema";
import { runContentQa } from "./qa";
import type { ContentRulesInput } from "@/lib/validation";

export type ReviewStatus = "draft" | "ready_for_review" | "approved" | "rejected" | "archived";

/** One atomic lifecycle for Studio and agent actions. */
export async function transitionItem(workspaceId: string, itemId: string, status: ReviewStatus, reason?: string | null): Promise<void> {
  if (!["draft", "ready_for_review", "approved", "rejected", "archived"].includes(status)) throw new Error("Invalid content status.");
  await getDb().transaction(async tx => {
    const [item] = await tx.select().from(contentItems).where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, workspaceId))).for("update");
    if (!item) throw new Error("Content item not found.");
    const processing = await tx.select({ id: publishingJobs.id }).from(publishingJobs).where(and(eq(publishingJobs.contentItemId, itemId), eq(publishingJobs.status, "processing")));
    if (processing.length) throw new Error("Publishing is in progress. Wait for its result before changing this post.");
    if (item.status === "published" && status !== "archived") throw new Error("Published content cannot return to review.");
    const variants = await tx.select().from(contentVariants).where(and(eq(contentVariants.contentItemId, itemId), eq(contentVariants.workspaceId, workspaceId)));
    if (status === "approved") {
      if (!["ready_for_review", "rejected", "approved"].includes(item.status)) throw new Error("Move this post to review before approving it.");
      if (!variants.length) throw new Error("This post has no platform variants.");
      const [brand] = await tx.select().from(brands).where(eq(brands.workspaceId, workspaceId));
      for (const variant of variants.filter(v => v.status !== "published")) {
        const qa = runContentQa({ caption: variant.caption, hashtags: variant.hashtags, cta: variant.cta, platform: variant.platform,
          rules: (brand?.contentRules ?? {}) as Partial<ContentRulesInput> });
        if (!qa.passed) throw new Error(`${variant.platform} needs corrections: ${qa.issues.filter(i => i.severity === "error").map(i => i.message).join("; ")}`);
        await tx.update(contentVariants).set({ qa }).where(eq(contentVariants.id, variant.id));
      }
    }
    if (status !== "approved") await tx.delete(publishingJobs).where(and(eq(publishingJobs.contentItemId, itemId), eq(publishingJobs.workspaceId, workspaceId), eq(publishingJobs.status, "pending")));
    await tx.update(contentItems).set({ status, scheduledAt: null, updatedAt: new Date(),
      ...(status === "rejected" ? { qa: { ...item.qa as Record<string, unknown>, rejectionReason: reason ?? null } } : {}) })
      .where(eq(contentItems.id, itemId));
    await tx.update(contentVariants).set({ status: status === "approved" ? "approved" : status === "archived" ? "archived" : "ready_for_review", updatedAt: new Date() })
      .where(and(eq(contentVariants.contentItemId, itemId), eq(contentVariants.workspaceId, workspaceId), ne(contentVariants.status, "published")));
  });
}
export async function approveItem(workspaceId: string, itemId: string) { await transitionItem(workspaceId, itemId, "approved"); }
export async function rejectItem(workspaceId: string, itemId: string, reason: string | null) { await transitionItem(workspaceId, itemId, "rejected", reason); }
export async function archiveItem(workspaceId: string, itemId: string) { await transitionItem(workspaceId, itemId, "archived"); }
export async function getItem(workspaceId: string, itemId: string) {
  const [item] = await getDb().select().from(contentItems).where(and(eq(contentItems.id, itemId), eq(contentItems.workspaceId, workspaceId)));
  return item ?? null;
}