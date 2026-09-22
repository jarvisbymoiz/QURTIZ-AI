import "server-only";

import { GRAPH_HOST, GRAPH_VERSION, formatMetaGraphError, logMetaDiagnostic, type MetaGraphErrorPayload } from "./oauth";

export type PublishInput = {
  pageToken: string;
  pageId: string;
  igUserId: string | null;
  platform: "facebook" | "instagram";
  message: string;
  imageUrl: string | null; // publicly reachable URL (signed, up to 7 days)
  /** Ordered carousel image URLs (2+ -> a real carousel post). */
  imageUrls?: string[] | null;
  videoUrl?: string | null;
  contentKind?: "post" | "story" | "reel";
};

export type PublishResult =
  | { ok: true; postId: string; permalink: string | null }
  | { ok: false; reason: string; message: string };

// Only an explicit provider rejection is retryable. A timeout/missing ID
// remains an uncertain delivery and must never be automatically replayed.
function mainPostErrorReason(error: MetaGraphErrorPayload): string {
  if ([4, 17, 32, 613].includes(error.code ?? 0)) return "rate_limited";
  if (error.is_transient === true) return "transient_provider";
  return "graph_error";
}

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

async function publishFacebookReel(input: PublishInput): Promise<PublishResult> {
  if (!input.videoUrl) return { ok: false, reason: "no_visual", message: "A Reel requires a video." };
  const start = await graphPost(`${input.pageId}/video_reels`, input.pageToken, { upload_phase: "START" }) as {
    video_id?: string;
    upload_url?: string;
    error?: MetaGraphErrorPayload;
  };
  if (start.error) return { ok: false, reason: mainPostErrorReason(start.error), message: formatMetaGraphError(start.error) };
  if (!start.video_id || !start.upload_url || !start.upload_url.startsWith("https://rupload.facebook.com/")) {
    return { ok: false, reason: "graph_error", message: "Facebook did not return a valid Reel upload session." };
  }

  const upload = await fetch(start.upload_url, {
    method: "POST",
    headers: { Authorization: `OAuth ${input.pageToken}`, file_url: input.videoUrl },
    signal: AbortSignal.timeout(120_000),
  });
  const uploadBody = (await upload.json()) as { success?: boolean; error?: MetaGraphErrorPayload };
  if (!upload.ok || uploadBody.error || uploadBody.success !== true) {
    return { ok: false, reason: "graph_error", message: uploadBody.error ? formatMetaGraphError(uploadBody.error) : "Facebook Reel upload failed." };
  }

  const finish = await graphPost(`${input.pageId}/video_reels`, input.pageToken, {
    video_id: start.video_id,
    upload_phase: "FINISH",
    video_state: "PUBLISHED",
    description: input.message,
  }) as { success?: boolean; error?: MetaGraphErrorPayload };
  if (finish.error) return { ok: false, reason: mainPostErrorReason(finish.error), message: formatMetaGraphError(finish.error) };
  if (finish.success !== true) return { ok: false, reason: "graph_error", message: "Facebook did not accept the Reel for publishing." };
  return { ok: true, postId: start.video_id, permalink: null };
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

  return { ok: false, message: "Instagram is still processing the media. It was not submitted for publishing; retry after processing completes." };
}

/**
 * Publish via official Meta Graph API.
 * Facebook: feed post (text), photo (with image), or video (with video).
 * Instagram: container flow (image or reels) -> status poll -> media_publish.
 */
export async function publishPost(input: PublishInput): Promise<PublishResult> {
  // Ordered image set: a carousel passes imageUrls, the single-image path keeps
  // using imageUrl. A video is NEVER treated as an image.
  const imageUrls = (
    input.imageUrls && input.imageUrls.length > 0 ? input.imageUrls : input.imageUrl ? [input.imageUrl] : []
  ).filter((u): u is string => typeof u === "string" && u.length > 0);

  try {
    if (input.platform === "facebook") {
      let postId: string | undefined;

      if (input.videoUrl && input.contentKind === "reel") {
        return await publishFacebookReel(input);
      } else if (input.videoUrl) {
        // A non-Reel Facebook video uses the standard Page videos edge.
        const r = await graphPost(`${input.pageId}/videos`, input.pageToken, {
          file_url: input.videoUrl,
          description: input.message,
        });
        if (r.error) return { ok: false, reason: mainPostErrorReason(r.error), message: formatMetaGraphError(r.error) };
        postId = r.id;
      } else if (imageUrls.length > 1) {
        // Multi-photo post: upload each photo unpublished, then attach them all
        // to ONE feed post via `attached_media` (current Pages API flow).
        const mediaIds: string[] = [];
        for (const url of imageUrls) {
          const photo = await graphPost(`${input.pageId}/photos`, input.pageToken, {
            url,
            published: "false",
          });
          if (photo.error) {
            return {
              ok: false,
              reason: "carousel_media_failed",
              message: `Facebook carousel photo upload failed (${mediaIds.length}/${imageUrls.length}): ${formatMetaGraphError(photo.error)}`,
            };
          }
          if (!photo.id) {
            return { ok: false, reason: "carousel_media_failed", message: "Facebook returned no photo ID for a carousel image." };
          }
          mediaIds.push(photo.id);
        }
        const feed = await graphPost(`${input.pageId}/feed`, input.pageToken, {
          message: input.message,
          attached_media: JSON.stringify(mediaIds.map((id) => ({ media_fbid: id }))),
        });
        if (feed.error) return { ok: false, reason: mainPostErrorReason(feed.error), message: formatMetaGraphError(feed.error) };
        postId = feed.id;
      } else if (imageUrls.length === 1) {
        const r = await graphPost(`${input.pageId}/photos`, input.pageToken, {
          url: imageUrls[0],
          caption: input.message,
        });
        if (r.error) return { ok: false, reason: mainPostErrorReason(r.error), message: formatMetaGraphError(r.error) };
        postId = r.id;
      } else {
        const r = await graphPost(`${input.pageId}/feed`, input.pageToken, {
          message: input.message,
        });
        if (r.error) return { ok: false, reason: mainPostErrorReason(r.error), message: formatMetaGraphError(r.error) };
        postId = r.id;
      }

      if (!postId) {
        return { ok: false, reason: "unknown_outcome", message: "Facebook returned no post ID; verify delivery before retrying." };
      }

      const postDetails = await graphGet(
        `${GRAPH_HOST}/${GRAPH_VERSION}/${postId}?fields=permalink_url,permalink`,
        input.pageToken,
      ).catch(() => ({} as { permalink?: string }));
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

    if (!input.videoUrl && imageUrls.length === 0) {
      return {
        ok: false,
        reason: "no_visual",
        message: "Instagram posts require an image or video visual. Generate a visual for this content item first.",
      };
    }

    // Step 1: build the container(s).
    //  - reel/video  : one REELS container (media_type + video_url)
    //  - carousel    : N child containers (is_carousel_item) + a parent CAROUSEL
    //                  container referencing the child ids
    //  - single image: one image container (unchanged behavior)
    let containerId: string | undefined;

    if (input.videoUrl) {
      const container = await graphPost(`${input.igUserId}/media`, input.pageToken, {
        media_type: "REELS",
        video_url: input.videoUrl,
        caption: input.message,
      });
      if (container.error) return { ok: false, reason: mainPostErrorReason(container.error), message: formatMetaGraphError(container.error) };
      containerId = container.id;
    } else if (imageUrls.length > 1) {
      const childIds: string[] = [];
      for (const url of imageUrls) {
        const child = await graphPost(`${input.igUserId}/media`, input.pageToken, {
          image_url: url,
          is_carousel_item: "true",
        });
        if (child.error) {
          return {
            ok: false,
            reason: "carousel_media_failed",
            message: `Instagram carousel child container failed (${childIds.length}/${imageUrls.length}): ${formatMetaGraphError(child.error)}`,
          };
        }
        if (!child.id) {
          return { ok: false, reason: "carousel_media_failed", message: "Instagram returned no child container ID." };
        }
        childIds.push(child.id);
      }
      const parent = await graphPost(`${input.igUserId}/media`, input.pageToken, {
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption: input.message,
      });
      if (parent.error) return { ok: false, reason: mainPostErrorReason(parent.error), message: formatMetaGraphError(parent.error) };
      containerId = parent.id;
    } else {
      const container = await graphPost(`${input.igUserId}/media`, input.pageToken, {
        image_url: imageUrls[0],
        caption: input.message,
      });
      if (container.error) return { ok: false, reason: mainPostErrorReason(container.error), message: formatMetaGraphError(container.error) };
      containerId = container.id;
    }

    if (!containerId) {
      return { ok: false, reason: "graph_error", message: "Instagram container creation returned no container ID." };
    }

    // Step 2: poll until the container finishes processing.
    const statusPoll = await waitForIgContainer(containerId, input.pageToken);
    if (!statusPoll.ok) {
      return { ok: false, reason: "container_processing_failed", message: statusPoll.message };
    }

    // Step 3: publish the container.
    const published = await graphPost(`${input.igUserId}/media_publish`, input.pageToken, {
      creation_id: containerId,
    });
    if (published.error) return { ok: false, reason: mainPostErrorReason(published.error), message: formatMetaGraphError(published.error) };
    if (!published.id) {
      return { ok: false, reason: "unknown_outcome", message: "Instagram publish returned no published media ID; verify delivery before retrying." };
    }

    const mediaDetails = await graphGet(
      `${GRAPH_HOST}/${GRAPH_VERSION}/${published.id}?fields=permalink`,
      input.pageToken,
    ).catch(() => ({} as { permalink?: string }));
    return { ok: true, postId: published.id, permalink: mediaDetails.permalink ?? null };
  } catch (error) {
    return {
      ok: false,
      reason: "network",
      message: error instanceof Error ? error.message : "Meta Graph API request failed.",
    };
  }
}



/* -- First comment ---------------------------------------------------------
 * A first comment is a SEPARATE Graph API object, so it is created with its own
 * request AFTER the main post exists:
 *   - Facebook  : POST /{post-id}/comments      (Page access token)
 *   - Instagram : POST /{ig-media-id}/comments  (Page access token; the media id
 *                 returned by media_publish is the target)
 * It is NEVER sent as a field of the main post payload. */

export type FirstCommentResult =
  | { ok: true; commentId: string; status: number }
  | {
      ok: false;
      /** "permission_required" = the app does not (yet) hold the permission
       *  needed to comment (not granted by the user, or not approved for the
       *  app in Live mode / App Review). Terminal: never retried blindly.
       *  "unsupported" = Meta will never accept a comment on this object. */
      reason: "permission_required" | "unsupported" | "graph_error" | "network";
      message: string;
      code?: number;
      subcode?: number;
      status?: number;
    };

/** Capability rejections that mean "this object cannot take a comment". */
function isUnsupportedCommentError(error?: MetaGraphErrorPayload): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  if (error.code === 3) return true; // capability/permission on this node
  return (
    message.includes("not support") ||
    message.includes("unsupport") ||
    message.includes("cannot be commented") ||
    message.includes("comments are disabled") ||
    message.includes("does not allow comment") ||
    message.includes("media type")
  );
}

/**
 * Permission / App-Review rejections. Meta surfaces these as:
 *   code 10  - the app does not have permission for this action
 *   code 200 - permissions error (the user has not granted the permission)
 *   code 283 - the app permission is not available for this app (App Review /
 *              Live mode required)
 * They are terminal for our retry logic: retrying cannot grant a permission.
 */
function isPermissionCommentError(error?: MetaGraphErrorPayload): boolean {
  if (!error) return false;
  if (error.code === 10 || error.code === 200 || error.code === 283) return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("permission") ||
    message.includes("app review") ||
    message.includes("not approved") ||
    message.includes("has not authorized") ||
    message.includes("does not have permission")
  );
}

/**
 * Create the first comment on an already-published Meta post/media.
 *
 * Endpoints (current Graph API):
 *   Facebook  -> POST /{post-id}/comments       with the Page access token
 *   Instagram -> POST /{ig-media-id}/comments   with the Page access token of
 *                the Page linked to the IG Professional account
 * The comment is ALWAYS a separate request, never a field of the main post.
 * An empty comment returns early and never touches the network.
 */
export async function publishFirstComment(input: {
  platform: "facebook" | "instagram";
  pageToken: string;
  /** Facebook post id OR Instagram media id returned by the main publish. */
  postId: string;
  message: string;
}): Promise<FirstCommentResult> {
  const text = (input.message ?? "").trim();
  const endpointPath = `${GRAPH_VERSION}/${input.postId}/comments`;

  if (text.length === 0) {
    return { ok: false, reason: "unsupported", message: "No first comment to publish." };
  }
  if (!input.postId) {
    return { ok: false, reason: "graph_error", message: "Missing post/media id for the first comment." };
  }

  // Logged for diagnostics; the token itself is NEVER logged (the logger strips
  // the query string and no credential is passed to it).
  const tokenType = input.platform === "instagram" ? "page_token_for_ig_business" : "page_token";

  try {
    const params = new URLSearchParams({ message: text, access_token: input.pageToken });
    const res = await fetch(`${GRAPH_HOST}/${endpointPath}`, {
      method: "POST",
      body: params,
      signal: AbortSignal.timeout(30_000),
    });

    let json: { id?: string; error?: MetaGraphErrorPayload } = {};
    try {
      json = (await res.json()) as typeof json;
    } catch {
      json = {};
    }

    logMetaDiagnostic("first_comment", endpointPath, res.status, json.error, {
      platform: input.platform,
      tokenType,
      objectId: input.postId,
    });

    if (json.error) {
      const reason = isPermissionCommentError(json.error)
        ? "permission_required"
        : isUnsupportedCommentError(json.error)
          ? "unsupported"
          : "graph_error";
      return {
        ok: false,
        reason,
        message: formatMetaGraphError(json.error),
        status: res.status,
        ...(typeof json.error.code === "number" ? { code: json.error.code } : {}),
        ...(typeof json.error.error_subcode === "number" ? { subcode: json.error.error_subcode } : {}),
      };
    }
    if (!res.ok) {
      return { ok: false, reason: "graph_error", message: `Meta returned HTTP ${res.status}.`, status: res.status };
    }
    if (!json.id) {
      return { ok: false, reason: "graph_error", message: "Meta returned no comment ID.", status: res.status };
    }
    return { ok: true, commentId: json.id, status: res.status };
  } catch (error) {
    return {
      ok: false,
      reason: "network",
      message: error instanceof Error ? error.message : "Meta first-comment request failed.",
    };
  }
}
