import "server-only";

/**
 * Centralized publishing service.
 *
 * The single public surface for everything that publishes to a connected
 * social account. All four entry points — Calendar Publish Now, Calendar
 * Schedule, AI Chat create_content schedule, Auto Run due jobs, bulk, and
 * retry — funnel through this module's three functions: `publishNow`,
 * `schedulePost`, `retryFailedPublish`.
 *
 * The service is provider-independent: it resolves the workspace's active
 * platform connection (provider-scoped: a workspace may hold both a "meta"
 * and a "buffer" row for the same platform), routes to the right adapter,
 * stamps the per-job provider on the publishing_jobs row, and persists
 * honest statuses/attempts/lastError/result. No call site imports provider
 * code directly — the only direct `createPost`/`publishPost` callers live
 * in `lib/buffer/client.ts` and `lib/meta/publish.ts` (and inside this
 * service module).
 *
 * Idempotency: the publishing_jobs row carries `providerPostId`. A job that
 * has already been accepted by the platform and stored that id must NEVER
 * be re-fired — `retryFailedPublish` and the worker's claim guard against
 * that.
 *
 * Buffer token lifecycle (all inside this module + lib/buffer/client):
 *   - PROACTIVE refresh in `resolvePublishConnection` when the stored expiry
 *     is < 5 min away (shared in-flight promise per connection — Buffer
 *     refresh tokens are single-use).
 *   - REACTIVE refresh-once-then-retry on a 401; if the retry still 401s the
 *     connection row is marked `expired` (ONLY on that real failure — never
 *     at boot) and the caller receives reason `auth_expired`.
 *   - Stale-overwrite guard: a refreshed envelope persists only if the DB
 *     row still holds the token the refresh started from.
 *   - Pre-publish channel validation (5-min success cache): the Buffer
 *     channel must still exist and match the platform → `channel_invalid`.
 *   - schedulePost refuses to create a job when NO connected connection
 *     exists for the platform in either provider (no doomed jobs, no silent
 *     Meta routing).
 */

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { contentItems, contentVariants, platformConnections, publishingJobs } from "@/db/schema";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { resolvePublishProviderForPlatform, type ContentPlatform, type PublishProvider } from "@/lib/publish/provider";
import {
  applyRefreshedToken,
  createPostForBuffer,
  decodeBufferTokenEnvelope,
  listChannels,
  logBufferOAuthDiagnostic,
  refreshAccessToken,
  type BufferPostMode,
  type BufferPostType,
  type BufferService,
  type BufferTokenEnvelope,
} from "@/lib/buffer/client";
import { publishPost } from "@/lib/meta/publish";
import { createServiceClient } from "@/lib/supabase/service";
import { desc } from "drizzle-orm";
import { visualAssets } from "@/db/schema";
import { workspaces } from "@/db/schema";

/* ── Public types ─────────────────────────────────────────────────── */

export type PublishMode = BufferPostMode; // "shareNow" | "customScheduled"
export type ContentKind = BufferPostType; // "post" | "story" | "reel"

export type ResolvedConnection =
  | {
      ok: true;
      provider: "meta" | "buffer";
      platform: ContentPlatform;
      /** platformConnections row id — cache/lock key for refresh + channel
       *  validation (NOT the provider's channel id; that is channelRef). */
      connectionId: string;
      channelRef: string | null; // Buffer channel id (null for meta)
      /** Buffer org id from the connection meta (null for meta / absent). */
      organizationId: string | null;
      encryptedToken: string;
      accessToken: string; // decrypted Buffer access token OR Meta page token
      refreshToken: string | null; // Buffer envelope refresh token (null for meta)
      envelope: ReturnType<typeof decodeBufferTokenEnvelope>;
    }
  | { ok: false; reason: string; message: string };

export type PublishResult =
  | {
      ok: true;
      provider: "meta" | "buffer";
      mode: PublishMode;
      providerPostId: string;
      scheduledAt: Date;
      /** True when the published post carries its media (Buffer: the image
       *  asset was sent with the mutation; Meta: the image URL was uploaded).
       *  A variant visual that cannot be reached fails the publish instead. */
      mediaAttached: boolean;
    }
  | { ok: false; reason: string; message: string };

export type ScheduleResult =
  | {
      ok: true;
      jobId: string;
      scheduledAt: Date;
      /** Provider snapshot stamped on the job (matches the resolved
       *  connection — the worker routes through exactly this adapter). */
      provider: "meta" | "buffer";
      /** Buffer channel id (null for meta) so callers (AI agent, UI) can
       *  state the destination truthfully. */
      channelRef: string | null;
    }
  | { ok: false; reason: string; message: string };

export type RetryResult = PublishResult;

/* ── Pure helpers (unit-testable, no DB) ──────────────────────────── */

/**
 * Map a content variant's format to Buffer's documented metadata `type`.
 * Single-image/carousel/text-post are all "post"; only explicit "story" /
 * "reel" formats become their own kind. Default is "post" — Buffer REQUIRES
 * the per-channel `metadata[service].type` field on facebook/instagram, so
 * it must always be set. The variant's platform maps directly to the
 * Buffer service identifier (facebook / instagram) and is plumbed through
 * `buildBufferPayload` so the mutation builder can stamp
 * `metadata.<service>.type` against Buffer's current GraphQL schema.
 */
export function deriveContentKind(format: string | null | undefined): ContentKind {
  if (format === "story") return "story";
  if (format === "reel") return "reel";
  return "post";
}

/** Map a workspace `ContentPlatform` to Buffer's per-channel service
 *  identifier. Buffer's channel.service string is exactly "facebook" /
 *  "instagram" for the two services this product publishes to. */
export function platformToBufferService(platform: ContentPlatform): BufferService {
  return platform;
}

/** Build the publish call's argument bag. Pure — used by tests + the
 *  publishNow/schedulePost paths so they share the same shape. The returned
 *  object is exactly what `createPostForBuffer` accepts; passing it through
 *  verbatim is the simplest way to keep the wire shape and the service
 *  signature in lock-step. */
export function buildBufferPayload(args: {
  channelId: string;
  text: string;
  mode: PublishMode;
  contentKind: ContentKind;
  service: BufferService;
  dueAt?: Date;
}): {
  channelId: string;
  text: string;
  mode: PublishMode;
  contentKind: ContentKind;
  service: BufferService;
  dueAt?: Date;
} {
  if (args.mode === "customScheduled" && !args.dueAt) {
    // The variables builder requires dueAt for customScheduled; surface the
    // invariant violation here so callers fail fast (instead of receiving a
    // Buffer MutationError with an opaque JSON-shaped message).
    throw new Error("buildBufferPayload: customScheduled requires dueAt");
  }
  if (args.mode === "shareNow" && args.dueAt) {
    throw new Error("buildBufferPayload: shareNow forbids dueAt");
  }
  // Runtime contentKind guard: TypeScript unions are compile-time only, so a
  // stale caller (or JS consumer) must fail here — with a typed
  // PublishingError — rather than producing an opaque Buffer enum error.
  if (args.contentKind !== "post" && args.contentKind !== "reel" && args.contentKind !== "story") {
    throw new PublishingError({
      code: "invalid_content_kind",
      message: `Invalid content kind ${JSON.stringify(String(args.contentKind))} — must be exactly "post", "reel" or "story".`,
      provider: "buffer",
      step: "create_post",
    });
  }
  return {
    channelId: args.channelId,
    text: args.text,
    mode: args.mode,
    contentKind: args.contentKind,
    service: args.service,
    dueAt: args.dueAt,
  };
}

/* ── DB helpers ───────────────────────────────────────────────────── */

/** Refresh a token whose expiry is under 5 minutes away (Buffer returns
 *  expires_in on connect/refresh; envelopes without expiresAt can't be
 *  probed and rely on the reactive 401 path). */
const PROACTIVE_REFRESH_MARGIN_MS = 5 * 60_000;

/** Pure predicate (unit-testable): proactive-refresh decision for a decoded
 *  Buffer envelope. Requires BOTH an expiry AND a refresh token — without a
 *  refresh token there is nothing to rotate. */
export function shouldProactivelyRefresh(envelope: BufferTokenEnvelope | null, nowMs: number): boolean {
  if (!envelope) return false;
  if (typeof envelope.expiresAt !== "number") return false;
  if (!envelope.refreshToken) return false;
  return envelope.expiresAt - nowMs < PROACTIVE_REFRESH_MARGIN_MS;
}

/** Outcome of a locked token rotation. */
type RefreshOutcome =
  | { ok: true; envelope: BufferTokenEnvelope }
  | { ok: false; message: string };

/**
 * Module-level in-flight refresh lock keyed by connection row id: concurrent
 * publishes on the same connection share ONE refresh promise (Buffer refresh
 * tokens are SINGLE-USE — two parallel refreshes would rotate the token
 * twice and strand the loser's refresh_token).
 */
const refreshInFlight = new Map<string, Promise<RefreshOutcome>>();

/**
 * Rotate a Buffer access token (refresh once, persist with a stale-overwrite
 * guard) and return the envelope the caller MUST use afterwards.
 *
 * Stale-overwrite guard: the refreshed envelope is persisted ONLY if the DB
 * row's access token still equals the one the refresh started from (compared
 * via decrypt). If another process already rotated the token, its newer
 * envelope is returned untouched instead of overwriting it with ours.
 */
async function rotateBufferToken(args: {
  connectionId: string;
  startedFromAccessToken: string;
  currentEnvelope: BufferTokenEnvelope;
}): Promise<RefreshOutcome> {
  const existing = refreshInFlight.get(args.connectionId);
  if (existing) return existing;
  const promise = (async (): Promise<RefreshOutcome> => {
    const db = getDb();
    if (!args.currentEnvelope.refreshToken) {
      return { ok: false, message: "No refresh token stored — reconnect the Buffer account." };
    }
    const refreshed = await refreshAccessToken({ refreshToken: args.currentEnvelope.refreshToken });
    if (!refreshed.ok) {
      return { ok: false, message: refreshed.message };
    }
    const next = applyRefreshedToken(args.currentEnvelope, refreshed.data);
    // Stale-overwrite guard: re-read the row and compare via decrypt.
    const [row] = await db
      .select()
      .from(platformConnections)
      .where(eq(platformConnections.id, args.connectionId));
    const dbPlain = row?.encryptedToken ? decryptToken(row.encryptedToken) : null;
    const dbEnvelope = dbPlain ? decodeBufferTokenEnvelope(dbPlain) : null;
    if (dbEnvelope && dbEnvelope.accessToken !== args.startedFromAccessToken) {
      // Another writer (different server instance) already rotated the token —
      // keep THEIR envelope; ours (and its single-use refresh token) are dead.
      return { ok: true, envelope: dbEnvelope };
    }
    await db
      .update(platformConnections)
      .set({
        encryptedToken: encryptToken(JSON.stringify(next)),
        updatedAt: new Date(),
      })
      .where(eq(platformConnections.id, args.connectionId));
    return { ok: true, envelope: next };
  })().finally(() => refreshInFlight.delete(args.connectionId));
  refreshInFlight.set(args.connectionId, promise);
  return promise;
}

/** Mark a connection expired after a hard auth failure (a REAL 401 during a
 *  publish/refresh — never at boot or on a timer). */
async function markConnectionExpired(connectionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(platformConnections)
    .set({ status: "expired", updatedAt: new Date() })
    .where(eq(platformConnections.id, connectionId));
}

/** The honest user-facing auth-expired failure (exact message reused by the
 *  Connections page hint). */
const AUTH_EXPIRED_MESSAGE = "Buffer session expired — reconnect on the Connections page.";

/* ── Pre-publish channel validation ──────────────────────────────────── */

/** Successful channel validations are cached per connectionId+channelRef for
 *  5 minutes so a publish never pays the extra channels query more than once
 *  per TTL. Failures are deliberately NOT cached — a reconnect re-enables
 *  publishing immediately (the reconnect itself swaps token/channel on the
 *  same row id). */
const CHANNEL_VALIDATION_TTL_MS = 5 * 60_000;
const channelValidationCache = new Map<string, { expiresAt: number; ok: true }>();

/**
 * Verify the Buffer channel right before createPost: it must still exist on
 * the account, its `service` must match the publishing platform, and the
 * query itself must succeed with the current token. One authenticated
 * channels query per publish (cache-hit: zero).
 *
 * Buffer's Channel object may expose locked/paused flags, but those fields
 * were auth-gated at introspection time and are NOT requested here — we only
 * select the verified { id name service } shape, so unavailability checks
 * beyond existence/service skip silently rather than risk failing every
 * publish on an unverified field.
 */
async function validateBufferChannel(args: {
  connectionId: string;
  accessToken: string;
  channelRef: string;
  platform: ContentPlatform;
  organizationId: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const cacheKey = `${args.connectionId}:${args.channelRef}`;
  const cached = channelValidationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ok: true };

  if (!args.organizationId) {
    return {
      ok: false,
      message: "Buffer connection is missing its organization reference — reconnect the Buffer account.",
    };
  }
  const listed = await listChannels(args.accessToken, args.organizationId);
  if (!listed.ok) {
    return { ok: false, message: `Buffer channel check failed: ${listed.message}` };
  }
  const channel = listed.data.find((c) => c.id === args.channelRef);
  if (!channel) {
    return {
      ok: false,
      message: "The connected Buffer channel is no longer available on the account — reconnect the Buffer account.",
    };
  }
  if (channel.service !== args.platform) {
    return {
      ok: false,
      message: `Buffer channel service mismatch (expected ${args.platform}, got ${channel.service}) — reconnect the Buffer account.`,
    };
  }
  channelValidationCache.set(cacheKey, { expiresAt: Date.now() + CHANNEL_VALIDATION_TTL_MS, ok: true });
  return { ok: true };
}

/** Resolve the workspace's active publish connection for (workspaceId,
 *  platform) and return the decrypted token envelope (Buffer) or the page
 *  token (Meta). The caller uses the same shape for both providers —
 *  Meta just leaves refreshToken/envelope as null.
 *
 * Buffer tokens are proactively refreshed here when the stored expiry is
 * under 5 minutes away (shared in-flight promise per connection) — the
 * reactive 401 path below remains the fallback for envelopes without an
 * expiry. A failed PROACTIVE refresh never fails the resolve: the current
 * token may still be valid, and a real 401 downstream is handled (and marks
 * the connection expired) there. */
export async function resolvePublishConnection(
  workspaceId: string,
  platform: ContentPlatform,
): Promise<ResolvedConnection> {
  const db = getDb();
  const provider = await resolvePublishProviderForPlatform(workspaceId, platform);
  const [conn] = await db
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.workspaceId, workspaceId),
        eq(platformConnections.platform, platform),
        eq(platformConnections.provider, provider),
      ),
    );
  if (!conn || conn.status !== "connected" || !conn.encryptedToken) {
    return {
      ok: false,
      reason: "not_connected",
      message: `No connected ${platform === "facebook" ? "Facebook" : "Instagram"} account. Connect one on the Connections page.`,
    };
  }
  const plain = decryptToken(conn.encryptedToken);
  if (!plain) {
    return {
      ok: false,
      reason: "decrypt_failed",
      message: "Stored access token could not be decrypted — reconnect the account.",
    };
  }
  if (provider === "buffer") {
    let envelope = decodeBufferTokenEnvelope(plain);
    if (!envelope) {
      return {
        ok: false,
        reason: "decrypt_failed",
        message: "Stored Buffer token could not be decrypted — reconnect the account.",
      };
    }
    let accessToken = envelope.accessToken;
    let refreshToken = envelope.refreshToken ?? null;
    const meta = (conn.meta ?? {}) as Record<string, unknown>;
    const organizationId = typeof meta.organizationId === "string" ? meta.organizationId : null;
    // Proactive refresh: expiring soon + refresh token present → rotate BEFORE
    // the call. Serialized per connection via rotateBufferToken's in-flight map.
    if (shouldProactivelyRefresh(envelope, Date.now())) {
      const rotated = await rotateBufferToken({
        connectionId: conn.id,
        startedFromAccessToken: envelope.accessToken,
        currentEnvelope: envelope,
      });
      if (rotated.ok) {
        envelope = rotated.envelope;
        accessToken = envelope.accessToken;
        refreshToken = envelope.refreshToken ?? null;
      } else {
        // Honest + resilient: keep publishing with the current token; a real
        // 401 downstream takes the reactive path (retry → mark expired).
        logBufferOAuthDiagnostic("proactive_refresh_skipped", {
          connectionId: conn.id,
          platform,
          reason: rotated.message.slice(0, 120),
        });
      }
    }
    return {
      ok: true,
      provider,
      platform,
      connectionId: conn.id,
      channelRef: conn.channelRef ?? null,
      organizationId,
      encryptedToken: conn.encryptedToken,
      accessToken,
      refreshToken,
      envelope,
    };
  }
  // Meta: encryptedToken IS the page token (no envelope).
  return {
    ok: true,
    provider,
    platform,
    connectionId: conn.id,
    channelRef: null,
    organizationId: null,
    encryptedToken: conn.encryptedToken,
    accessToken: plain,
    refreshToken: null,
    envelope: null,
  };
}

/** Load the variant + item + latest visual + recipient (workspace creator).
 *  Returns a discriminated result so callers can fail fast before touching
 *  the provider. */
async function loadPublishContext(args: {
  workspaceId: string;
  contentItemId: string;
  contentVariantId: string;
}): Promise<
  | {
      ok: true;
      variant: typeof contentVariants.$inferSelect;
      item: typeof contentItems.$inferSelect;
      visual: { storagePath: string } | null;
      recipientId: string;
    }
  | { ok: false; reason: string; message: string }
> {
  const db = getDb();
  const [variant] = await db
    .select()
    .from(contentVariants)
    .where(eq(contentVariants.id, args.contentVariantId));
  if (!variant) return { ok: false, reason: "not_found", message: "Variant not found." };
  if (variant.contentItemId !== args.contentItemId || variant.workspaceId !== args.workspaceId) {
    return { ok: false, reason: "mismatch", message: "Variant does not belong to this content item." };
  }
  const [item] = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, variant.contentItemId));
  if (!item) return { ok: false, reason: "not_found", message: "Content item not found." };

  const variantPublishable = variant.status === "scheduled" || variant.status === "approved";
  const itemPublishable = item.status === "scheduled" || item.status === "approved";
  if (!variantPublishable || !itemPublishable) {
    return {
      ok: false,
      reason: "not_publishable",
      message: `Publish skipped: item "${item.status}" / variant "${variant.status}" — content is no longer scheduled.`,
    };
  }

  const [visual] = await db
    .select({ storagePath: visualAssets.storagePath })
    .from(visualAssets)
    .where(eq(visualAssets.contentItemId, variant.contentItemId))
    .orderBy(desc(visualAssets.createdAt))
    .limit(1);

  const [ws] = await db
    .select({ createdBy: workspaces.createdBy })
    .from(workspaces)
    .where(eq(workspaces.id, args.workspaceId));
  const recipientId = ws?.createdBy ?? args.workspaceId;
  return { ok: true, variant, item, visual: visual?.storagePath ? { storagePath: visual.storagePath } : null, recipientId };
}

/** Compose caption text from item/variant + hashtags (shared by both
 *  providers so Meta and Buffer publish identical copy). */
function composeMessage(item: typeof contentItems.$inferSelect, variant: typeof contentVariants.$inferSelect): string {
  return [item?.caption ?? variant.caption, (variant.hashtags ?? []).map((h) => `#${h}`).join(" ")]
    .filter(Boolean)
    .join("\n\n");
}

/** For Meta we need a reachable URL on the visual; this is the same signed-URL
 *  helper the worker uses (Supabase service-role client; 6-day expiry). */
async function signedUrlForVisual(storagePath: string): Promise<string | null> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.storage.from("brand-assets").createSignedUrl(storagePath, 60 * 60 * 24 * 6);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** Apply the post-accept flip: variant → published, item → published when
 *  every variant is published. The worker + publishNow both go through this
 *  helper so the side-effects are identical. */
async function flipToPublished(args: {
  workspaceId: string;
  itemId: string;
  variantId: string;
  providerPostId: string;
  jobId?: string;
  result: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  if (args.jobId) {
    await db
      .update(publishingJobs)
      .set({
        status: "published",
        providerPostId: args.providerPostId,
        result: args.result,
        updatedAt: new Date(),
      })
      .where(eq(publishingJobs.id, args.jobId));
  }
  await db
    .update(contentVariants)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(contentVariants.id, args.variantId));
  const allPublished = (
    await db
      .select({ status: contentVariants.status })
      .from(contentVariants)
      .where(eq(contentVariants.contentItemId, args.itemId))
  ).every((v) => v.status === "published");
  if (allPublished) {
    await db
      .update(contentItems)
      .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(contentItems.id, args.itemId));
  }
}

/* ── Public API ───────────────────────────────────────────────────── */

/**
 * Publish a content variant immediately to the connected provider for its
 * platform. Used by Calendar's Publish Now, the AI agent's "post this now"
 * request, and the worker's "in-firing job" path. Persists providerPostId,
 * attempts, status, and flips the variant/item to published on success.
 *
 * Never marks `published` unless the provider response is a success with a
 * real post id — typed failures come back unchanged.
 */
export async function publishNow(args: {
  workspaceId: string;
  contentItemId: string;
  contentVariantId: string;
  platform: ContentPlatform;
  /** Optional caller-supplied job id to mark as published on success
   *  (worker path); publishNow creates a synthetic job when omitted
   *  (Calendar Publish Now path). */
  jobId?: string;
}): Promise<PublishResult> {
  const db = getDb();

  const ctxRes = await loadPublishContext({
    workspaceId: args.workspaceId,
    contentItemId: args.contentItemId,
    contentVariantId: args.contentVariantId,
  });
  if (!ctxRes.ok) return { ok: false, reason: ctxRes.reason, message: ctxRes.message };

  const connRes = await resolvePublishConnection(args.workspaceId, ctxRes.variant.platform);
  if (!connRes.ok) return { ok: false, reason: connRes.reason, message: connRes.message };

  const contentKind = deriveContentKind(ctxRes.variant.format);
  const message = composeMessage(ctxRes.item, ctxRes.variant);

  if (connRes.provider === "buffer") {
    if (!connRes.channelRef) {
      return {
        ok: false,
        reason: "missing_channel",
        message: "Buffer connection is missing its channel reference — reconnect the Buffer account.",
      };
    }
    // Pre-publish channel validation (successes cached 5 min per connection
    // + channel): the channel must still exist on the Buffer account and its
    // service must match the platform being published to.
    const validation = await validateBufferChannel({
      connectionId: connRes.connectionId,
      accessToken: connRes.accessToken,
      channelRef: connRes.channelRef,
      platform: connRes.platform,
      organizationId: connRes.organizationId,
    });
    if (!validation.ok) return { ok: false, reason: "channel_invalid", message: validation.message };

    // Media: Buffer attaches ONE image asset (oneOf-compliant). A visual that
    // cannot get a reachable signed URL fails the publish — same honesty as
    // the Meta path; silently dropping it would change what the post IS.
    let mediaUrl: string | null = null;
    if (ctxRes.visual?.storagePath) {
      mediaUrl = await signedUrlForVisual(ctxRes.visual.storagePath);
      if (!mediaUrl) {
        return {
          ok: false,
          reason: "missing_image_url",
          message: "Could not generate a public URL for the attached visual (Supabase storage unreachable) — the post was not published.",
        };
      }
    }
    // firstComment: the variant's platform-specific first comment wins; the
    // item-level one is the fallback. Sent inside the per-channel metadata
    // (metadata.<service>.firstComment) — never as a separate top-level field.
    const firstComment = ctxRes.variant.firstComment ?? ctxRes.item.firstComment ?? null;
    const bufferService = platformToBufferService(connRes.platform);
    const argsForCall = {
      channelId: connRes.channelRef,
      text: message,
      mode: "shareNow" as PublishMode,
      contentKind,
      service: bufferService,
      mediaUrl,
      firstComment,
    };
    let res = await createPostForBuffer(connRes.accessToken, argsForCall);
    if (!res.ok && res.reason === "auth") {
      // Reactive refresh (exactly once) — serialized per connection and
      // stale-overwrite-guarded inside rotateBufferToken.
      const rotated = await rotateBufferToken({
        connectionId: connRes.connectionId,
        startedFromAccessToken: connRes.accessToken,
        currentEnvelope: connRes.envelope!,
      });
      if (rotated.ok) {
        res = await createPostForBuffer(rotated.envelope.accessToken, argsForCall);
      }
    }
    if (!res.ok && res.reason === "auth") {
      // The refresh failed or the retry still 401'd: the session is dead.
      // Mark the connection expired on this REAL failure (never at boot) and
      // surface the reconnect message.
      await markConnectionExpired(connRes.connectionId);
      logBufferOAuthDiagnostic("publish_auth_expired", {
        workspaceId: args.workspaceId,
        platform: connRes.platform,
        detail: res.message.slice(0, 120),
      });
      return { ok: false, reason: "auth_expired", message: AUTH_EXPIRED_MESSAGE };
    }
    if (!res.ok) return { ok: false, reason: res.reason, message: res.message };
    const scheduledAt = new Date();
    if (res.data.dueAt) {
      const parsed = new Date(res.data.dueAt);
      if (!Number.isNaN(parsed.getTime())) scheduledAt.setTime(parsed.getTime());
    }
    const result: Record<string, unknown> = {
      updateId: res.data.id,
      status: res.data.status,
      scheduledAt: scheduledAt.toISOString(),
    };
    if (mediaUrl) result.mediaAttached = true; // image asset sent with the mutation
    await flipToPublished({
      workspaceId: args.workspaceId,
      itemId: ctxRes.item.id,
      variantId: ctxRes.variant.id,
      providerPostId: res.data.id,
      jobId: args.jobId,
      result,
    });
    return {
      ok: true,
      provider: "buffer",
      mode: "shareNow",
      providerPostId: res.data.id,
      scheduledAt,
      mediaAttached: mediaUrl !== null,
    };
  }

  // Meta path — imageUrl must be a reachable signed URL when a visual exists.
  let imageUrl: string | null = null;
  if (ctxRes.visual?.storagePath) {
    imageUrl = await signedUrlForVisual(ctxRes.visual.storagePath);
    if (!imageUrl) {
      return {
        ok: false,
        reason: "missing_image_url",
        message: "Could not generate a public URL for the attached visual (Supabase storage unreachable) — the post was not published.",
      };
    }
  }
  const [conn] = await db
    .select()
    .from(platformConnections)
    .where(and(
      eq(platformConnections.workspaceId, args.workspaceId),
      eq(platformConnections.platform, ctxRes.variant.platform),
      eq(platformConnections.provider, "meta"),
    ));
  const connMeta = (conn?.meta ?? {}) as Record<string, string>;
  const result = await publishPost({
    pageToken: connRes.accessToken,
    pageId: String(connMeta.pageId ?? ""),
    igUserId: connMeta.igUserId ?? null,
    platform: ctxRes.variant.platform,
    message,
    imageUrl,
  });
  if (!result.ok) return { ok: false, reason: result.reason, message: result.message };
  const scheduledAt = new Date();
  await flipToPublished({
    workspaceId: args.workspaceId,
    itemId: ctxRes.item.id,
    variantId: ctxRes.variant.id,
    providerPostId: result.postId,
    jobId: args.jobId,
    result: { postId: result.postId, permalink: result.permalink },
  });
  return {
    ok: true,
    provider: "meta",
    mode: "shareNow",
    providerPostId: result.postId,
    scheduledAt,
    mediaAttached: imageUrl ? true : false,
  };
}

/**
 * Schedule (or reschedule) a content variant for a specific UTC slot. The
 * job is created in `pending` status with a snapshotted provider — the worker
 * picks it up via `publishDueScan` and dispatches via publishNow at fire time
 * (the worker also funnels through this module — see `retryFailedPublish` /
 * the worker refactor in `lib/jobs/workflows.ts`).
 *
 * Returns the new publishing_jobs id; the variant + item statuses flip to
 * `scheduled` (matching the existing scheduleItem contract).
 */
export async function schedulePost(args: {
  workspaceId: string;
  contentItemId: string;
  contentVariantId: string;
  platform: ContentPlatform;
  scheduledAt: Date;
}): Promise<ScheduleResult> {
  const db = getDb();
  // Past-time guard lives in `scheduleItem` (calendar-day granularity in the
  // workspace timezone — same-day bookings at an earlier wall-clock stay
  // allowed). `schedulePost` itself just enforces a strict-future invariant;
  // callers that want calendar-day semantics must pass `args.scheduledAt`
  // through their own guard.
  const ctxRes = await loadPublishContext({
    workspaceId: args.workspaceId,
    contentItemId: args.contentItemId,
    contentVariantId: args.contentVariantId,
  });
  if (!ctxRes.ok) return { ok: false, reason: ctxRes.reason, message: ctxRes.message };

  // Connection guard (BEFORE the job row exists): when NO connected
  // connection exists for (workspaceId, platform) in EITHER provider, do not
  // create a doomed job — fail with the reconnect message instead. On
  // success the resolved connection IS the provider snapshot (its row is
  // exactly what the worker will pick up), so job.provider and channelRef
  // are stamped from it verbatim.
  const connRes = await resolvePublishConnection(args.workspaceId, args.platform);
  if (!connRes.ok) return { ok: false, reason: connRes.reason, message: connRes.message };
  const provider: PublishProvider = connRes.provider;

  // Cancel any pre-existing pending job for this variant — reschedule
  // semantics, matching scheduleItem.
  await db
    .delete(publishingJobs)
    .where(and(eq(publishingJobs.contentVariantId, args.contentVariantId), eq(publishingJobs.status, "pending")));

  const [job] = await db
    .insert(publishingJobs)
    .values({
      workspaceId: args.workspaceId,
      contentItemId: args.contentItemId,
      contentVariantId: args.contentVariantId,
      platform: args.platform,
      provider,
      scheduledAt: args.scheduledAt,
      status: "pending",
    })
    .returning();
  if (!job) return { ok: false, reason: "db_error", message: "Failed to create the publishing job." };

  await db
    .update(contentVariants)
    .set({ status: "scheduled", updatedAt: new Date() })
    .where(eq(contentVariants.id, args.contentVariantId));

  // If every variant of this item is now scheduled, flip the item.
  const allScheduled = (
    await db
      .select({ status: contentVariants.status })
      .from(contentVariants)
      .where(eq(contentVariants.contentItemId, args.contentItemId))
  ).every((v) => v.status === "scheduled");
  if (allScheduled) {
    await db
      .update(contentItems)
      .set({ status: "scheduled", scheduledAt: args.scheduledAt, updatedAt: new Date() })
      .where(eq(contentItems.id, args.contentItemId));
  }
  return { ok: true, jobId: job.id, scheduledAt: args.scheduledAt, provider, channelRef: connRes.channelRef };
}

/**
 * Retry a previously failed publishing job. Bounded retry policy:
 *   - Up to MAX attempts total (caller-supplied via job.attempts).
 *   - Transient failures (network, 429, 5xx) are retried with exponential
 *     backoff (PUBLISH_RETRY_BACKOFF_MS * 2^(attempts-1)).
 *   - Permanent failures (auth, content rejected, MutationError) fail
 *     immediately.
 *   - Idempotency: refuses if `providerPostId` is already set — the platform
 *     accepted the post and we must not re-create it.
 *
 * Returns the same PublishResult shape as publishNow so callers can persist
 * + notify from a single path.
 */
export async function retryFailedPublish(args: {
  workspaceId: string;
  jobId: string;
  maxAttempts?: number;
  baseBackoffMs?: number;
}): Promise<RetryResult> {
  const db = getDb();
  const maxAttempts = args.maxAttempts ?? 3;
  const baseBackoffMs = args.baseBackoffMs ?? 5 * 60_000;

  const [job] = await db
    .select()
    .from(publishingJobs)
    .where(and(eq(publishingJobs.id, args.jobId), eq(publishingJobs.workspaceId, args.workspaceId)));
  if (!job) return { ok: false, reason: "not_found", message: "Publishing job not found." };

  // Idempotency guard: providerPostId set means the platform accepted the
  // post on a prior attempt — refuse to re-fire.
  if (job.providerPostId) {
    return { ok: false, reason: "already_published", message: "This post was already accepted by the platform." };
  }
  if (job.status === "published") {
    return { ok: false, reason: "already_published", message: "This job is already marked as published." };
  }
  if (job.status === "cancelled") {
    return { ok: false, reason: "cancelled", message: "This job was cancelled." };
  }

  const ctxRes = await loadPublishContext({
    workspaceId: args.workspaceId,
    contentItemId: job.contentItemId,
    contentVariantId: job.contentVariantId,
  });
  if (!ctxRes.ok) {
    await db
      .update(publishingJobs)
      .set({ status: "failed", lastError: ctxRes.message, updatedAt: new Date() })
      .where(eq(publishingJobs.id, job.id));
    return { ok: false, reason: ctxRes.reason, message: ctxRes.message };
  }

  // Transient retryability: Buffer reasons network/rate_limited/invalid_response
  // are retryable (handled inside the loop below); auth + rejected (4xx content)
  // are permanent and break out immediately.

  const connRes = await resolvePublishConnection(args.workspaceId, ctxRes.variant.platform);
  if (!connRes.ok) {
    await db
      .update(publishingJobs)
      .set({ status: "failed", lastError: connRes.message, updatedAt: new Date() })
      .where(eq(publishingJobs.id, job.id));
    return { ok: false, reason: connRes.reason, message: connRes.message };
  }

  // The worker already does the claim — retryFailedPublish runs from the
  // public API path (UI retry button), so we still increment attempts via
  // an atomic claim here.
  const claimed = await db
    .update(publishingJobs)
    .set({
      status: "processing",
      attempts: sql`${publishingJobs.attempts} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(publishingJobs.id, job.id), eq(publishingJobs.status, "failed")))
    .returning();
  if (claimed.length === 0) {
    // Already moved on (worker picked it up); bail out without state change.
    return { ok: false, reason: "race", message: "Job is being processed by another worker." };
  }
  const currentAttempt = (claimed[0].attempts ?? 1);

  const contentKind = deriveContentKind(ctxRes.variant.format);
  const message = composeMessage(ctxRes.item, ctxRes.variant);

  if (connRes.provider === "buffer") {
    if (!connRes.channelRef) {
      const msg = "Buffer connection is missing its channel reference — reconnect the Buffer account.";
      await db.update(publishingJobs).set({ status: "failed", lastError: msg, updatedAt: new Date() }).where(eq(publishingJobs.id, job.id));
      return { ok: false, reason: "missing_channel", message: msg };
    }
    // Pre-publish channel validation (same 5-min success cache as publishNow).
    const validation = await validateBufferChannel({
      connectionId: connRes.connectionId,
      accessToken: connRes.accessToken,
      channelRef: connRes.channelRef,
      platform: connRes.platform,
      organizationId: connRes.organizationId,
    });
    if (!validation.ok) {
      await db.update(publishingJobs).set({ status: "failed", lastError: validation.message, updatedAt: new Date() }).where(eq(publishingJobs.id, job.id));
      return { ok: false, reason: "channel_invalid", message: validation.message };
    }
    // Media: same honesty as publishNow — an unreachable visual fails the
    // retry instead of silently publishing a different post.
    let mediaUrl: string | null = null;
    if (ctxRes.visual?.storagePath) {
      mediaUrl = await signedUrlForVisual(ctxRes.visual.storagePath);
      if (!mediaUrl) {
        const msg = "Could not generate a public URL for the attached visual (Supabase storage unreachable) — the post was not published.";
        await db.update(publishingJobs).set({ status: "failed", lastError: msg, updatedAt: new Date() }).where(eq(publishingJobs.id, job.id));
        return { ok: false, reason: "missing_image_url", message: msg };
      }
    }
    let attempt = 0;
    let lastReason = "unknown";
    let lastMessage = "";
    const bufferService = platformToBufferService(connRes.platform);
    let accessToken = connRes.accessToken;
    const firstComment = ctxRes.variant.firstComment ?? ctxRes.item.firstComment ?? null;
    while (attempt < Math.max(1, maxAttempts - currentAttempt + 1)) {
      attempt++;
      const callArgs = {
        channelId: connRes.channelRef,
        text: message,
        mode: "shareNow" as PublishMode, // retry fires NOW
        contentKind,
        service: bufferService,
        mediaUrl,
        firstComment,
      };
      let res = await createPostForBuffer(accessToken, callArgs);
      if (!res.ok && res.reason === "auth") {
        // Reactive refresh (once per publish) — locked + stale-guarded.
        const rotated = await rotateBufferToken({
          connectionId: connRes.connectionId,
          startedFromAccessToken: accessToken,
          currentEnvelope: connRes.envelope!,
        });
        if (rotated.ok) {
          accessToken = rotated.envelope.accessToken;
          res = await createPostForBuffer(accessToken, callArgs);
        }
      }
      if (res.ok) {
        const scheduledAt = new Date();
        if (res.data.dueAt) {
          const parsed = new Date(res.data.dueAt);
          if (!Number.isNaN(parsed.getTime())) scheduledAt.setTime(parsed.getTime());
        }
        const result: Record<string, unknown> = {
          updateId: res.data.id,
          status: res.data.status,
          scheduledAt: scheduledAt.toISOString(),
        };
        if (mediaUrl) result.mediaAttached = true;
        await flipToPublished({
          workspaceId: args.workspaceId,
          itemId: ctxRes.item.id,
          variantId: ctxRes.variant.id,
          providerPostId: res.data.id,
          jobId: job.id,
          result,
        });
        return {
          ok: true,
          provider: "buffer",
          mode: "shareNow",
          providerPostId: res.data.id,
          scheduledAt,
          mediaAttached: mediaUrl !== null,
        };
      }
      lastReason = res.reason;
      lastMessage = res.message;
      if (res.reason === "auth") break; // permanent: refresh+retry already exhausted
      const retryable = res.reason === "network" || res.reason === "rate_limited" || res.reason === "invalid_response";
      if (!retryable) break;
      // Backoff: exponential (base * 2^(attempt-1)).
      const sleepMs = baseBackoffMs * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, Math.min(sleepMs, 60_000))); // cap single-retry sleep to 60s
    }
    if (lastReason === "auth") {
      // Real auth failure after refresh+retry: mark expired + reconnect message.
      await markConnectionExpired(connRes.connectionId);
      logBufferOAuthDiagnostic("publish_auth_expired", {
        workspaceId: args.workspaceId,
        platform: connRes.platform,
        detail: lastMessage.slice(0, 120),
      });
      await db
        .update(publishingJobs)
        .set({ status: "failed", lastError: AUTH_EXPIRED_MESSAGE, updatedAt: new Date() })
        .where(eq(publishingJobs.id, job.id));
      return { ok: false, reason: "auth_expired", message: AUTH_EXPIRED_MESSAGE };
    }
    const reason =
      currentAttempt >= maxAttempts
        ? "attempts_exhausted"
        : "rejected";
    await db
      .update(publishingJobs)
      .set({ status: "failed", lastError: lastMessage, updatedAt: new Date() })
      .where(eq(publishingJobs.id, job.id));
    return { ok: false, reason, message: lastMessage };
  }

  // Meta retry path
  let imageUrl: string | null = null;
  if (ctxRes.visual?.storagePath) {
    imageUrl = await signedUrlForVisual(ctxRes.visual.storagePath);
    if (!imageUrl) {
      const msg = "Could not generate a public URL for the attached visual (Supabase storage unreachable) — the post was not published.";
      await db.update(publishingJobs).set({ status: "failed", lastError: msg, updatedAt: new Date() }).where(eq(publishingJobs.id, job.id));
      return { ok: false, reason: "missing_image_url", message: msg };
    }
  }
  const [conn] = await db
    .select()
    .from(platformConnections)
    .where(and(
      eq(platformConnections.workspaceId, args.workspaceId),
      eq(platformConnections.platform, ctxRes.variant.platform),
      eq(platformConnections.provider, "meta"),
    ));
  const connMeta = (conn?.meta ?? {}) as Record<string, string>;
  const result = await publishPost({
    pageToken: connRes.accessToken,
    pageId: String(connMeta.pageId ?? ""),
    igUserId: connMeta.igUserId ?? null,
    platform: ctxRes.variant.platform,
    message,
    imageUrl,
  });
  if (!result.ok) {
    await db
      .update(publishingJobs)
      .set({ status: "failed", lastError: result.message, updatedAt: new Date() })
      .where(eq(publishingJobs.id, job.id));
    return { ok: false, reason: result.reason, message: result.message };
  }
  await flipToPublished({
    workspaceId: args.workspaceId,
    itemId: ctxRes.item.id,
    variantId: ctxRes.variant.id,
    providerPostId: result.postId,
    jobId: job.id,
    result: { postId: result.postId, permalink: result.permalink },
  });
  return {
    ok: true,
    provider: "meta",
    mode: "shareNow",
    providerPostId: result.postId,
    scheduledAt: new Date(),
    mediaAttached: imageUrl ? true : false,
  };
}

/* ── Errors ───────────────────────────────────────────────────────── */

/** Typed publishing error. Every code path that surfaces a failure to a UI
 *  or an agent should either return a PublishResult/ScheduleResult
 *  `{ ok: false }` or throw a PublishingError — never a bare Error. */
export class PublishingError extends Error {
  code: string;
  provider: "meta" | "buffer" | "none";
  step: "resolve" | "create_post" | "upload" | "decode" | "db";
  constructor(args: { code: string; message: string; provider: "meta" | "buffer" | "none"; step: PublishingError["step"] }) {
    super(args.message);
    this.name = "PublishingError";
    this.code = args.code;
    this.provider = args.provider;
    this.step = args.step;
  }
}
