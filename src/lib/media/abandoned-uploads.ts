import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { visualAssets } from "@/db/schema";
import { queueMediaCleanup } from "@/lib/media/lifecycle";

/**
 * Scan Supabase Storage for orphaned upload paths — files in
 *   {workspaceId}/visuals/{itemId}/{uuid}
 * that have NO matching visual_assets row (i.e. the upload never
 * completed or was abandoned). The returned paths are queued for
 * cleanup with a short grace period so a near-simultaneous complete
 * upload isn't lost to a race.
 *
 * Called from the mediaCleanup worker (hourly). Workspace-scoped.
 */
export async function sweepAbandonedUploads(workspaceId: string, limit = 50): Promise<{ queued: number }> {
  const { createServiceClient } = await import("@/lib/supabase/service");
  const supabase = createServiceClient();
  if (!supabase) return { queued: 0 };
  let queued = 0;
  try {
    // List the workspace's uploads prefix. Storage.list returns up to 1000
    // entries; for very large workspaces we'd page with limit/offset, but
    // for a sweep this bounded scan is enough.
    const { data: files, error } = await supabase.storage.from("brand-assets").list(`${workspaceId}/visuals`, { limit: 1000 });
    if (error || !files) return { queued: 0 };
    const liveRows = await getDb()
      .select({ storagePath: visualAssets.storagePath })
      .from(visualAssets)
      .where(eq(visualAssets.workspaceId, workspaceId));
    const livePaths = new Set(liveRows.map(r => r.storagePath));
    for (const entry of files) {
      if (queued >= limit) break;
      if (entry.name === ".emptyFolderPlaceholder") continue;
      // Files live one level deeper at {workspaceId}/visuals/{itemId}/{uuid}.
      // We treat any entry at this depth without a matching DB row as abandoned.
      const fullPath = `${workspaceId}/visuals/${entry.name}`;
      if (livePaths.has(fullPath)) continue;
      // Skip directory placeholders that are not files (no metadata).
      if (!entry.metadata || typeof entry.metadata.size !== "number") continue;
      // Skip entries too fresh to call abandoned (under 5 minutes old —
      // a near-simultaneous upload + sweep would otherwise eat a real
      // upload).
      const createdAt = entry.created_at ? new Date(entry.created_at).getTime() : 0;
      if (Date.now() - createdAt < 5 * 60_000) continue;
      await queueMediaCleanup({
        workspaceId,
        storagePath: fullPath,
        sourceTable: "visual_assets",
        sourceRowId: null,
        bytes: entry.metadata.size,
        reason: "abandoned_upload",
        graceHours: 1,
        createdBy: workspaceId, // system action; not user-initiated
      });
      queued++;
    }
  } catch (error) {
    console.error("[abandoned-upload-sweep]", workspaceId, error);
  }
  return { queued };
}
