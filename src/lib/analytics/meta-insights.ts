import "server-only";
import { GRAPH_HOST, GRAPH_VERSION } from "@/lib/meta/oauth";

export type SyncReason = "missing_external_id" | "token_expired" | "permission_missing" | "unsupported_metric" | "post_not_found" | "provider_not_supported" | "rate_limited" | "connection_missing" | "account_mismatch" | "network_error" | "provider_error" | "duplicate_post";
export class InsightsError extends Error {
  constructor(public reason: SyncReason, public transient = false, public code?: number) { super(reason); }
}
export function classifyGraphError(error: { code?: number; message?: string; error_subcode?: number }, status: number): InsightsError {
  const message = error.message ?? "";
  if (error.code === 190) return new InsightsError("token_expired");
  if ([4, 17, 32, 613, 80004].includes(error.code ?? 0) || status === 429) return new InsightsError("rate_limited", true, error.code);
  if ([10, 200, 294].includes(error.code ?? 0)) return new InsightsError("permission_missing", false, error.code);
  if (/metric|insights.*not supported/i.test(message)) return new InsightsError("unsupported_metric", false, error.code);
  if (error.code === 100 || error.code === 803) return new InsightsError("post_not_found", false, error.code);
  return new InsightsError("provider_error", status >= 500, error.code);
}
export async function insightsGet(path: string, token: string): Promise<Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const url = new URL(path.startsWith("https:") ? path : `${GRAPH_HOST}/${GRAPH_VERSION}/${path}`);
  if (url.origin !== GRAPH_HOST) throw new InsightsError("provider_error");
  url.searchParams.delete("access_token");
  let response: Response;
  try { response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000), cache: "no-store" }); }
  catch { throw new InsightsError("network_error", true); }
  let body;
  try { body = await response.json(); } catch { throw new InsightsError("provider_error", response.status >= 500); }
  if (!response.ok || body.error) throw classifyGraphError(body.error ?? {}, response.status);
  return body;
}
export type RemotePost = { id: string; permalink?: string; created_time?: string; timestamp?: string; media_type?: string; media_product_type?: string; mediaIds?: string[]; mediaPermalinks?: string[] };
export async function listInsightPosts(platform: "facebook" | "instagram", account: string, token: string): Promise<RemotePost[]> {
  let next: string | null = `${account}/${platform === "facebook" ? "posts?fields=id,created_time,permalink_url,attachments{target,url,subattachments{target,url}}" : "media?fields=id,timestamp,permalink,media_type,media_product_type"}&limit=100`;
  const posts: RemotePost[] = [];
  for (let page = 0; next && page < 10; page++) {
    const body = await insightsGet(next, token);
    for (const row of body.data ?? []) if (typeof row.id === "string") {
      const attachments = (row.attachments?.data ?? []).flatMap((attachment: { target?: { id?: string }; url?: string; subattachments?: { data?: { target?: { id?: string }; url?: string }[] } }) => [attachment, ...(attachment.subattachments?.data ?? [])]);
      posts.push({ id: row.id, created_time: row.created_time, timestamp: row.timestamp, media_type: row.media_type, media_product_type: row.media_product_type, permalink: row.permalink ?? row.permalink_url,
        mediaIds: attachments.map((item: { target?: { id?: string } }) => item.target?.id).filter((id: unknown): id is string => typeof id === "string"),
        mediaPermalinks: attachments.map((item: { url?: string }) => item.url).filter((url: unknown): url is string => typeof url === "string") });
    }
    next = typeof body.paging?.next === "string" ? body.paging.next : null;
  }
  return posts;
}
export function normalizeInsights(data: { name: string; values?: { value?: unknown }[]; total_value?: { value?: unknown } }[]): Record<string, number> {
  const metrics: Record<string, number> = {};
  const names: Record<string, string> = { post_media_view: "views", views: "views", reach: "reach", saved: "saves", shares: "shares", likes: "likes", comments: "comments" };
  for (const row of data) {
    const value = row.total_value?.value ?? row.values?.[0]?.value;
    if (names[row.name] && typeof value === "number" && Number.isFinite(value)) metrics[names[row.name]] = value;
  }
  return metrics;
}
export async function fetchInsightMetrics(platform: "facebook" | "instagram", post: RemotePost, token: string): Promise<{ metrics: Record<string, number>; warnings: SyncReason[] }> {
  const countsPromise = insightsGet(`${post.id}?fields=${platform === "facebook" ? "reactions.type(LIKE).limit(0).summary(true),comments.limit(0).summary(true),shares" : "like_count,comments_count"}`, token)
    .then(body => ({ body, error: null })).catch((error: unknown) => ({ body: null, error }));
  const metrics: Record<string, number> = {};
  const warnings: SyncReason[] = [];
  const requested = platform === "facebook" ? ["post_media_view"] : ["views", "reach", "saved", "shares"];
  try {
    const body = await insightsGet(`${post.id}/insights?metric=${requested.join(",")}`, token);
    Object.assign(metrics, normalizeInsights(body.data ?? []));
  } catch (error) {
    if (!(error instanceof InsightsError) || error.reason !== "unsupported_metric") throw error;
    // A format-specific unsupported metric must not discard supported metrics.
    for (const metric of requested) {
      try { const body = await insightsGet(`${post.id}/insights?metric=${metric}`, token); Object.assign(metrics, normalizeInsights(body.data ?? [])); }
      catch (e) { if (e instanceof InsightsError && e.reason === "unsupported_metric") warnings.push(e.reason); else throw e; }
    }
  }
  const countsResult = await countsPromise;
  if (countsResult.error) throw countsResult.error;
  const body = countsResult.body!;
  const counts = platform === "facebook" ? { likes: body.reactions?.summary?.total_count, comments: body.comments?.summary?.total_count, shares: body.shares?.count } : { likes: body.like_count, comments: body.comments_count };
  for (const [name, value] of Object.entries(counts)) if (typeof value === "number" && Number.isFinite(value)) metrics[name] = value;
  if (!Object.keys(metrics).length) throw new InsightsError("unsupported_metric");
  return { metrics, warnings: [...new Set(warnings)] };
}
export function permalinkKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); if (!/(^|\.)(facebook\.com|instagram\.com|fb\.com)$/.test(url.hostname)) return null; return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}${["story_fbid", "fbid", "id"].filter(key => url.searchParams.has(key)).map(key => `?${key}=${url.searchParams.get(key)}`).join("")}`; } catch { return null; }
}
