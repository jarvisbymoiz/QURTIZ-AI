import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { contentVariants, platformConnections, postMetrics, publishingJobs } from "@/db/schema";
import { decryptToken } from "@/lib/crypto/tokens";
import { GRAPH_HOST, GRAPH_VERSION } from "@/lib/meta/oauth";

type SyncResult = { synced: number; errors: string[] };

async function graphGet(url: string, token: string): Promise<Record<string, unknown>> {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}access_token=${encodeURIComponent(token)}`, {
    signal: AbortSignal.timeout(30_000),
  });
  return (await res.json()) as Record<string, unknown>;
}

async function collectMetrics(
  workspaceId: string,
  platform: "facebook" | "instagram",
  token: string,
  externalPostId: string,
  contentItemId: string | null,
  postedAt: Date | null,
): Promise<boolean> {
  const db = getDb();
  const metricNames =
    platform === "facebook"
      ? "post_impressions,post_engaged_users,post_reactions_like_total,post_comments_count,post_shares_count"
      : "impressions,reach,likes,comments,saved,shares";

  const insights = (await graphGet(
    `${GRAPH_HOST}/${GRAPH_VERSION}/${externalPostId}/insights?metric=${metricNames}`,
    token,
  )) as { data?: { name: string; values?: { value?: number }[] }[]; error?: { message?: string } };

  if (insights.error) return false;

  const m: Record<string, number> = {};
  for (const metric of insights.data ?? []) {
    const value = metric.values?.[0]?.value;
    if (typeof value === "number") {
      m[metric.name.replace("post_", "")] = value;
      if (metric.name === "saved") m.saves = value;
    }
  }
  if (Object.keys(m).length === 0) return false;

  const normalized = {
    reach: m.reach ?? 0,
    impressions: m.impressions ?? 0,
    likes: m.reactions_like_total ?? m.likes ?? 0,
    comments: m.comments_count ?? m.comments ?? 0,
    shares: m.shares ?? 0,
    saves: m.saves ?? 0,
    videoViews: m.video_views ?? 0,
  };

  await db
    .insert(postMetrics)
    .values({ workspaceId, platform, contentItemId, externalPostId, metrics: normalized, postedAt })
    .onConflictDoUpdate({
      target: [postMetrics.workspaceId, postMetrics.platform, postMetrics.externalPostId],
      set: { metrics: normalized, collectedAt: new Date(), contentItemId },
    });
  return true;
}

/**
 * Sync insights for every connected platform in the workspace.
 * Maps external post ids from published publishing jobs back to content items.
 */
export async function syncInsightsForWorkspace(workspaceId: string): Promise<SyncResult> {
  const db = getDb();
  const result: SyncResult = { synced: 0, errors: [] };

  const connections = await db
    .select()
    .from(platformConnections)
    .where(and(eq(platformConnections.workspaceId, workspaceId), eq(platformConnections.status, "connected")));

  for (const conn of connections) {
    if (!conn.encryptedToken) continue;
    const token = decryptToken(conn.encryptedToken);
    if (!token) {
      result.errors.push(`${conn.platform}: token decrypt failed — reconnect.`);
      continue;
    }
    const meta = (conn.meta ?? {}) as Record<string, string>;

    // Map our published posts to external ids
    const publishedJobs = await db
      .select({ platform: publishingJobs.platform, contentItemId: publishingJobs.contentItemId, result: publishingJobs.result })
      .from(publishingJobs)
      .where(and(eq(publishingJobs.workspaceId, workspaceId), eq(publishingJobs.status, "published")));

    const externalIds = new Map<string, string | null>(); // externalPostId -> contentItemId
    for (const j of publishedJobs) {
      const postId = (j.result as Record<string, unknown>)?.postId;
      if (typeof postId === "string") externalIds.set(postId, j.contentItemId);
    }

    try {
      if (conn.platform === "facebook") {
        const posts = (await graphGet(
          `${GRAPH_HOST}/${GRAPH_VERSION}/${meta.pageId}/posts?fields=id,created_time&limit=50`,
          token,
        )) as { data?: { id: string; created_time?: string }[]; error?: { message?: string } };
        if (posts.error) result.errors.push(`facebook: ${posts.error.message}`);
        for (const p of posts.data ?? []) {
          const linked = externalIds.get(p.id) ?? null;
          const ok = await collectMetrics(workspaceId, "facebook", token, p.id, linked, p.created_time ? new Date(p.created_time) : null);
          if (ok) result.synced++;
        }
      }

      if (conn.platform === "instagram" && meta.igUserId) {
        const media = (await graphGet(
          `${GRAPH_HOST}/${GRAPH_VERSION}/${meta.igUserId}/media?fields=id,timestamp&limit=50`,
          token,
        )) as { data?: { id: string; timestamp?: string }[]; error?: { message?: string } };
        if (media.error) result.errors.push(`instagram: ${media.error.message}`);
        for (const p of media.data ?? []) {
          const linked = externalIds.get(p.id) ?? null;
          const ok = await collectMetrics(workspaceId, "instagram", token, p.id, linked, p.timestamp ? new Date(p.timestamp) : null);
          if (ok) result.synced++;
        }
      }
    } catch (e) {
      result.errors.push(`${conn.platform}: ${e instanceof Error ? e.message : "sync failed"}`);
    }
  }

  void contentVariants; // reserved for variant-level metric joins in later iterations
  return result;
}
