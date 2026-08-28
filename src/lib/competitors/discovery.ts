import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { competitorSnapshots, competitors, platformConnections } from "@/db/schema";
import { decryptToken } from "@/lib/crypto/tokens";
import { GRAPH_HOST, GRAPH_VERSION } from "@/lib/meta/oauth";
import { generateText } from "ai";
import { getModel } from "@/lib/ai/provider";

export type CompetitorFetchResult =
  | { ok: true; analysis: string }
  | { ok: false; reason: string; message: string };

/**
 * Pull a competitor's public business profile via IG Business Discovery
 * (official API — target must be a public Business/Creator account), store a
 * snapshot, and generate an AI comparison against our own measured data.
 */
export async function refreshCompetitor(ctx: {
  workspaceId: string;
  competitorId: string;
  ourSummary: string;
  ourTotalsSummary: string;
}): Promise<CompetitorFetchResult> {
  const db = getDb();
  const [competitor] = await db
    .select()
    .from(competitors)
    .where(and(eq(competitors.id, ctx.competitorId), eq(competitors.workspaceId, ctx.workspaceId)));
  if (!competitor) return { ok: false, reason: "not_found", message: "Competitor not found." };

  // Business Discovery requires OUR connected IG account.
  const [igConn] = await db
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.workspaceId, ctx.workspaceId),
        eq(platformConnections.platform, "instagram"),
        eq(platformConnections.status, "connected"),
      ),
    );
  if (!igConn || !igConn.encryptedToken) {
    return {
      ok: false,
      reason: "ig_not_connected",
      message: "Connect your Instagram account first — Business Discovery runs through it (official API).",
    };
  }
  const token = decryptToken(igConn.encryptedToken);
  if (!token) return { ok: false, reason: "token", message: "Stored token could not be decrypted — reconnect Instagram." };
  const ourIgId = ((igConn.meta ?? {}) as Record<string, string>).igUserId;
  if (!ourIgId) return { ok: false, reason: "no_ig_id", message: "Connected account lacks an IG user id — reconnect." };

  const fields = `business_discovery.username(${competitor.handle}){followers_count,media_count,media.limit(12){timestamp,like_count,comments_count,caption}}`;
  const res = await fetch(
    `${GRAPH_HOST}/${GRAPH_VERSION}/${ourIgId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(45_000) },
  );
  const json = (await res.json()) as {
    business_discovery?: {
      followers_count?: number;
      media_count?: number;
      media?: { data?: { timestamp?: string; like_count?: number; comments_count?: number; caption?: string }[] };
    };
    error?: { message?: string };
  };

  if (json.error) {
    return {
      ok: false,
      reason: "graph_error",
      message: `Business Discovery failed: ${json.error.message}. Note: the target must be a public Business/Creator account.`,
    };
  }
  const bd = json.business_discovery;
  if (!bd) return { ok: false, reason: "no_data", message: "No data returned — check the username." };

  const posts = (bd.media?.data ?? []).map((m) => ({
    timestamp: m.timestamp ?? null,
    likes: m.like_count ?? 0,
    comments: m.comments_count ?? 0,
    caption: (m.caption ?? "").slice(0, 200),
  }));
  const engagement = posts.map((p) => p.likes + p.comments);
  const avgEngagement = engagement.length > 0
    ? Math.round((engagement.reduce((a, b) => a + b, 0) / engagement.length) * 10) / 10
    : 0;

  // AI comparison (labeled AI-generated in UI)
  let analysis = "";
  const model = getModel();
  if (model) {
    try {
      const res2 = await generateText({
        model,
        prompt: `Compare a competitor's public Instagram performance with ours and produce: 2 strengths, 2 weaknesses, 2 content opportunities for us. Be specific, reference the numbers, no generic advice.
Competitor @${competitor.handle}: followers ${bd.followers_count ?? "?"}, posts ${bd.media_count ?? "?"}, avg engagement per recent post ${avgEngagement}.
Recent captions (truncated): ${posts.slice(0, 6).map((p) => p.caption).join(" | ") || "(none)"}
Our summary: ${ctx.ourSummary}
Our measured totals: ${ctx.ourTotalsSummary}
Format: "Strengths: ...\\nWeaknesses: ...\\nOpportunities: ..." each item on its own line starting with "- ".`,
        maxOutputTokens: 768,
      });
      analysis = res2.text;
    } catch {
      analysis = "";
    }
  }

  await db.insert(competitorSnapshots).values({
    workspaceId: ctx.workspaceId,
    competitorId: competitor.id,
    followers: bd.followers_count ?? null,
    postsCount: bd.media_count ?? null,
    recentPosts: posts,
    avgEngagement,
    analysis: analysis || null,
  });
  await db.update(competitors).set({ lastAnalyzedAt: new Date(), updatedAt: new Date() }).where(eq(competitors.id, competitor.id));

  return { ok: true, analysis };
}
