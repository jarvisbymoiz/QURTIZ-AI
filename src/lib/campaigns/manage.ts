import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaigns,
  campaignItems,
  contentItems,
  jobs,
  publishingJobs,
  postMetrics,
} from "@/db/schema";
import { sumTotals, type MetricsRow } from "@/lib/analytics/compute";
import { campaignDeliveryStatus } from "./status";

export async function campaignReport(workspaceId: string, campaignId: string) {
  const db = getDb();
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(
      and(eq(campaigns.id, campaignId), eq(campaigns.workspaceId, workspaceId)),
    );
  if (!campaign) throw new Error("Campaign not found.");
  const items = await db
    .select()
    .from(campaignItems)
    .where(
      and(
        eq(campaignItems.campaignId, campaignId),
        eq(campaignItems.workspaceId, workspaceId),
      ),
    );
  const ids = items.flatMap((i) => (i.contentItemId ? [i.contentItemId] : []));
  const deliveries = ids.length
    ? await db
        .select()
        .from(publishingJobs)
        .where(
          and(
            eq(publishingJobs.workspaceId, workspaceId),
            inArray(publishingJobs.contentItemId, ids),
          ),
        )
    : [];
  const metrics = ids.length
    ? await db
        .select()
        .from(postMetrics)
        .where(
          and(
            eq(postMetrics.workspaceId, workspaceId),
            inArray(postMetrics.contentItemId, ids),
          ),
        )
    : [];
  const status = campaignDeliveryStatus(
    campaign.status,
    campaign.platforms,
    items,
    deliveries,
  );
  if (status !== campaign.status)
    await db
      .update(campaigns)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.workspaceId, workspaceId),
          eq(campaigns.status, campaign.status),
        ),
      );
  return {
    status,
    linked: ids.length,
    published: deliveries.filter(
      (j) =>
        j.status === "published" && campaign.platforms.includes(j.platform),
    ).length,
    failed: deliveries.filter((j) => j.status === "failed").length,
    scheduled: deliveries.filter((j) => j.status === "pending").length,
    totals: sumTotals(metrics as MetricsRow[]),
  };
}

export async function manageCampaign(
  workspaceId: string,
  campaignId: string,
  operation:
    | { type: "edit"; name: string; goal: string; cta: string }
    | { type: "delete" }
    | { type: "retry" }
    | { type: "link"; dayId: string; itemId: string | null },
) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [campaign] = await tx
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.workspaceId, workspaceId),
        ),
      )
      .for("update");
    if (!campaign) throw new Error("Campaign not found.");
    if (campaign.status === "generating")
      throw new Error(
        "Cancel generation before editing or deleting this campaign.",
      );
    if (operation.type === "retry") {
      if (!campaign.jobId) throw new Error("This campaign has no generation job.");
      const [job] = await tx.select().from(jobs).where(and(eq(jobs.id, campaign.jobId), eq(jobs.workspaceId, workspaceId))).for("update");
      if (!job || job.status !== "failed") throw new Error("Only failed generation jobs can be retried.");
      await tx.update(jobs).set({ status: "queued", error: null, result: {}, updatedAt: new Date() }).where(eq(jobs.id, job.id));
      await tx.update(campaigns).set({ status: "generating", updatedAt: new Date() }).where(eq(campaigns.id, campaignId));
    }
    if (operation.type === "edit")
      await tx
        .update(campaigns)
        .set({
          name: operation.name,
          goal: operation.goal || null,
          cta: operation.cta || null,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));
    if (operation.type === "delete") {
      if (campaign.jobId)
        await tx
          .update(jobs)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(
            and(
              eq(jobs.id, campaign.jobId),
              eq(jobs.workspaceId, workspaceId),
              eq(jobs.status, "queued"),
            ),
          );
      // Delete the campaign association only; never destroy customer content or
      // cancel independent Calendar/publishing jobs as a side effect.
      await tx.delete(campaigns).where(eq(campaigns.id, campaignId));
    }
    if (operation.type === "link") {
      const [day] = await tx
        .select()
        .from(campaignItems)
        .where(
          and(
            eq(campaignItems.id, operation.dayId),
            eq(campaignItems.campaignId, campaignId),
            eq(campaignItems.workspaceId, workspaceId),
          ),
        );
      if (!day) throw new Error("Campaign day not found.");
      if (operation.itemId) {
        const [post] = await tx
          .select()
          .from(contentItems)
          .where(
            and(
              eq(contentItems.id, operation.itemId),
              eq(contentItems.workspaceId, workspaceId),
              isNull(contentItems.deletedAt),
            ),
          );
        if (!post) throw new Error("Content item not found.");
        const linked = await tx
          .select()
          .from(campaignItems)
          .where(
            and(
              eq(campaignItems.campaignId, campaignId),
              eq(campaignItems.contentItemId, operation.itemId),
            ),
          );
        if (linked.some((i) => i.id !== day.id))
          throw new Error(
            "This post is already linked to another campaign day.",
          );
      }
      await tx
        .update(campaignItems)
        .set({ contentItemId: operation.itemId })
        .where(eq(campaignItems.id, day.id));
    }
  });
}
