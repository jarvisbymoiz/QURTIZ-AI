import { NextResponse } from "next/server";
import { queueStatsForWorkspace, storageUsageFor } from "@/lib/media/lifecycle";
import { getActiveContext } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * GET /api/storage/usage
 *
 * Returns workspace storage usage + cleanup queue stats. Used by the
 * in-app storage chip and the workspace settings page.
 *
 * Response shape:
 *   {
 *     bytes, includeBytes, excludeBytes, byKind,
 *     quota: { plan, maxBytes, warnRatio, usedRatio, isOverWarn },
 *     queue: { pending, cleaned, failed, pendingBytes },
 *   }
 */
export async function GET() {
  const ctx = await getActiveContext("brand:read");
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 401 });

  try {
    const usage = await storageUsageFor(ctx.workspaceId);
    const queue = await queueStatsForWorkspace(ctx.workspaceId);
    const usedRatio = usage.quota.maxBytes != null && usage.quota.maxBytes > 0
      ? usage.bytes / usage.quota.maxBytes
      : 0;
    return NextResponse.json({
      ...usage,
      quota: {
        ...usage.quota,
        usedRatio,
        isOverWarn: usedRatio >= usage.quota.warnRatio,
      },
      queue,
    });
  } catch (error) {
    console.error("[storage/usage]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load storage usage." },
      { status: 500 },
    );
  }
}
