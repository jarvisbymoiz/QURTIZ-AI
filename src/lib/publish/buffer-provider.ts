import "server-only";

import { createPost } from "@/lib/buffer/client";

/**
 * Buffer publishing provider (provider="buffer").
 *
 * The post is created via Buffer's documented GraphQL createPost mutation
 * with `mode: customScheduled` and dueAt ≈ now + 60s (publish-at-due-time),
 * so Buffer's free-plan queue cap (10 scheduled updates/channel) never
 * accumulates — at most one ~60s window of updates exists per channel.
 *
 * NOTE: createPost has NO documented media input yet — visuals are NOT
 * attached ("buffer media attach pending documented API support"). The caller
 * (attemptBufferPublish) records mediaAttached: false in the publishing job
 * result when the content variant has a visual, so nothing is silently
 * dropped. Do not invent a media field until Buffer documents one.
 */
export const BUFFER_PUBLISH_DELAY_MS = 60_000;

export type BufferPublishInput = {
  channelId: string; // Buffer channel id (connection.channelRef)
  accessToken: string; // decrypted Buffer access token (envelope.accessToken)
  text: string; // caption + hashtags
};

export type BufferPublishResult =
  | { ok: true; updateId: string; status: string; scheduledAt: Date }
  | { ok: false; reason: string; message: string };

/**
 * Queue one post in Buffer for a due publishing job. The caller
 * (publishDueScan worker) owns the publishing job lifecycle — statuses,
 * attempts, notifications — exactly like it does for the Meta path.
 */
export async function publishViaBuffer(input: BufferPublishInput): Promise<BufferPublishResult> {
  const dueAt = new Date(Date.now() + BUFFER_PUBLISH_DELAY_MS);
  const res = await createPost(input.accessToken, { channelId: input.channelId, text: input.text, dueAt });
  if (!res.ok) return { ok: false, reason: res.reason, message: res.message };

  // Prefer the dueAt Buffer echoed back; fall back to the value we sent.
  const scheduledAt = res.data.dueAt ? new Date(res.data.dueAt) : dueAt;
  return { ok: true, updateId: res.data.id, status: res.data.status, scheduledAt };
}
