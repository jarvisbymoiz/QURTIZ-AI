import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  deleteSourceRow,
  evaluateCleanupEligibility,
  listEligibleCleanup,
  markCleanupDone,
  recordCleanupAttempt,
  type CleanupSourceTable,
} from "@/lib/media/lifecycle";

/**
 * Media cleanup worker — runs hourly via pg-boss (`mediaCleanup` cron).
 *
 * Workflow:
 *   1. Read pending queue rows whose grace_until has passed.
 *   2. For each row, evaluate eligibility (defer / skip / delete).
 *   3. If delete: remove from Storage via the service-role Supabase
 *      client, then delete the matching DB row, then mark the queue row
 *      as cleaned.
 *   4. If defer: leave the queue row pending; the worker will re-evaluate
 *      next tick.
 *   5. If skip: Storage is gone but the queue row is still here; mark it
 *      cleaned without doing anything else.
 *
 * Idempotent: re-running is safe. If Storage is already gone we treat it
 * as a successful skip and clean up the DB row + queue row.
 *
 * Bounded: at most MAX_BATCH rows per tick so a long-running tick can
 * never run into the scheduler timeout.
 */
const MAX_BATCH = 100;
const MAX_ATTEMPTS = 5;

export type CleanupRunStats = {
  scanned: number;
  deleted: number;
  deferred: number;
  skipped: number;
  failed: number;
  bytesReclaimed: number;
};

export async function mediaCleanupTick(): Promise<CleanupRunStats> {
  const stats: CleanupRunStats = { scanned: 0, deleted: 0, deferred: 0, skipped: 0, failed: 0, bytesReclaimed: 0 };
  const supabase = createServiceClient();
  if (!supabase) {
    console.warn("[media-cleanup] SUPABASE_SERVICE_ROLE_KEY not configured; skipping");
    return stats;
  }

  const eligible = await listEligibleCleanup(MAX_BATCH);
  stats.scanned = eligible.length;
  for (const row of eligible) {
    if (row.attempts >= MAX_ATTEMPTS) {
      await recordCleanupAttempt({ queueId: row.id, errorMessage: `Exceeded max attempts (${MAX_ATTEMPTS})`, final: true });
      stats.failed += 1;
      continue;
    }
    let decision: "delete" | "defer" | "rowonly" | "skip";
    try {
      decision = await evaluateCleanupEligibility({
        sourceTable: row.sourceTable as CleanupSourceTable,
        sourceRowId: row.sourceRowId,
        workspaceId: row.workspaceId,
        storagePath: row.storagePath,
      });
    } catch (error) {
      await recordCleanupAttempt({
        queueId: row.id,
        errorMessage: error instanceof Error ? error.message : "eligibility check failed",
      });
      stats.failed += 1;
      continue;
    }

    if (decision === "defer") {
      // Last reference still alive; do nothing, try again next tick.
      stats.deferred += 1;
      continue;
    }
    if (decision === "skip") {
      // Queue row cannot act on this path (workspace isolation). Clear it.
      await markCleanupDone({ queueId: row.id, cleanedBytes: row.bytes });
      stats.skipped += 1;
      continue;
    }
    if (decision === "rowonly") {
      // Other rows still reference the storage path (shared media). Delete
      // only the DB row; the object's own cleanup row will purge the file
      // when the last reference goes.
      try {
        if (row.sourceRowId) {
          await deleteSourceRow({
            sourceTable: row.sourceTable as CleanupSourceTable,
            sourceRowId: row.sourceRowId,
            workspaceId: row.workspaceId,
          });
        }
        await markCleanupDone({ queueId: row.id, cleanedBytes: 0 });
        stats.deleted += 1;
      } catch (error) {
        await recordCleanupAttempt({
          queueId: row.id,
          errorMessage: error instanceof Error ? error.message : "row-only cleanup failed",
        });
        stats.failed += 1;
      }
      continue;
    }

    // decision === "delete": purge Storage then DB row, then queue row.
    try {
      const { error } = await supabase.storage.from("brand-assets").remove([row.storagePath]);
      if (error && !/not\s*found/i.test(error.message)) {
        await recordCleanupAttempt({
          queueId: row.id,
          errorMessage: `storage remove failed: ${error.message}`,
        });
        stats.failed += 1;
        continue;
      }
      // If storage failed with "not found" the file is already gone; that's
      // still a successful cleanup, so we fall through to row delete.
      const { bytesDeleted } = await deleteSourceRow({
        sourceTable: row.sourceTable as CleanupSourceTable,
        sourceRowId: row.sourceRowId ?? "",
        workspaceId: row.workspaceId,
      });
      await markCleanupDone({ queueId: row.id, cleanedBytes: bytesDeleted });
      stats.deleted += 1;
      stats.bytesReclaimed += bytesDeleted || row.bytes;
    } catch (error) {
      await recordCleanupAttempt({
        queueId: row.id,
        errorMessage: error instanceof Error ? error.message : "unknown cleanup error",
        final: row.attempts + 1 >= MAX_ATTEMPTS,
      });
      stats.failed += 1;
    }
  }

  if (stats.scanned > 0) {
    console.info(
      `[media-cleanup] scanned=${stats.scanned} deleted=${stats.deleted} deferred=${stats.deferred} skipped=${stats.skipped} failed=${stats.failed} bytes=${stats.bytesReclaimed}`,
    );
  }
  return stats;
}
