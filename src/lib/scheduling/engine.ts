import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { contentItems, contentVariants, publishingJobs } from "@/db/schema";
import { dateIsoInTz, defaultSlotFor, parseZonedDateTime } from "./time";

export type ScheduleOutcome =
  | { ok: true; scheduledAt: Date; variants: number }
  | { ok: false; reason: string; message: string };

/**
 * Variant states that may still be (re)scheduled. `published` variants are
 * deliberately excluded: they are already live and must never receive a new
 * publish job or be flipped back to `scheduled` (that would double-post).
 */
const SCHEDULABLE_VARIANT_STATUSES = ["ready_for_review", "approved", "scheduled"] as const;

/**
 * Schedule a content item: creates one publishing job per variant and flips
 * statuses to scheduled. Approval gate enforced: draft items cannot be
 * scheduled (Manual-mode safety).
 */
export async function scheduleItem(args: {
  workspaceId: string;
  itemId: string;
  dateIso: string;
  timeStr?: string; // "HH:mm" — defaults to 18:30 in the workspace timezone
  timezone: string;
}): Promise<ScheduleOutcome> {
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(args.dateIso);
  const timeStr = args.timeStr && /^\d{2}:\d{2}$/.test(args.timeStr) ? args.timeStr : "18:30";
  if (!dateOk) return { ok: false, reason: "invalid_date", message: "Date must be YYYY-MM-DD." };

  // Past-date guard (calendar-day only, in the timezone that interprets the
  // date): when a model resolves a year-less user date ("5 sep") against the
  // wrong year, the item lands in the past — invisible on the calendar's
  // default month view, and its publish job goes due immediately on the next
  // scan. Same-day bookings at an earlier wall-clock time stay allowed so
  // "schedule today evening" keeps working.
  if (args.dateIso < dateIsoInTz(args.timezone)) {
    return {
      ok: false,
      reason: "past_date",
      message: "Can't schedule in the past — use today or a future date.",
    };
  }

  const db = getDb();
  const [item] = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.id, args.itemId), eq(contentItems.workspaceId, args.workspaceId)));
  if (!item) return { ok: false, reason: "not_found", message: "Content item not found." };
  if (!["ready_for_review", "approved", "scheduled"].includes(item.status)) {
    return {
      ok: false,
      reason: "not_reviewable",
      message: "Content must be in Ready for Review or Approved before scheduling (review it first).",
    };
  }

  const [y, mo, d] = args.dateIso.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const scheduledAt = args.timeStr ? parseZonedDateTime(args.dateIso, timeStr, args.timezone) : defaultSlotFor(args.dateIso, args.timezone);
  void h; void mi; void y; void mo; void d;

  const variants = await db
    .select({ id: contentVariants.id, platform: contentVariants.platform, status: contentVariants.status })
    .from(contentVariants)
    .where(and(eq(contentVariants.contentItemId, item.id), eq(contentVariants.workspaceId, args.workspaceId)));
  if (variants.length === 0) {
    return { ok: false, reason: "no_variants", message: "This item has no platform variants to schedule." };
  }

  // Never re-queue variants that are already published (partial-publish
  // reschedule) and never flip them back to `scheduled`.
  const schedulable = variants.filter((v) =>
    (SCHEDULABLE_VARIANT_STATUSES as readonly string[]).includes(v.status),
  );
  if (schedulable.length === 0) {
    return {
      ok: false,
      reason: "already_published",
      message: "All variants of this item are already published — nothing to schedule.",
    };
  }

  for (const v of schedulable) {
    await db
      .delete(publishingJobs)
      .where(and(eq(publishingJobs.contentVariantId, v.id), eq(publishingJobs.status, "pending")));
    await db.insert(publishingJobs).values({
      workspaceId: args.workspaceId,
      contentItemId: item.id,
      contentVariantId: v.id,
      platform: v.platform,
      scheduledAt,
      status: "pending",
    });
    await db
      .update(contentVariants)
      .set({ status: "scheduled", updatedAt: new Date() })
      .where(eq(contentVariants.id, v.id));
  }

  await db
    .update(contentItems)
    .set({ status: "scheduled", scheduledAt, updatedAt: new Date() })
    .where(eq(contentItems.id, item.id));

  return { ok: true, scheduledAt, variants: schedulable.length };
}
