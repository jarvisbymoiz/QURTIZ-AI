/**
 * Pure analytics aggregation from synced post metrics.
 * Deterministic — the UI presents these as measured data, and every
 * AI-derived insight stays labeled as AI-generated.
 */
export type MetricsRow = {
  platform: "facebook" | "instagram";
  contentItemId: string | null;
  metrics: {
    reach?: number;
    impressions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    videoViews?: number;
  };
  postedAt: Date | null;
  hourOfDay?: number | null; // resolved in workspace tz by the caller
  format?: string | null;
  topic?: string | null;
};

export type Totals = {
  posts: number;
  reach: number;
  impressions: number;
  engagement: number;
  engagementRate: number; // 0-100
};

export function sumTotals(rows: MetricsRow[]): Totals {
  let reach = 0, impressions = 0, engagement = 0, withReach = 0;
  for (const r of rows) {
    const m = r.metrics ?? {};
    reach += m.reach ?? 0;
    impressions += m.impressions ?? 0;
    engagement += (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
    if ((m.reach ?? 0) > 0) withReach++;
  }
  return {
    posts: rows.length,
    reach,
    impressions,
    engagement,
    engagementRate: withReach > 0 ? Math.round((engagement / reach) * 1000) / 10 : 0,
  };
}

export function groupPerformance(
  rows: MetricsRow[],
  keyOf: (r: MetricsRow) => string,
): { key: string; totals: Totals }[] {
  const groups = new Map<string, MetricsRow[]>();
  for (const r of rows) {
    const k = keyOf(r) || "unknown";
    const list = groups.get(k) ?? [];
    list.push(r);
    groups.set(k, list);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({ key, totals: sumTotals(list) }))
    .sort((a, b) => b.totals.engagement - a.totals.engagement);
}

/** Best posting hours by average engagement (input hours are workspace-tz). */
export function bestPostingHours(rows: MetricsRow[]): { hour: number; avgEngagement: number; posts: number }[] {
  const byHour = new Map<number, { total: number; posts: number }>();
  for (const r of rows) {
    if (r.hourOfDay === null || r.hourOfDay === undefined) continue;
    const e = (r.metrics?.likes ?? 0) + (r.metrics?.comments ?? 0) + (r.metrics?.shares ?? 0) + (r.metrics?.saves ?? 0);
    const cur = byHour.get(r.hourOfDay) ?? { total: 0, posts: 0 };
    cur.total += e;
    cur.posts += 1;
    byHour.set(r.hourOfDay, cur);
  }
  return [...byHour.entries()]
    .map(([hour, v]) => ({ hour, avgEngagement: Math.round((v.total / v.posts) * 10) / 10, posts: v.posts }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 5);
}
