import "server-only";

import { GRAPH_HOST, GRAPH_VERSION, formatMetaGraphError, type MetaGraphErrorPayload } from "./oauth";

export type PublishInput = {
  pageToken: string;
  pageId: string;
  igUserId: string | null;
  platform: "facebook" | "instagram";
  message: string;
  imageUrl: string | null; // publicly reachable URL (signed, up to 7 days)
  videoUrl?: string | null;
};

export type PublishResult =
  | { ok: true; postId: string; permalink: string | null }
  | { ok: false; reason: string; message: string };

async function graphPost(
  path: string,
  token: string,
  body: Record<string, string>,
): Promise<{ id?: string; error?: MetaGraphErrorPayload }> {
  const params = new URLSearchParams({ access_token: token, ...body });
  const res = await fetch(`${GRAPH_HOST}/${GRAPH_VERSION}/${path}`, {
    method: "POST",
    body: params,
    signal: AbortSignal.timeout(60_000),
  });
  return (await res.json()) as { id?: string; error?: MetaGraphErrorPayload };
}

async function graphGet(
  url: string,
  token: string,
): Promise<{ permalink?: string; status_code?: string; status?: string; error?: MetaGraphErrorPayload }> {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}access_token=${encodeURIComponent(token)}`, {
    signal: AbortSignal.timeout(30_000),
  });
  return (await res.json()) as {
    permalink?: string;
    status_code?: string;
    status?: string;
    error?: MetaGraphErrorPayload;
  };
}

/**
 * Polls Instagram media container status until FINISHED or ERROR, or timeout.
 * Instagram media processing can take a few seconds before /media_publish succeeds.
 */
async function waitForIgContainer(
  containerId: string,
  token: string,
  maxWaitMs = 30_000,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await graphGet(`${GRAPH_HOST}/${GRAPH_VERSION}/${containerId}?fields=status_code,status`, token);
    if (res.error) {
      return { ok: false, message: formatMetaGraphError(res.error) };
    }

    const code = res.status_code?.toUpperCase();
    if (code === "FINISHED") {
      return { ok: true };
    }
    if (code === "ERROR" || code === "EXPIRED") {
      return { ok: false, message: `Instagram media container failed (${res.status ?? code}).` };
    }

    // In progress — wait 2 seconds before polling again
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // If timeout reached, return ok: true to attempt publish anyway (might succeed)
  return { ok: true };
}

/**
 * Publish via official Meta Graph API.
 * Facebook: feed post (text), photo (with image), or video (with video).
 * Instagram: container flow (image or reels) -> status poll -> media_publish.
 */
export async function publishPost(input: PublishInput): Promise<PublishResult> {
  try {
    if (input.platform === "facebook") {
      let postId: string | undefined;

      if (input.videoUrl) {
        const r = await graphPost(`${input.pageId}/videos`, input.pageToken, {
          file_url: input.videoUrl,
          description: input.message,
        });
        if (r.error) return { ok: false, reason: "graph_error", message: formatMetaGraphError(r.error) };
        postId = r.id;
      } else if (input.imageUrl) {
        const r = await graphPost(`${input.pageId}/photos`, input.pageToken, {
          url: input.imageUrl,
          caption: input.message,
        });
        if (r.error) return { ok: false, reason: "graph_error", message: formatMetaGraphError(r.error) };
        postId = r.id;
      } else {
        const r = await graphPost(`${input.pageId}/feed`, input.pageToken, {
          message: input.message,
        });
        if (r.error) return { ok: false, reason: "graph_error", message: formatMetaGraphError(r.error) };
        postId = r.id;
      }

      if (!postId) {
        return { ok: false, reason: "graph_error", message: "Facebook returned no post ID." };
      }

      const postDetails = await graphGet(
        `${GRAPH_HOST}/${GRAPH_VERSION}/${postId}?fields=permalink_url,permalink`,
        input.pageToken,
      );
      const permalink = postDetails.permalink ?? (postDetails as { permalink_url?: string }).permalink_url ?? null;

      return { ok: true, postId, permalink };
    }

    // Instagram
    if (!input.igUserId) {
      return {
        ok: false,
        reason: "no_ig",
        message: "No Instagram Professional account linked to this page. Connect one on the Connections page.",
      };
    }

    if (!input.imageUrl && !input.videoUrl) {
      return {
        ok: false,
        reason: "no_visual",
        message: "Instagram posts require an image or video visual. Generate a visual for this content item first.",
      };
    }

    // Step 1: Create media container
    const containerParams: Record<string, string> = {
      caption: input.message,
    };
    if (input.videoUrl) {
      containerParams.media_type = "REELS";
      containerParams.video_url = input.videoUrl;
    } else if (input.imageUrl) {
      containerParams.image_url = input.imageUrl;
    }

    const container = await graphPost(`${input.igUserId}/media`, input.pageToken, containerParams);
    if (container.error) {
      return { ok: false, reason: "graph_error", message: formatMetaGraphError(container.error) };
    }
    if (!container.id) {
      return { ok: false, reason: "graph_error", message: "Instagram container creation returned no container ID." };
    }

    // Step 2: Poll container status until ready
    const statusPoll = await waitForIgContainer(container.id, input.pageToken);
    if (!statusPoll.ok) {
      return { ok: false, reason: "container_processing_failed", message: statusPoll.message };
    }

    // Step 3: Publish media container
    const published = await graphPost(`${input.igUserId}/media_publish`, input.pageToken, {
      creation_id: container.id,
    });
    if (published.error) {
      return { ok: false, reason: "graph_error", message: formatMetaGraphError(published.error) };
    }
    if (!published.id) {
      return { ok: false, reason: "graph_error", message: "Instagram publish returned no published media ID." };
    }

    // Step 4: Resolve permalink
    const mediaDetails = await graphGet(
      `${GRAPH_HOST}/${GRAPH_VERSION}/${published.id}?fields=permalink`,
      input.pageToken,
    );
    const permalink = mediaDetails.permalink ?? null;

    return { ok: true, postId: published.id, permalink };
  } catch (error) {
    return {
      ok: false,
      reason: "network",
      message: error instanceof Error ? error.message : "Meta Graph API request failed.",
    };
  }
}

