import "server-only";

import { GRAPH_HOST, GRAPH_VERSION } from "./oauth";

export type PublishInput = {
  pageToken: string;
  pageId: string;
  igUserId: string | null;
  platform: "facebook" | "instagram";
  message: string;
  imageUrl: string | null; // publicly reachable URL (signed, up to 7 days)
};

export type PublishResult =
  | { ok: true; postId: string; permalink: string | null }
  | { ok: false; reason: string; message: string };

async function graphPost(path: string, token: string, body: Record<string, string>): Promise<{ id?: string; error?: { message?: string } }> {
  const params = new URLSearchParams({ access_token: token, ...body });
  const res = await fetch(`${GRAPH_HOST}/${GRAPH_VERSION}/${path}`, {
    method: "POST",
    body: params,
    signal: AbortSignal.timeout(60_000),
  });
  return (await res.json()) as { id?: string; error?: { message?: string } };
}

async function graphGet(url: string, token: string): Promise<{ permalink?: string; error?: { message?: string } }> {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}access_token=${encodeURIComponent(token)}&fields=permalink`, {
    signal: AbortSignal.timeout(30_000),
  });
  return (await res.json()) as { permalink?: string; error?: { message?: string } };
}

/**
 * Publish via official Graph API.
 * Facebook: photo (with image) or feed post (text only).
 * Instagram: container → publish (image required; reels need hosted video —
 * not supported yet and reported honestly).
 */
export async function publishPost(input: PublishInput): Promise<PublishResult> {
  try {
    if (input.platform === "facebook") {
      let postId: string | undefined;
      if (input.imageUrl) {
        const r = await graphPost(`${input.pageId}/photos`, input.pageToken, { url: input.imageUrl, caption: input.message });
        if (r.error) return { ok: false, reason: "graph_error", message: r.error.message ?? "Facebook publish failed" };
        postId = r.id;
      } else {
        const r = await graphPost(`${input.pageId}/feed`, input.pageToken, { message: input.message });
        if (r.error) return { ok: false, reason: "graph_error", message: r.error.message ?? "Facebook publish failed" };
        postId = r.id;
      }
      const permalink = postId ? (await graphGet(`${GRAPH_HOST}/${GRAPH_VERSION}/${postId}`, input.pageToken)).permalink ?? null : null;
      return { ok: true, postId: postId ?? "", permalink };
    }

    // Instagram
    if (!input.igUserId) {
      return { ok: false, reason: "no_ig", message: "No Instagram Professional account linked to this page." };
    }
    if (!input.imageUrl) {
      return { ok: false, reason: "no_visual", message: "Instagram posts require an image. Generate a visual for this content first." };
    }
    const container = await graphPost(`${input.igUserId}/media`, input.pageToken, {
      image_url: input.imageUrl,
      caption: input.message,
    });
    if (container.error) return { ok: false, reason: "graph_error", message: container.error.message ?? "IG container failed" };
    if (!container.id) return { ok: false, reason: "graph_error", message: "IG container returned no id" };
    const published = await graphPost(`${input.igUserId}/media_publish`, input.pageToken, { creation_id: container.id });
    if (published.error) return { ok: false, reason: "graph_error", message: published.error.message ?? "IG publish failed" };
    const permalink = published.id ? (await graphGet(`${GRAPH_HOST}/${GRAPH_VERSION}/${published.id}`, input.pageToken)).permalink ?? null : null;
    return { ok: true, postId: published.id ?? "", permalink };
  } catch (error) {
    return { ok: false, reason: "network", message: error instanceof Error ? error.message : "Graph request failed" };
  }
}
