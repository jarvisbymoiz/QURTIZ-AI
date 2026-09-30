import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { companionDevices, companionImageJobs, contentItems, imageModePreferences } from "@/db/schema";
import { prepareExternalVisual } from "@/lib/visuals/generate";
import { createServiceClient } from "@/lib/supabase/service";

export type CompanionImageStatus = "queued" | "waiting_for_companion" | "claimed" |
  "generating" | "uploading" | "completed" | "failed";

/** Swept by the existing maintenance cron; uncertain upstream tasks never regenerate automatically. */
export async function expireCompanionImageJobs() {
  const db = getDb();
  const now = new Date();
  await db.update(companionImageJobs).set({ status: "failed", error: "Companion wait timed out.", updatedAt: now })
    .where(and(inArray(companionImageJobs.status, ["queued", "waiting_for_companion"]),
      lt(companionImageJobs.expiresAt, now)));
  await db.update(companionImageJobs).set({ status: "failed", error: "Companion image claim expired; generation outcome is uncertain.", updatedAt: now })
    .where(and(inArray(companionImageJobs.status, ["claimed", "generating", "uploading"]),
      isNotNull(companionImageJobs.claimTokenHash), lt(companionImageJobs.leaseExpiresAt, now)));
  await db.update(companionImageJobs).set({ status: "failed", error: "Image save did not finish.", updatedAt: now })
    .where(and(eq(companionImageJobs.status, "uploading"), isNull(companionImageJobs.claimTokenHash),
      lt(companionImageJobs.updatedAt, new Date(Date.now() - 10 * 60_000))));
}

/** Repeatedly remove failed staging uploads while their signed URL may still be valid. */
export async function cleanupCompanionStaging() {
  const db = getDb();
  const rows = await db.select({ id: companionImageJobs.id, status: companionImageJobs.status,
    workspaceId: companionImageJobs.workspaceId, uploadPath: companionImageJobs.uploadPath,
    updatedAt: companionImageJobs.updatedAt })
    .from(companionImageJobs).where(and(isNotNull(companionImageJobs.uploadPath),
      inArray(companionImageJobs.status, ["failed", "completed"])))
    .orderBy(asc(companionImageJobs.updatedAt)).limit(50);
  if (!rows.length) return;
  const bucket = createServiceClient().storage.from("brand-assets");
  for (const row of rows) {
    if (!row.uploadPath?.startsWith(`${row.workspaceId}/visuals/`) || !row.uploadPath.endsWith(`/${row.id}-raw`)) continue;
    const removed = await bucket.remove([row.uploadPath]);
    if (!removed.error && (row.status === "completed" ||
        Date.now() - row.updatedAt.getTime() > 3 * 60 * 60_000)) {
      await db.update(companionImageJobs).set({ uploadPath: null, updatedAt: new Date() })
        .where(and(eq(companionImageJobs.id, row.id), eq(companionImageJobs.status, "completed")));
    }
  }
}

export async function enqueueCompanionImage(args: { workspaceId: string; userId: string;
  contentItemId: string; variantId?: string; slideIndex?: number;
  idempotencyKey: string; storage?: SupabaseClient }) {
  if (!/^[A-Za-z0-9:_-]{16,160}$/.test(args.idempotencyKey)) {
    throw new Error("Invalid image request key.");
  }
  const db = getDb();
  const [preference] = await db.select({ mode: imageModePreferences.mode,
    timeoutMinutes: imageModePreferences.companionTimeoutMinutes })
    .from(imageModePreferences).where(and(eq(imageModePreferences.workspaceId, args.workspaceId),
      eq(imageModePreferences.userId, args.userId))).limit(1);
  if (preference?.mode !== "local_companion") throw new Error("ChatGPT Account Mode is not selected.");
  const [device] = await db.select().from(companionDevices)
    .where(and(eq(companionDevices.workspaceId, args.workspaceId), eq(companionDevices.userId, args.userId),
      isNull(companionDevices.revokedAt))).orderBy(
        sql`CASE WHEN ${companionDevices.lastSeenAt} > now() - interval '60 seconds' THEN 0 ELSE 1 END`,
        desc(companionDevices.lastSeenAt), desc(companionDevices.createdAt)).limit(1);
  if (!device) throw new Error("Pair a Qurtiz Companion in Settings first.");

  // A repeat click or network retry returns its existing job without another
  // brief construction or upstream generation task.
  const [existing] = await db.select({ id: companionImageJobs.id, status: companionImageJobs.status })
    .from(companionImageJobs).where(and(eq(companionImageJobs.workspaceId, args.workspaceId),
      eq(companionImageJobs.userId, args.userId), eq(companionImageJobs.idempotencyKey, args.idempotencyKey))).limit(1);
  if (existing) return existing as { id: string; status: CompanionImageStatus };

  const { brief, referenceAssets } = await prepareExternalVisual(args);
  if (!brief.prompt.trim() || brief.prompt.length > 24_000) throw new Error("Visual prompt is empty or too long.");
  const size = brief.height && brief.width && brief.height > brief.width ? "1024x1536"
    : brief.height && brief.width && brief.width > brief.height ? "1536x1024" : "1024x1024";
  const online = !!device.lastSeenAt && Date.now() - device.lastSeenAt.getTime() < 60_000;
  const timeout = Math.max(5, Math.min(1440, preference.timeoutMinutes ?? 120));
  const insertedOrPending = await db.transaction(async tx => {
    // Serializing on the content row also deduplicates two tabs that used
    // different request keys for the same post/slide.
    await tx.select({ id: contentItems.id }).from(contentItems)
      .where(and(eq(contentItems.id, args.contentItemId), eq(contentItems.workspaceId, args.workspaceId)))
      .for("update");
    const [pending] = await tx.select({ id: companionImageJobs.id, status: companionImageJobs.status })
      .from(companionImageJobs).where(and(eq(companionImageJobs.workspaceId, args.workspaceId),
        eq(companionImageJobs.userId, args.userId), eq(companionImageJobs.contentItemId, args.contentItemId),
        args.slideIndex == null ? isNull(companionImageJobs.slideIndex) : eq(companionImageJobs.slideIndex, args.slideIndex),
        inArray(companionImageJobs.status, ["queued", "waiting_for_companion", "claimed", "generating", "uploading"])))
      .limit(1);
    if (pending) return pending;
    const [inserted] = await tx.insert(companionImageJobs).values({ workspaceId: args.workspaceId,
      userId: args.userId, deviceId: device.id, contentItemId: args.contentItemId,
      variantId: args.variantId ?? null, slideIndex: args.slideIndex ?? null,
      idempotencyKey: args.idempotencyKey, status: online ? "queued" : "waiting_for_companion",
      prompt: brief.prompt, contentType: "image", size,
      targetWidth: brief.width ?? null, targetHeight: brief.height ?? null,
      referenceAssets: referenceAssets ?? [], options: { quality: "high" },
      expiresAt: new Date(Date.now() + timeout * 60_000),
    }).onConflictDoNothing().returning({ id: companionImageJobs.id, status: companionImageJobs.status });
    return inserted ?? null;
  });
  if (insertedOrPending) return insertedOrPending as { id: string; status: CompanionImageStatus };
  const [raced] = await db.select({ id: companionImageJobs.id, status: companionImageJobs.status })
    .from(companionImageJobs).where(and(eq(companionImageJobs.workspaceId, args.workspaceId),
      eq(companionImageJobs.userId, args.userId), eq(companionImageJobs.idempotencyKey, args.idempotencyKey))).limit(1);
  if (!raced) throw new Error("Image job could not be queued.");
  return raced as { id: string; status: CompanionImageStatus };
}

export async function enqueueCompanionTestImage(args: { workspaceId: string; userId: string;
  idempotencyKey: string }) {
  const db = getDb();
  const [preference] = await db.select({ mode: imageModePreferences.mode })
    .from(imageModePreferences).where(and(eq(imageModePreferences.workspaceId, args.workspaceId),
      eq(imageModePreferences.userId, args.userId))).limit(1);
  if (preference?.mode !== "local_companion") throw new Error("ChatGPT Account Mode is not selected.");
  const [device] = await db.select().from(companionDevices).where(and(
    eq(companionDevices.workspaceId, args.workspaceId), eq(companionDevices.userId, args.userId),
    isNull(companionDevices.revokedAt))).orderBy(
      sql`CASE WHEN ${companionDevices.lastSeenAt} > now() - interval '60 seconds' THEN 0 ELSE 1 END`,
      desc(companionDevices.lastSeenAt), desc(companionDevices.createdAt)).limit(1);
  if (!device) throw new Error("Pair a Qurtiz Companion in Settings first.");
  const online = !!device.lastSeenAt && Date.now() - device.lastSeenAt.getTime() < 60_000;
  const [job] = await db.insert(companionImageJobs).values({ workspaceId: args.workspaceId,
    userId: args.userId, deviceId: device.id, contentItemId: null, idempotencyKey: args.idempotencyKey,
    status: online ? "queued" : "waiting_for_companion",
    prompt: "Create a simple blue circle on a white background. No text.",
    contentType: "test", size: "1024x1024", referenceAssets: [], options: { quality: "low" },
    expiresAt: new Date(Date.now() + 30 * 60_000),
  }).onConflictDoNothing().returning({ id: companionImageJobs.id, status: companionImageJobs.status });
  if (job) return job;
  const [existing] = await db.select({ id: companionImageJobs.id, status: companionImageJobs.status })
    .from(companionImageJobs).where(and(eq(companionImageJobs.workspaceId, args.workspaceId),
      eq(companionImageJobs.userId, args.userId), eq(companionImageJobs.idempotencyKey, args.idempotencyKey))).limit(1);
  if (!existing) throw new Error("Test image could not be queued.");
  return existing;
}
