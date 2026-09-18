import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { contentItems, contentVariants } from "@/db/schema";
import { dateIsoInTz, defaultSlotFor, hmInTz, parseZonedDateTime } from "./time";
import { schedulePost } from "@/lib/publishing/service";
import type { ContentPlatform, PublishProvider } from "@/lib/publish/provider";

export type ScheduleOutcome =
  | {
      ok: true;
      scheduledAt: Date;
      variants: number;
      /** Per-variant job truth (provider snapshot + Buffer channelRef) so
       *  callers — the AI agent, toasts — can state WHERE each post went. */
      jobs: Array<{ jobId: string; platform: ContentPlatform; provider: PublishProvider; channelRef: string | null }>;
      /** Variants that could NOT be scheduled (no connection, channel
       *  invalid…). The item is still visible on the calendar via the
       *  MIN(scheduledAt) rule in schedulePost, but these platforms have no
       *  publish job — surfaced so partial scheduling is never mistaken for
       *  a blanket success. */
      failedVariants: Array<{ platform: ContentPlatform; message: string }>;
    }
  | { ok: false; reason: string; message: string };

/**
 * Variant states that may still be (re)scheduled. `published` variants are
 * deliberately excluded: they are already live and must never receive a new
 * publish job or be flipped back to `scheduled` (that would double-post).
 */
const SCHEDULABLE_VARIANT_STATUSES = ["approved", "scheduled"] as const;

/** YYYY-MM-DD key for `d + offsetDays` in the workspace timezone. Pure. */
function isoOffset(tz: string, offsetDays: number): string {
  const [y, m, d] = dateIsoInTz(tz).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
}

/**
 * Schedule a content item: creates one publishing job per variant and flips
 * statuses to scheduled. Approval gate enforced: draft items cannot be
 * scheduled (Manual-mode safety).
 *
 * Every variant is queued through the centralized publishing service
 * (`schedulePost`) so provider resolution, job insertion and the
 * published-id guard all share one code path.
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
  //
  // The error message NAMES the resolved "today" so that any timezone
  // mismatch (user's wall-clock day vs workspace timezone) is immediately
  // obvious — without it the user sees "Can't schedule in the past" with
  // no hint that their browser-day is already tomorrow but the workspace
  // is still on today, or vice versa.
  const todayInTz = dateIsoInTz(args.timezone);
  if (args.dateIso < todayInTz) {
    const tomorrowInTz = isoOffset(args.timezone, 1);
    // "Tomorrow" in the user's spoken timezone is the most likely intended
    // booking when the date is one day behind the workspace's "today" —
    // they typed "today" in their head, the model resolved it in the
    // workspace timezone which is already on the next day.
    const oneDayBehind = args.dateIso === isoOffset(args.timezone, -1);
    const hint = oneDayBehind
      ? ` Today in this workspace timezone (${args.timezone}) is already ${todayInTz}; the date you sent (${args.dateIso}) is one day behind. If you meant "today", use ${todayInTz} or the equivalent local date.`
      : "";
    return {
      ok: false,
      reason: "past_date",
      message:
        `Can't schedule on ${args.dateIso} — that date is in the past for ${args.timezone}. ` +
        `Today is ${todayInTz} and the next valid date is ${tomorrowInTz} (or any later day).` +
        hint,
    };
  }

  const db = getDb();
  const [item] = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.id, args.itemId), eq(contentItems.workspaceId, args.workspaceId)));
  if (!item) return { ok: false, reason: "not_found", message: "Content item not found." };
  if (!["approved", "scheduled"].includes(item.status)) {
    return {
      ok: false,
      reason: "not_reviewable",
      message: "Approve this content before scheduling it.",
    };
  }

  const scheduledAt = args.timeStr ? parseZonedDateTime(args.dateIso, timeStr, args.timezone) : defaultSlotFor(args.dateIso, args.timezone);
  if (!Number.isFinite(scheduledAt.getTime())) {
    return { ok: false, reason: "invalid_date", message: `Choose a valid future date and time (could not interpret ${args.dateIso} ${timeStr} ${args.timezone}).` };
  }
  if (scheduledAt.getTime() <= Date.now()) {
    // Show the current wall-clock time in the workspace timezone so the
    // user can pick a slot that's actually in the future without having
    // to do timezone arithmetic in their head.
    const nowInTz = hmInTz(args.timezone);
    const tomorrowInTz = isoOffset(args.timezone, 1);
    const hint = args.dateIso === todayInTz
      ? ` Current time in ${args.timezone} is ${nowInTz}; pick a time later today, or use tomorrow (${tomorrowInTz}).`
      : ` Current time in ${args.timezone} is ${nowInTz} on ${todayInTz}; pick a slot after that.`;
    return {
      ok: false,
      reason: "past_date",
      message:
        `Can't schedule for ${args.dateIso} ${timeStr} (${args.timezone}) — that slot has already passed.` +
        hint,
    };
  }

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

  // Each variant goes through the centralized publishing service — it
  // resolves the per-platform provider, inserts the publishing_jobs row,
  // flips variant status to scheduled, and keeps the item's scheduledAt on
  // the MIN over still-pending jobs (so a partially scheduled item stays
  // visible on the calendar grid). providerPostId/idempotency is owned there.
  let scheduled = 0;
  const jobs: Array<{ jobId: string; platform: ContentPlatform; provider: PublishProvider; channelRef: string | null }> = [];
  const failedVariants: Array<{ platform: ContentPlatform; message: string }> = [];
  for (const v of schedulable) {
    const res = await schedulePost({
      workspaceId: args.workspaceId,
      contentItemId: item.id,
      contentVariantId: v.id,
      platform: v.platform,
      scheduledAt,
    });
    if (res.ok) {
      scheduled++;
      jobs.push({ jobId: res.jobId, platform: v.platform, provider: res.provider, channelRef: res.channelRef });
    } else {
      // Surface the service's failure verbatim (e.g. the exact "No connected
      // … account. Connect one on the Connections page." message) instead of
      // a generic aggregate that hides the real reason.
      failedVariants.push({ platform: v.platform, message: res.message });
    }
  }
  if (scheduled === 0) {
    return {
      ok: false,
      reason: "no_variants",
      message: failedVariants[0]?.message ?? "No variants could be scheduled — check that platforms are connected.",
    };
  }

  return { ok: true, scheduledAt, variants: scheduled, jobs, failedVariants };
}
