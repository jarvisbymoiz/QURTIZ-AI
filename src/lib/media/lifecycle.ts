import "server-only";

/**
 * Media lifecycle: tracking, quota, cleanup.
 *
 * The product database has two media tables:
 *   - visual_assets: per-post images/videos (uploads + AI generated)
 *   - brand_assets: workspace-level logo/avatar/reference
 * Both rows reference a Supabase Storage object by path. The lifecycle
 * library centralizes:
 *
 *   1. Reference counting: a single Storage object can be reused across
 *      rows (today: each visual_assets row points to its OWN storage path,
 *      so refCount is the row's local count; when a future refactor lets
 *      multiple rows share a path, refCount prevents premature deletion).
 *
 *   2. Soft delete with grace period: instead of removing a Storage object
 *      the moment a user clicks "Delete", we mark the row as
 *      `cleanup_status='soft_deleted'` and queue a cleanup row. The
 *      background worker purges Storage + row only AFTER grace_until AND
 *      only when ref_count has dropped to 0.
 *
 *   3. Abandoned-upload tracking: signed upload tickets expire after 30 min.
 *      If the matching object never receives a complete-upload call, the
 *      scheduler purges the storage object after a short grace period.
 *
 *   4. Quotas: workspace_storage_quotas.max_storage_bytes caps usage per
 *      workspace; uploads that would exceed it fail fast at ticket time.
 *
 *   5. Usage reporting: storageUsageFor(workspaceId) returns the live
 *      byte count + cap + ratio, fed to the in-app storage chip.
 *
 * The library does NOT touch the Storage client directly. Cleanup is
 * queued here and executed by the mediaCleanup worker (which CAN safely
 * use the service-role Supabase client outside any request scope).
 */

import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { brandAssets, mediaCleanupQueue, visualAssets, workspaceStorageQuotas, workspaces } from "@/db/schema";

/** Default retention windows — all overridable per call site. */
export const DEFAULT_SOFT_DELETE_GRACE_HOURS = 24;
export const DEFAULT_ABANDONED_UPLOAD_GRACE_HOURS = 1;
export const DEFAULT_HARD_DELETE_GRACE_HOURS = 72;

/** Reasons recorded in media_cleanup_queue.reason (audit / explainability). */
export type CleanupReason =
  | "post_deleted"
  | "asset_removed"
  | "abandoned_upload"
  | "workspace_deleted"
  | "quota_enforcement"
  | "manual";

export type CleanupSourceTable = "visual_assets" | "brand_assets";

export type QueueMediaCleanupInput = {
  workspaceId: string;
  storagePath: string;
  sourceTable: CleanupSourceTable;
  sourceRowId: string | null;
  bytes: number;
  reason: CleanupReason;
  createdBy: string;
  /** Hours from now until the worker is allowed to delete the object. */
  graceHours?: number;
  /** Snapshot of ref count when queued — used for "did anyone take a
   *  reference in the meantime?" check at cleanup time. */
  refCountAtQueue?: number;
};

/**
 * Insert a cleanup queue row. The DB enforces uniqueness on
 * (storage_path, status='pending') implicitly through the partial index —
 * callers should not insert twice for the same path+pending. Worker
 * retries on `pending` after a failed Storage delete.
 */
export async function queueMediaCleanup(input: QueueMediaCleanupInput): Promise<{ id: string }> {
  const graceHours = input.graceHours
    ?? (input.reason === "abandoned_upload" ? DEFAULT_ABANDONED_UPLOAD_GRACE_HOURS
      : input.reason === "workspace_deleted" ? 0
        : DEFAULT_SOFT_DELETE_GRACE_HOURS);
  const graceUntil = new Date(Date.now() + graceHours * 3_600_000);
  const [row] = await getDb()
    .insert(mediaCleanupQueue)
    .values({
      workspaceId: input.workspaceId,
      storagePath: input.storagePath,
      sourceTable: input.sourceTable,
      sourceRowId: input.sourceRowId,
      sourceKind: input.reason,
      bytes: input.bytes,
      reason: input.reason,
      graceUntil,
      refCountAtQueue: input.refCountAtQueue ?? 1,
      createdBy: input.createdBy,
    })
    .returning({ id: mediaCleanupQueue.id });
  if (!row) throw new Error("Failed to queue media cleanup");
  return row;
}

/**
 * Mark an existing visual_assets row for soft-deletion with a grace
 * period. Decrements the local ref count so when it hits 0 the row is
 * eligible for cleanup. Does NOT delete Storage yet — the worker does
 * that after grace_until AND only if no other rows reference the path.
 */
export async function markVisualAssetForCleanup(args: {
  workspaceId: string;
  visualId: string;
  reason: CleanupReason;
  graceHours?: number;
  createdBy: string;
}): Promise<{ storagePath: string; bytes: number } | null> {
  const db = getDb();
  return db.transaction(async tx => {
    const [row] = await tx
      .select({ id: visualAssets.id, storagePath: visualAssets.storagePath, meta: visualAssets.meta })
      .from(visualAssets)
      .where(and(eq(visualAssets.id, args.visualId), eq(visualAssets.workspaceId, args.workspaceId)))
      .for("update");
    if (!row) return null;
    const meta = (row.meta ?? {}) as { sizeBytes?: number };
    const bytes = typeof meta.sizeBytes === "number" ? meta.sizeBytes : 0;
    const graceHours = args.graceHours
      ?? (args.reason === "abandoned_upload" ? DEFAULT_ABANDONED_UPLOAD_GRACE_HOURS : DEFAULT_SOFT_DELETE_GRACE_HOURS);
    const cleanupEligibleAt = new Date(Date.now() + graceHours * 3_600_000);
    await tx
      .update(visualAssets)
      .set({
        cleanupStatus: args.reason === "abandoned_upload" ? "temporary" : "soft_deleted",
        cleanupEligibleAt,
        refCount: sql`GREATEST(0, ${visualAssets.refCount} - 1)`,
      })
      .where(and(eq(visualAssets.id, row.id), eq(visualAssets.workspaceId, args.workspaceId)));
    await tx.insert(mediaCleanupQueue).values({
      workspaceId: args.workspaceId,
      storagePath: row.storagePath,
      sourceTable: "visual_assets",
      sourceRowId: row.id,
      sourceKind: args.reason,
      bytes,
      reason: args.reason,
      graceUntil: cleanupEligibleAt,
      createdBy: args.createdBy,
    });
    return { storagePath: row.storagePath, bytes };
  });
}

/** Same as markVisualAssetForCleanup for brand_assets rows. */
export async function markBrandAssetForCleanup(args: {
  workspaceId: string;
  brandAssetId: string;
  reason: CleanupReason;
  graceHours?: number;
  createdBy: string;
}): Promise<{ storagePath: string; bytes: number } | null> {
  const db = getDb();
  return db.transaction(async tx => {
    const [row] = await tx
      .select({ id: brandAssets.id, storagePath: brandAssets.storagePath, sizeBytes: brandAssets.sizeBytes })
      .from(brandAssets)
      .where(and(eq(brandAssets.id, args.brandAssetId), eq(brandAssets.workspaceId, args.workspaceId)))
      .for("update");
    if (!row) return null;
    const graceHours = args.graceHours
      ?? (args.reason === "abandoned_upload" ? DEFAULT_ABANDONED_UPLOAD_GRACE_HOURS : DEFAULT_SOFT_DELETE_GRACE_HOURS);
    const cleanupEligibleAt = new Date(Date.now() + graceHours * 3_600_000);
    await tx
      .update(brandAssets)
      .set({
        cleanupStatus: args.reason === "abandoned_upload" ? "temporary" : "soft_deleted",
        cleanupEligibleAt,
        refCount: sql`GREATEST(0, ${brandAssets.refCount} - 1)`,
      })
      .where(and(eq(brandAssets.id, row.id), eq(brandAssets.workspaceId, args.workspaceId)));
    await tx.insert(mediaCleanupQueue).values({
      workspaceId: args.workspaceId,
      storagePath: row.storagePath,
      sourceTable: "brand_assets",
      sourceRowId: row.id,
      sourceKind: args.reason,
      bytes: row.sizeBytes ?? 0,
      reason: args.reason,
      graceUntil: cleanupEligibleAt,
      createdBy: args.createdBy,
    });
    return { storagePath: row.storagePath, bytes: row.sizeBytes ?? 0 };
  });
}

/**
 * Bump ref_count when a new row references an existing storage path.
 * Used when copying/duplicating an asset to another post without a fresh
 * upload. Today no caller actually does that, but the function is here
 * so a future feature can plug in without redesigning the lifecycle.
 */
export async function referenceVisualAsset(args: {
  workspaceId: string;
  visualId: string;
}): Promise<void> {
  await getDb()
    .update(visualAssets)
    .set({ refCount: sql`${visualAssets.refCount} + 1`, lastUsedAt: new Date() })
    .where(and(eq(visualAssets.id, args.visualId), eq(visualAssets.workspaceId, args.workspaceId)));
}

/**
 * Workspace storage usage: aggregate bytes of all live media rows that
 * are NOT marked for cleanup. Soft-deleted rows are excluded because
 * the storage object is on its way out.
 */
export async function storageUsageFor(workspaceId: string): Promise<{
  bytes: number;
  includeBytes: number;
  excludeBytes: number;
  byKind: { kind: string; count: number; bytes: number }[];
  quota: { plan: string; maxBytes: number | null; warnRatio: number };
}> {
  const db = getDb();
  // visual_assets: bytes live in meta.sizeBytes for "upload" rows; AI / template rows have no
  // recorded size, so estimate via mime (PNG ~ 200KB, JPG ~ 150KB, video unknown).
  // We store 0 for unknown so the sum is a lower bound, not a fabrication.
  const visualRows = await db
    .select({
      kind: visualAssets.kind,
      cleanupStatus: visualAssets.cleanupStatus,
      meta: visualAssets.meta,
    })
    .from(visualAssets)
    .where(eq(visualAssets.workspaceId, workspaceId));
  const brandRows = await db
    .select({
      sizeBytes: brandAssets.sizeBytes,
      cleanupStatus: brandAssets.cleanupStatus,
    })
    .from(brandAssets)
    .where(eq(brandAssets.workspaceId, workspaceId));

  const sumFor = (rows: { bytes: number; cleanupStatus: string }[]) =>
    rows.reduce((acc, r) => (r.cleanupStatus === "permanent" ? acc + r.bytes : acc), 0);

  const visualBytes = visualRows.map(r => {
    const meta = (r.meta ?? {}) as { sizeBytes?: number };
    return {
      bytes: typeof meta.sizeBytes === "number" ? meta.sizeBytes : 0,
      cleanupStatus: r.cleanupStatus,
      kind: r.kind,
    };
  });
  const brandBytes = brandRows.map(r => ({ bytes: r.sizeBytes ?? 0, cleanupStatus: r.cleanupStatus }));

  const includeVisual = sumFor(visualBytes);
  const includeBrand = sumFor(brandBytes);
  const includeBytes = includeVisual + includeBrand;
  const excludeVisual = visualBytes.reduce((a, r) => (r.cleanupStatus !== "permanent" ? a + r.bytes : a), 0);
  const excludeBrand = brandBytes.reduce((a, r) => (r.cleanupStatus !== "permanent" ? a + r.bytes : a), 0);

  // Per-kind breakdown for the in-app chip.
  const byKindMap = new Map<string, { count: number; bytes: number }>();
  for (const v of visualBytes) {
    if (v.cleanupStatus !== "permanent") continue;
    const k = `visual:${v.kind}`;
    const prev = byKindMap.get(k) ?? { count: 0, bytes: 0 };
    prev.count += 1;
    prev.bytes += v.bytes;
    byKindMap.set(k, prev);
  }
  for (const b of brandBytes) {
    if (b.cleanupStatus !== "permanent") continue;
    const k = `brand`;
    const prev = byKindMap.get(k) ?? { count: 0, bytes: 0 };
    prev.count += 1;
    prev.bytes += b.bytes;
    byKindMap.set(k, prev);
  }

  const [quota] = await db
    .select()
    .from(workspaceStorageQuotas)
    .where(eq(workspaceStorageQuotas.workspaceId, workspaceId))
    .limit(1);

  return {
    bytes: includeBytes,
    includeBytes,
    excludeBytes: excludeVisual + excludeBrand,
    byKind: [...byKindMap.entries()].map(([kind, v]) => ({ kind, ...v })),
    quota: {
      plan: quota?.plan ?? "free",
      maxBytes: quota?.maxStorageBytes ?? null,
      warnRatio: quota?.warnRatio ?? 0.8,
    },
  };
}

/** Quota check used by beginMediaUploadAction: returns null when the
 *  upload would fit, otherwise an honest reason. */
export async function checkUploadQuota(args: {
  workspaceId: string;
  proposedBytes: number;
  isVideo: boolean;
}): Promise<null | { reason: "workspace_missing" | "over_quota" | "over_per_file" | "over_type_cap"; message: string }> {
  const db = getDb();
  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, args.workspaceId)).limit(1);
  if (!ws) return { reason: "workspace_missing", message: "Workspace not found." };
  let [quota] = await db
    .select()
    .from(workspaceStorageQuotas)
    .where(eq(workspaceStorageQuotas.workspaceId, args.workspaceId))
    .limit(1);
  if (!quota) {
    // Lazy-seed: a brand-new workspace's quota row is created on the first
    // quota read so we never block uploads on race conditions with the
    // migration-time INSERT.
    const inserted = await db
      .insert(workspaceStorageQuotas)
      .values({ workspaceId: args.workspaceId, plan: "free", maxStorageBytes: 1_073_741_824 })
      .onConflictDoNothing()
      .returning();
    quota = inserted[0]
      ?? (await db
        .select()
        .from(workspaceStorageQuotas)
        .where(eq(workspaceStorageQuotas.workspaceId, args.workspaceId))
        .limit(1))[0];
    if (!quota) return null;
  }
  if (args.proposedBytes > quota.maxPerFileBytes) {
    return { reason: "over_per_file", message: `Files must be at most ${Math.round(quota.maxPerFileBytes / 1_048_576)}MB for the ${quota.plan} plan.` };
  }
  const typeCap = args.isVideo ? quota.maxVideoBytes : quota.maxImageBytes;
  if (args.proposedBytes > typeCap) {
    return { reason: "over_type_cap", message: `${args.isVideo ? "Videos" : "Images"} must be at most ${Math.round(typeCap / 1_048_576)}MB for the ${quota.plan} plan.` };
  }
  if (quota.maxStorageBytes != null) {
    const usage = await storageUsageFor(args.workspaceId);
    if (usage.bytes + args.proposedBytes > quota.maxStorageBytes) {
      return {
        reason: "over_quota",
        message: `Workspace storage is ${Math.round(usage.bytes / 1_048_576)}MB of ${Math.round(quota.maxStorageBytes / 1_048_576)}MB used. Free up space or upgrade your plan.`,
      };
    }
  }
  return null;
}

/** Bulk-set workspace quota (admin / plan upgrade endpoint). */
export async function setWorkspaceQuota(args: {
  workspaceId: string;
  plan: "free" | "pro" | "business" | "enterprise";
  maxStorageBytes: number | null;
  maxPerFileBytes?: number;
  maxImageBytes?: number;
  maxVideoBytes?: number;
  warnRatio?: number;
  updatedBy: string;
}): Promise<void> {
  await getDb()
    .insert(workspaceStorageQuotas)
    .values({
      workspaceId: args.workspaceId,
      plan: args.plan,
      maxStorageBytes: args.maxStorageBytes,
      maxPerFileBytes: args.maxPerFileBytes ?? 52_428_800,
      maxImageBytes: args.maxImageBytes ?? 9_437_184,
      maxVideoBytes: args.maxVideoBytes ?? 52_428_800,
      warnRatio: args.warnRatio ?? 0.8,
      updatedBy: args.updatedBy,
    })
    .onConflictDoUpdate({
      target: workspaceStorageQuotas.workspaceId,
      set: {
        plan: args.plan,
        maxStorageBytes: args.maxStorageBytes,
        maxPerFileBytes: args.maxPerFileBytes ?? 52_428_800,
        maxImageBytes: args.maxImageBytes ?? 9_437_184,
        maxVideoBytes: args.maxVideoBytes ?? 52_428_800,
        warnRatio: args.warnRatio ?? 0.8,
        updatedBy: args.updatedBy,
        updatedAt: new Date(),
      },
    });
}

/** Eligible rows for the cleanup worker: pending + grace_until elapsed. */
export async function listEligibleCleanup(limit = 100): Promise<Array<{
  id: string;
  workspaceId: string;
  storagePath: string;
  sourceTable: CleanupSourceTable;
  sourceRowId: string | null;
  sourceKind: string;
  bytes: number;
  attempts: number;
}>> {
  const rows = await getDb()
    .select({
      id: mediaCleanupQueue.id,
      workspaceId: mediaCleanupQueue.workspaceId,
      storagePath: mediaCleanupQueue.storagePath,
      sourceTable: mediaCleanupQueue.sourceTable,
      sourceRowId: mediaCleanupQueue.sourceRowId,
      sourceKind: mediaCleanupQueue.sourceKind,
      bytes: mediaCleanupQueue.bytes,
      attempts: mediaCleanupQueue.attempts,
    })
    .from(mediaCleanupQueue)
    .where(and(
      eq(mediaCleanupQueue.status, "pending"),
      lt(mediaCleanupQueue.graceUntil, new Date()),
    ))
    .limit(limit);
  return rows as Array<{
    id: string;
    workspaceId: string;
    storagePath: string;
    sourceTable: CleanupSourceTable;
    sourceRowId: string | null;
    sourceKind: string;
    bytes: number;
    attempts: number;
  }>;
}

/**
 * Count rows still holding a live reference to a storage path, across
 * both media tables. "Live" means ref_count > 0 — a row that has been
 * marked for cleanup (ref_count 0) does not protect the path anymore.
 * Used by the cleanup worker to enforce the shared-media rule: a storage
 * object is removed only when NO row in the workspace references it.
 */
export async function countLiveReferencesToPath(args: {
  workspaceId: string;
  storagePath: string;
  /** Row to exclude from the count (the queue row's own source row). */
  exceptRowId?: string | null;
}): Promise<number> {
  const db = getDb();
  const [visualRows, brandRows] = await Promise.all([
    db
      .select({ id: visualAssets.id })
      .from(visualAssets)
      .where(and(
        eq(visualAssets.workspaceId, args.workspaceId),
        eq(visualAssets.storagePath, args.storagePath),
        gt(visualAssets.refCount, 0),
      ))
      .limit(100),
    db
      .select({ id: brandAssets.id })
      .from(brandAssets)
      .where(and(
        eq(brandAssets.workspaceId, args.workspaceId),
        eq(brandAssets.storagePath, args.storagePath),
        gt(brandAssets.refCount, 0),
      ))
      .limit(100),
  ]);
  let count = visualRows.length + brandRows.length;
  if (args.exceptRowId) {
    // The row being cleaned may itself have refCount=0 already (it was
    // marked), in which case it isn't in the live sets at all. If it IS
    // present (rare: refCount didn't drop), exclude it so deletion is
    // decided against OTHER references only.
    const inVisual = visualRows.some(r => r.id === args.exceptRowId);
    const inBrand = brandRows.some(r => r.id === args.exceptRowId);
    if (inVisual || inBrand) count -= 1;
  }
  return count;
}

/**
 * Decide whether a queued row is actually eligible for Storage deletion
 * RIGHT NOW.
 *
 * Outcomes:
 *   - "defer":   the source row still has live references (ref_count > 0)
 *                or OTHER rows still reference the same storage path — the
 *                shared-media rule says do not remove the object.
 *   - "rowonly": the source row owns no remaining references but OTHER
 *                rows still reference the path. Delete only the DB row;
 *                the storage object is removed later, by the queue row
 *                that finds zero live references for the path.
 *   - "delete":  no live references remain anywhere. Remove the storage
 *                object AND the source row.
 *   - "skip":    the queue row cannot safely act on the path (e.g. the
 *                path does not belong to the workspace — defensive
 *                workspace-isolation check). Mark the queue row done
 *                without touching storage.
 */
export async function evaluateCleanupEligibility(args: {
  sourceTable: CleanupSourceTable;
  sourceRowId: string | null;
  workspaceId: string;
  storagePath: string;
}): Promise<"delete" | "defer" | "rowonly" | "skip"> {
  // Workspace isolation: storage paths are prefixed with the owning
  // workspace id by convention. Never allow a queue row to act on a
  // path that doesn't belong to its workspace — belt-and-braces against
  // tampered queue rows and cross-workspace bugs.
  if (!args.storagePath.startsWith(`${args.workspaceId}/`)) return "skip";

  const db = getDb();
  let sourceRefCount: number | null = null;
  if (args.sourceRowId) {
    if (args.sourceTable === "visual_assets") {
      const [row] = await db
        .select({ refCount: visualAssets.refCount })
        .from(visualAssets)
        .where(and(eq(visualAssets.id, args.sourceRowId), eq(visualAssets.workspaceId, args.workspaceId)))
        .limit(1);
      sourceRefCount = row?.refCount ?? null;
    } else {
      const [row] = await db
        .select({ refCount: brandAssets.refCount })
        .from(brandAssets)
        .where(and(eq(brandAssets.id, args.sourceRowId), eq(brandAssets.workspaceId, args.workspaceId)))
        .limit(1);
      sourceRefCount = row?.refCount ?? null;
    }
  }
  if (sourceRefCount != null && sourceRefCount > 0) return "defer";

  const liveRefs = await countLiveReferencesToPath({
    workspaceId: args.workspaceId,
    storagePath: args.storagePath,
    exceptRowId: args.sourceRowId,
  });
  if (liveRefs > 0) return args.sourceRowId ? "rowonly" : "defer";
  return "delete";
}

/** Mark a cleanup queue row as successfully cleaned (Storage + DB row gone). */
export async function markCleanupDone(args: {
  queueId: string;
  cleanedBytes: number;
}): Promise<void> {
  await getDb()
    .update(mediaCleanupQueue)
    .set({
      status: "cleaned",
      cleanedAt: new Date(),
      cleanedBytes: args.cleanedBytes,
      updatedAt: new Date(),
    })
    .where(eq(mediaCleanupQueue.id, args.queueId));
}

/** Increment the attempt counter and record the last error message. */
export async function recordCleanupAttempt(args: {
  queueId: string;
  errorMessage: string;
  /** When set, the queue row is parked as `failed` so a human can inspect.
   *  When null, the row stays `pending` and will be retried on the next tick. */
  final?: boolean;
}): Promise<void> {
  await getDb()
    .update(mediaCleanupQueue)
    .set({
      attempts: sql`${mediaCleanupQueue.attempts} + 1`,
      lastError: args.errorMessage.slice(0, 1000),
      status: args.final ? "failed" : "pending",
      updatedAt: new Date(),
    })
    .where(eq(mediaCleanupQueue.id, args.queueId));
}

/**
 * Hard-delete the source DB row (used after Storage is gone). Returns
 * the bytes that were cleared so the caller can update quota accounting.
 */
export async function deleteSourceRow(args: {
  sourceTable: CleanupSourceTable;
  sourceRowId: string;
  workspaceId: string;
}): Promise<{ bytesDeleted: number }> {
  const db = getDb();
  if (args.sourceTable === "visual_assets") {
    const [row] = await db
      .select({ meta: visualAssets.meta })
      .from(visualAssets)
      .where(and(eq(visualAssets.id, args.sourceRowId), eq(visualAssets.workspaceId, args.workspaceId)))
      .limit(1);
    if (!row) return { bytesDeleted: 0 };
    const meta = (row.meta ?? {}) as { sizeBytes?: number };
    const bytes = typeof meta.sizeBytes === "number" ? meta.sizeBytes : 0;
    await db
      .delete(visualAssets)
      .where(and(eq(visualAssets.id, args.sourceRowId), eq(visualAssets.workspaceId, args.workspaceId)));
    return { bytesDeleted: bytes };
  }
  const [row] = await db
    .select({ sizeBytes: brandAssets.sizeBytes })
    .from(brandAssets)
    .where(and(eq(brandAssets.id, args.sourceRowId), eq(brandAssets.workspaceId, args.workspaceId)))
    .limit(1);
  if (!row) return { bytesDeleted: 0 };
  const bytes = row.sizeBytes ?? 0;
  await db
    .delete(brandAssets)
    .where(and(eq(brandAssets.id, args.sourceRowId), eq(brandAssets.workspaceId, args.workspaceId)));
  return { bytesDeleted: bytes };
}

/** Live cleanup queue size per status (used by tests + the dashboard chip). */
export async function queueStatsForWorkspace(workspaceId: string): Promise<{
  pending: number;
  cleaned: number;
  failed: number;
  pendingBytes: number;
}> {
  const db = getDb();
  const rows = await db
    .select({
      status: mediaCleanupQueue.status,
      bytes: mediaCleanupQueue.bytes,
      cleanedBytes: mediaCleanupQueue.cleanedBytes,
    })
    .from(mediaCleanupQueue)
    .where(eq(mediaCleanupQueue.workspaceId, workspaceId));
  let pending = 0, cleaned = 0, failed = 0, pendingBytes = 0;
  for (const r of rows) {
    if (r.status === "pending") { pending++; pendingBytes += r.bytes; }
    else if (r.status === "cleaned") { cleaned++; }
    else if (r.status === "failed") { failed++; }
  }
  return { pending, cleaned, failed, pendingBytes };
}

/** Internal: find any visual_assets that became orphaned (ref_count=0)
 *  but were never queued — defensive backstop for legacy data or bugs
 *  that left rows in a weird state. */
export async function listOrphanedVisualAssets(workspaceId?: string, limit = 100): Promise<Array<{ id: string; storagePath: string; workspaceId: string }>> {
  const db = getDb();
  const rows = await db
    .select({ id: visualAssets.id, storagePath: visualAssets.storagePath, workspaceId: visualAssets.workspaceId })
    .from(visualAssets)
    .where(and(
      eq(visualAssets.refCount, 0),
      or(eq(visualAssets.cleanupStatus, "permanent"), isNull(visualAssets.cleanupEligibleAt)),
      workspaceId ? eq(visualAssets.workspaceId, workspaceId) : undefined,
    ))
    .limit(limit);
  return rows;
}
