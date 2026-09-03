import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { createUpdate } from "@/lib/buffer/client";

/**
 * Buffer publishing provider (provider="buffer").
 *
 * Input is the due publishing job's assembled content context (caption +
 * hashtags, latest visual storage path — the same assembly the Meta path in
 * lib/jobs/workflows.ts performs). The visual is attached as a FRESH signed
 * public URL minted at fire time (Buffer has no upload endpoint; Supabase
 * signed URLs on "brand-assets" expire after ~6 days, mirroring the Meta
 * path's 6-day expiry precedent).
 *
 * The update is created with scheduled_at ≈ now + 60s (publish-at-due-time),
 * so Buffer's free-plan queue cap (10 scheduled updates/channel) never
 * accumulates — at most one ~60s window of updates exists per channel.
 */
export const BUFFER_PUBLISH_DELAY_MS = 60_000;
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 6; // ~6 days, matches the Meta path

export type BufferPublishInput = {
  workspaceId: string; // storage bucket scoping (service-role client)
  channelId: string; // Buffer profile id (connection.channelRef)
  accessToken: string; // decrypted Buffer access token
  text: string; // caption + hashtags
  visualStoragePath: string | null; // latest visual for the item, if any
};

export type BufferPublishResult =
  | { ok: true; updateId: string; status: string; scheduledAt: Date }
  | { ok: false; reason: string; message: string };

/**
 * Queue one update in Buffer for a due publishing job. The caller
 * (publishDueScan worker) owns the publishing job lifecycle — statuses,
 * attempts, notifications — exactly like it does for the Meta path.
 */
export async function publishViaBuffer(input: BufferPublishInput): Promise<BufferPublishResult> {
  let mediaUrl: string | null = null;
  if (input.visualStoragePath) {
    try {
      const { data } = await createServiceClient()
        .storage.from("brand-assets")
        .createSignedUrl(input.visualStoragePath, SIGNED_URL_EXPIRY_SECONDS);
      mediaUrl = data?.signedUrl ?? null;
    } catch {
      mediaUrl = null;
    }
    if (!mediaUrl) {
      return {
        ok: false,
        reason: "media_url",
        message:
          "Could not generate a public URL for the attached visual (Supabase storage unreachable) — the post was not queued.",
      };
    }
  }

  const scheduledAt = new Date(Date.now() + BUFFER_PUBLISH_DELAY_MS);
  const res = await createUpdate({
    accessToken: input.accessToken,
    channelId: input.channelId,
    text: input.text,
    mediaUrl,
    scheduledAt,
  });
  if (!res.ok) return { ok: false, reason: res.reason, message: res.message };

  return { ok: true, updateId: res.data.id, status: res.data.status, scheduledAt };
}
