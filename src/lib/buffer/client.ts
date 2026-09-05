import crypto from "node:crypto";
import { getEncryptionKey } from "@/lib/crypto/tokens";

/**
 * Buffer OAuth + publish client (auth.buffer.com OAuth2 + Buffer GraphQL API).
 *
 * Buffer is the interim publishing route until the Meta App Review passes.
 * All URLs are module constants so an endpoint migration stays a one-file change.
 *
 * Design notes:
 * - Buffer's authorization server (auth.buffer.com) requires OAuth2
 *   Authorization Code WITH PKCE. This client therefore sends
 *   code_challenge/code_challenge_method on the authorize step and
 *   code_verifier on the token exchange; the code_verifier travels inside the
 *   signed state marker, so no server-side store is required.
 * - auth.buffer.com refresh tokens are SINGLE-USE: every refresh returns a
 *   new refresh_token and invalidates the one sent. refreshAccessToken +
 *   applyRefreshedToken implement that rotation — callers must persist the
 *   newest envelope or the next refresh will fail.
 * - Publishing is "publish-at-due-time": when a due publishing job fires, the
 *   post is created via the documented createPost GraphQL mutation with
 *   `mode: customScheduled` and dueAt ≈ now + 60s, so Buffer's free-plan
 *   queue cap (10 scheduled updates/channel) never accumulates.
 * - API transport is Buffer's GraphQL API: EVERY call is a POST to the ROOT of
 *   api.buffer.com (no /graphql path — this replaced the legacy REST
 *   profiles.json / updates endpoints and their access_token= query-param
 *   auth) with a Bearer access token and a { query, variables } JSON body.
 *   GraphQL-level failures arrive inside a 200 response's errors array, so
 *   HTTP 200 never implies success. HTTP 429 gets a bounded retry (2 attempts,
 *   fixed 2s/5s delays or a capped Retry-After) — a 429 means Buffer did not
 *   process the single mutation at all, so re-sending is safe.
 * - createPost is sent VARIABLES-BASED: enums (ShareMode, SchedulingType,
 *   PostType*) travel as JSON strings inside `variables` — Buffer's server
 *   rejects quoted enum literals inside an inline mutation string
 *   (`Enum "PostTypeFacebook" cannot represent non-enum value: "post"`).
 *   Assets honor the AssetInput @oneOf contract (exactly ONE key per asset):
 *   text-only posts send `assets: []`, media posts send
 *   `assets: [{ image: { url } }]`. NEVER `assets: {}` — that produced
 *   "OneOf Input Object AssetInput must specify exactly one key".
 *   The `image.url` subshape is the one unverified detail (the full
 *   AssetInputImage fields are auth-gated); Buffer's field errors surface
 *   verbatim if it complains. linkAttachment is NOT wired (link-attachment
 *   posts only, and never combined with non-empty assets).
 * - HTTP failures map to typed results ({ ok: false, reason, message }).
 *   Raw tokens never appear in errors or logs.
 * - The OAuth `state` marker is a stateless HMAC-signed
 *   workspaceId.userId.codeVerifier.exp token (same key derivation as
 *   lib/workspace-delete.ts) — no server-side store or cookie required.
 */

/**
 * Buffer endpoint roots. Defaults track Buffer's current hosts: the OAuth
 * authorize dialog and token exchange live on auth.buffer.com, the GraphQL
 * API on api.buffer.com (its ROOT — see bufferGraphQL). Each value is
 * env-overridable via BUFFER_AUTHORIZE_URL / BUFFER_TOKEN_URL / BUFFER_API_BASE
 * so a live endpoint change can be validated from .env.local without a code
 * deploy. Empty strings count as unset. A trailing "/" on BUFFER_API_BASE is
 * stripped defensively when the URL is composed.
 */
function bufferEndpoint(name: string, fallback: string): string {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export const BUFFER_AUTHORIZE_URL = bufferEndpoint("BUFFER_AUTHORIZE_URL", "https://auth.buffer.com/auth");
export const BUFFER_TOKEN_URL = bufferEndpoint("BUFFER_TOKEN_URL", "https://auth.buffer.com/token");
// GraphQL root — NO path, NO trailing slash (stripped defensively in bufferGraphQL).
export const BUFFER_API_BASE = bufferEndpoint("BUFFER_API_BASE", "https://api.buffer.com");

/** OAuth scopes requested on the authorize step. `offline_access` makes
 *  auth.buffer.com return a refresh token; refresh tokens are single-use (see
 *  applyRefreshedToken). Env-overridable via BUFFER_OAUTH_SCOPES. */
export const BUFFER_OAUTH_SCOPES = bufferEndpoint(
  "BUFFER_OAUTH_SCOPES",
  "posts:read posts:write account:read offline_access",
);

/* ── Safe server-side diagnostics (no secrets) ────────────────────── */

/** One-line server log for OAuth debugging. Callers pass only non-secret
 *  metadata (lengths, id prefixes, resolved endpoints, sanitized failure
 *  messages) — never the client secret, tokens, or the PKCE code_verifier. */
export function logBufferOAuthDiagnostic(
  stage: string,
  fields: Record<string, string | number | boolean | null>,
): void {
  console.warn("[buffer-oauth]", stage, JSON.stringify(fields));
}

/** Buffer OAuth state markers die after 10 minutes (same maxAge as the Meta
 *  OAuth cookie — the user must finish the flow in time). */
export const BUFFER_OAUTH_STATE_TTL_SECONDS = 10 * 60;

const REQUEST_TIMEOUT_MS = 30_000;

/* ── Credentials (env-driven, honest when unset) ─────────────────── */

export function bufferConfigured(): boolean {
  return Boolean(process.env.BUFFER_CLIENT_ID && process.env.BUFFER_CLIENT_SECRET);
}

function bufferClientId(): string {
  const id = process.env.BUFFER_CLIENT_ID;
  if (!id) {
    throw new Error(
      "BUFFER_CLIENT_ID is not set. Add the Buffer OAuth client credentials to .env.local (see SETUP.md).",
    );
  }
  return id;
}

function bufferClientSecret(): string {
  const secret = process.env.BUFFER_CLIENT_SECRET;
  if (!secret) {
    throw new Error(
      "BUFFER_CLIENT_SECRET is not set. Add the Buffer OAuth client credentials to .env.local (see SETUP.md).",
    );
  }
  return secret;
}

export function bufferRedirectUri(origin: string): string {
  return `${origin}/api/buffer/callback`;
}

/* ── Types ────────────────────────────────────────────────────────── */

export type BufferChannel = {
  id: string;
  /** Provider service id, e.g. "facebook" | "instagram" | "twitter" … */
  service: string;
  /** Channel display name (GraphQL `name`). */
  username: string;
};

/** Raw shape of the token endpoint response (snake_case, API-owned). */
export type BufferTokenResponse = {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number | null;
  /** Scope string the authorization server granted (e.g. "posts:read …"). */
  scope?: string | null;
};

/** What we persist (encrypted, camelCase) as the connection token envelope. */
export type BufferTokenEnvelope = {
  accessToken: string;
  refreshToken?: string | null;
  /** Epoch ms, present only when the provider returned expires_in. */
  expiresAt?: number | null;
  /** Scope string the authorization server granted (null when absent). */
  grantedScopes?: string | null;
};

export function buildBufferTokenEnvelope(token: BufferTokenResponse): BufferTokenEnvelope {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresAt: token.expires_in != null ? Date.now() + token.expires_in * 1000 : null,
    grantedScopes: typeof token.scope === "string" && token.scope.length > 0 ? token.scope : null,
  };
}

export function decodeBufferTokenEnvelope(plain: string): BufferTokenEnvelope | null {
  try {
    const parsed = JSON.parse(plain) as Partial<BufferTokenEnvelope>;
    if (typeof parsed.accessToken !== "string" || parsed.accessToken.length === 0) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : null,
      grantedScopes: typeof parsed.grantedScopes === "string" ? parsed.grantedScopes : null,
    };
  } catch {
    return null;
  }
}

/**
 * Merge a refresh-token response into the current envelope (pure). The NEW
 * access token replaces the old one; Buffer refresh tokens are single-use, so
 * a fresh refresh_token in the response always wins — but when the provider
 * omits one the previous refresh token is kept (defensive: only some
 * providers omit it on refresh). expiresAt is recomputed from expires_in;
 * when absent it becomes null (the old expiry described the replaced token).
 */
export function applyRefreshedToken(current: BufferTokenEnvelope, next: BufferTokenResponse): BufferTokenEnvelope {
  return {
    accessToken: next.access_token,
    refreshToken:
      typeof next.refresh_token === "string" && next.refresh_token.length > 0
        ? next.refresh_token
        : (current.refreshToken ?? null),
    expiresAt: next.expires_in != null ? Date.now() + next.expires_in * 1000 : null,
  };
}

/* ── Typed API results ────────────────────────────────────────────── */

export type BufferErrorReason =
  | "auth" // 401/403 — token rejected/expired
  | "rate_limited" // 429
  | "rejected" // other 4xx — bad request/content
  | "invalid_response" // 5xx or unparseable 2xx payload
  | "network"; // fetch/timeout layer

export type BufferApiFailure = { ok: false; reason: BufferErrorReason; message: string };
export type BufferApiSuccess<T> = { ok: true; data: T };
export type BufferApiResult<T> = BufferApiSuccess<T> | BufferApiFailure;

/** Pull a human-readable message out of an API error body without echoing
 *  the raw payload (which could contain provider-echoed secrets). */
function messageOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  for (const key of ["error_description", "error", "message"]) {
    const v = record[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Map an HTTP status to the typed failure reason (shared by the OAuth token
 *  requests and the GraphQL transport below). */
function reasonForStatus(status: number): BufferErrorReason {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "invalid_response";
  return "rejected";
}

/** Collapse control chars/whitespace and cap the length of a provider-echoed
 *  message before it is stored or logged (never echoes raw payloads). */
function sanitizeMessage(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<BufferApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    return {
      ok: false,
      reason: "network",
      message: error instanceof Error ? error.message : "Buffer API request failed",
    };
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    return {
      ok: false,
      reason: reasonForStatus(res.status),
      message: messageOf(body) ?? `Buffer API error (HTTP ${res.status}).`,
    };
  }
  return { ok: true, data: body as T };
}

/* ── GraphQL transport ────────────────────────────────────────────── */

/** Shape of a GraphQL response body (data + application errors). */
type GraphQLResponse<T> = { data?: T | null; errors?: Array<{ message?: unknown }> | null };

/**
 * POST one GraphQL operation to the ROOT of api.buffer.com (no /graphql path)
 * with a Bearer access token and a { query, variables } JSON body.
 *
 * Failures are typed: non-2xx maps through reasonForStatus; a 2xx body with a
 * non-empty errors array is a GraphQL application error → "rejected" with the
 * first two sanitized messages (HTTP 200 never implies success). Every call
 * logs one safe diagnostic line ({ operation, endpoint, status, hasErrors }) —
 * never tokens or secrets.
 *
 * Rate limits: HTTP 429 gets a bounded retry — max 2 retries after 2s then 5s
 * (a present Retry-After header wins, capped at 10s). A 429 means Buffer did
 * not process the single mutation at all, so re-sending is safe; after the
 * retries are exhausted the failure surfaces as "rate_limited".
 */
const RATE_LIMIT_MAX_RETRIES = 2;
const RATE_LIMIT_RETRY_DELAYS_MS = [2_000, 5_000] as const;
const RATE_LIMIT_MAX_DELAY_MS = 10_000;

/** Parse a Retry-After header (delta-seconds or HTTP-date) into a delay cap;
 *  null when absent/unparseable. Never throws. */
function retryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const asDate = Date.parse(trimmed);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

async function bufferGraphQL<T>(
  accessToken: string,
  operation: string,
  query: string,
  variables?: unknown,
): Promise<BufferApiResult<T>> {
  const endpoint = BUFFER_API_BASE.replace(/\/+$/, "");
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(variables === undefined ? { query } : { query, variables }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      logBufferOAuthDiagnostic("api", { operation, endpoint, status: null, hasErrors: false });
      return {
        ok: false,
        reason: "network",
        message: error instanceof Error ? error.message : "Buffer API request failed",
      };
    }
    if (res.status === 429 && attempt < RATE_LIMIT_MAX_RETRIES) {
      const delay = Math.min(
        retryAfterMs(res.headers.get("retry-after")) ?? RATE_LIMIT_RETRY_DELAYS_MS[attempt],
        RATE_LIMIT_MAX_DELAY_MS,
      );
      logBufferOAuthDiagnostic("api-rate-limited", { operation, attempt: attempt + 1, delayMs: delay });
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    const text = await res.text();
    let body: GraphQLResponse<T> | null = null;
    try {
      body = text ? (JSON.parse(text) as GraphQLResponse<T>) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      logBufferOAuthDiagnostic("api", { operation, endpoint, status: res.status, hasErrors: true });
      return {
        ok: false,
        reason: reasonForStatus(res.status),
        message: messageOf(body) ?? `Buffer API error (HTTP ${res.status}).`,
      };
    }
    const errors = body && Array.isArray(body.errors) ? body.errors : [];
    if (errors.length > 0) {
      logBufferOAuthDiagnostic("api", { operation, endpoint, status: res.status, hasErrors: true });
      const joined = errors
        .slice(0, 2)
        .map((e) => (e && typeof e.message === "string" ? sanitizeMessage(e.message) : ""))
        .filter(Boolean)
        .join("; ");
      return {
        ok: false,
        reason: "rejected",
        message: joined.length > 0 ? joined : `Buffer ${operation} failed (GraphQL errors).`,
      };
    }
    if (!body || body.data === undefined || body.data === null) {
      logBufferOAuthDiagnostic("api", { operation, endpoint, status: res.status, hasErrors: false });
      return { ok: false, reason: "invalid_response", message: `Buffer ${operation} returned no data.` };
    }
    logBufferOAuthDiagnostic("api", { operation, endpoint, status: res.status, hasErrors: false });
    return { ok: true, data: body.data };
  }
}

/* ── PKCE (OAuth2 Authorization Code + PKCE) ─────────────────────── */

/**
 * 43-char base64url verifier from 32 random bytes: base64url of 32 bytes is
 * ceil(32/3)*4 = 44 chars minus one "=" padding = 43 chars (Node's base64url
 * encoder already omits padding). Alphabet: A-Za-z0-9-_ (no "=", no "." — the
 * verifier is also embedded in the dot-joined OAuth state marker below).
 */
export function pkceVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** S256 challenge: sha256(verifier) as unpadded base64url (RFC 7636 §4.2). */
export function pkceChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier, "utf8").digest("base64url");
}

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = pkceVerifier();
  return { codeVerifier, codeChallenge: pkceChallenge(codeVerifier) };
}

/* ── OAuth ────────────────────────────────────────────────────────── */

/** Buffer OAuth dialog URL (pure — unit-testable). Throws when the client id
 *  env var is missing so misconfiguration fails loudly, not silently. */
export function buildAuthorizeUrl(args: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: bufferClientId(),
    redirect_uri: args.redirectUri,
    state: args.state,
    response_type: "code",
    scope: BUFFER_OAUTH_SCOPES,
    code_challenge: args.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${BUFFER_AUTHORIZE_URL}?${params.toString()}`;
}

/** Exchange the OAuth code for an access token (POST to BUFFER_TOKEN_URL).
 *  PKCE verifies the authorize step: the code_verifier must match the
 *  code_challenge sent in buildAuthorizeUrl. */
export async function exchangeCode(args: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<BufferApiResult<BufferTokenResponse>> {
  const body = new URLSearchParams({
    client_id: bufferClientId(),
    client_secret: bufferClientSecret(),
    redirect_uri: args.redirectUri,
    code: args.code,
    code_verifier: args.codeVerifier,
    grant_type: "authorization_code",
  });
  const res = await requestJson<BufferTokenResponse>(BUFFER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return res;
  if (typeof res.data.access_token !== "string" || res.data.access_token.length === 0) {
    return { ok: false, reason: "invalid_response", message: "Buffer token exchange returned no access token." };
  }
  return res;
}

/**
 * Refresh an expired access token (POST to BUFFER_TOKEN_URL). auth.buffer.com
 * refresh tokens are SINGLE-USE: a successful refresh returns a NEW
 * refresh_token and invalidates the one sent — callers must persist the
 * newest envelope (applyRefreshedToken → encryptToken → platformConnections)
 * or the next refresh will fail.
 */
export async function refreshAccessToken(args: {
  refreshToken: string;
}): Promise<BufferApiResult<BufferTokenResponse>> {
  const body = new URLSearchParams({
    client_id: bufferClientId(),
    client_secret: bufferClientSecret(),
    grant_type: "refresh_token",
    refresh_token: args.refreshToken,
  });
  const res = await requestJson<BufferTokenResponse>(BUFFER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return res;
  if (typeof res.data.access_token !== "string" || res.data.access_token.length === 0) {
    return { ok: false, reason: "invalid_response", message: "Buffer token refresh returned no access token." };
  }
  return res;
}

/* ── Supported channel services ───────────────────────────────────── */

const SUPPORTED_BUFFER_SERVICES = ["facebook", "instagram"] as const;

/** Type guard for the only services this product publishes to. */
export function isSupportedBufferChannel(
  channel: BufferChannel,
): channel is BufferChannel & { service: (typeof SUPPORTED_BUFFER_SERVICES)[number] } {
  return (SUPPORTED_BUFFER_SERVICES as readonly string[]).includes(channel.service);
}

/** Consumer-side filter: Buffer holds twitter/linkedin/pinterest too — this
 *  product only ever routes facebook/instagram channels into connections. */
export function filterSupportedBufferChannels(
  channels: BufferChannel[],
): Array<BufferChannel & { service: "facebook" | "instagram" }> {
  return channels.filter(isSupportedBufferChannel);
}

/* ── Organizations & channels (GraphQL) ───────────────────────────── */

/** Exact documented operations. Field selections stay minimal (id/name/service
 *  on channels, id/name on organizations) — do not request undocumented
 *  fields. JSON.stringify produces a safely escaped GraphQL string literal for
 *  the interpolated ids/text. */
const ORGANIZATIONS_QUERY = "query GetOrganizations { account { organizations { id name } } }";

function channelsQuery(organizationId: string): string {
  return `query GetChannels { channels(input: { organizationId: ${JSON.stringify(organizationId)} }) { id name service } }`;
}

/* ── GraphQL enums (live introspection 2026-09-05) ───────────────── */

/** Buffer `ShareMode` enum — the per-channel scheduling intent. The two
 *  values this product currently sends are `shareNow` and `customScheduled`;
 *  the other two are exported for completeness. */
export const BufferShareMode = {
  shareNow: "shareNow",
  customScheduled: "customScheduled",
  addToQueue: "addToQueue",
  shareNext: "shareNext",
} as const;
export type BufferShareModeValue = (typeof BufferShareMode)[keyof typeof BufferShareMode];

/** Buffer `SchedulingType` enum — the time-handling strategy. We always send
 *  `automatic` (Buffer schedules the post itself); `notification` is
 *  exported for completeness. */
export const BufferSchedulingType = {
  automatic: "automatic",
  notification: "notification",
} as const;
export type BufferSchedulingTypeValue =
  (typeof BufferSchedulingType)[keyof typeof BufferSchedulingType];

/** Buffer `PostTypeFacebook` enum (Facebook metadata `type`). */
export const BufferPostTypeFacebook = {
  post: "post",
  reel: "reel",
  story: "story",
} as const;
export type BufferPostTypeFacebookValue =
  (typeof BufferPostTypeFacebook)[keyof typeof BufferPostTypeFacebook];

/** Buffer `PostType` (Instagram) enum — subset this product actually uses
 *  (post/reel/story/carousel/short). The full enum also includes event,
 *  ghost_post, offer, thread, whats_new. */
export const BufferPostTypeInstagram = {
  post: "post",
  reel: "reel",
  story: "story",
  carousel: "carousel",
  short: "short",
} as const;
export type BufferPostTypeInstagramValue =
  (typeof BufferPostTypeInstagram)[keyof typeof BufferPostTypeInstagram];

/** Per-channel service identifiers this product publishes to. The service
 *  names match Buffer's channel.service string (facebook/instagram). */
export type BufferService = "facebook" | "instagram";

/* ── createPost mutation contract (variables-based) ───────────────── */

/** The two ShareMode values this product sends. */
export type BufferPostMode = "shareNow" | "customScheduled";
/** The per-service metadata `type` values this product sends. */
export type BufferPostType = "post" | "story" | "reel";

/**
 * Documented createPost mutation — VARIABLES-BASED (the definitive fix).
 *
 * Aligned to Buffer's CURRENT GraphQL schema (live introspection 2026-09-05):
 * `createPost(input: CreatePostInput!)` with REQUIRED `assets`, `channelId`,
 * `mode: ShareMode`, `needsApproval`, `schedulingType: SchedulingType`. ALL
 * enums and values travel inside `variables` as plain JSON — Buffer's server
 * rejects quoted enum literals inside an inline mutation string (`Enum
 * "PostTypeFacebook" cannot represent non-enum value: "post"`), so the query
 * string below contains NO literal values at all (no ids, no text, no enums).
 * The per-channel metadata is `metadata.<service>.type` (Buffer's
 * `PostInputMetaData` is a per-channel map keyed by the channel's service —
 * the legacy top-level `metadata: { type }` shape is INVALID).
 */
export const CREATE_POST_MUTATION =
  "mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id text dueAt } } ... on MutationError { message } } }";

/**
 * The exact variables JSON sent with CREATE_POST_MUTATION. Enums are JSON
 * strings (valid in variables). AssetInput is @oneOf: exactly ONE key per
 * asset — text-only posts send an empty ARRAY, media posts send exactly
 * one `image: { url }` asset. `linkAttachment` is deliberately never sent
 * (it is only valid for link-attachment posts and must never be combined
 * with non-empty assets — this product does not publish bare links).
 */
export type CreatePostInputVariables = {
  input: {
    channelId: string;
    text: string;
    mode: BufferShareModeValue;
    schedulingType: BufferSchedulingTypeValue;
    needsApproval: boolean;
    assets: Array<{ image: { url: string } }>;
    metadata:
      | { facebook: { type: BufferPostTypeFacebookValue; firstComment?: string } }
      | { instagram: { type: BufferPostTypeInstagramValue; firstComment?: string } };
    /** ONLY present for customScheduled — NEVER for shareNow. */
    dueAt?: string;
    aiAssisted?: boolean;
  };
};

/**
 * Build the createPost variables (pure — unit-testable).
 *
 * Mode semantics:
 *   - `shareNow` → Buffer publishes immediately. `dueAt` MUST NOT appear.
 *   - `customScheduled` → Buffer queues the post for `dueAt`. `dueAt` is
 *     required (ISO-8601 UTC).
 *
 * `needsApproval: false` and `schedulingType: "automatic"` are constants for
 * this product. contentKind is runtime-validated: it must be exactly
 * "post" | "reel" | "story" (TypeScript unions are compile-time only — a
 * stale caller or JS consumer must fail HERE, before the wire, not with an
 * opaque Buffer enum error).
 */
export function buildCreatePostVariables(args: {
  channelId: string;
  text: string;
  mode: BufferPostMode;
  contentKind: BufferPostType;
  service: BufferService;
  dueAt?: string;
  firstComment?: string | null;
  mediaUrl?: string | null;
  aiAssisted?: boolean;
}): CreatePostInputVariables {
  if (args.contentKind !== "post" && args.contentKind !== "reel" && args.contentKind !== "story") {
    throw new Error(
      `Invalid Buffer contentKind ${JSON.stringify(String(args.contentKind))} — must be exactly "post", "reel" or "story".`,
    );
  }
  const firstComment =
    typeof args.firstComment === "string" && args.firstComment.length > 0
      ? { firstComment: args.firstComment }
      : {};
  const metadata: CreatePostInputVariables["input"]["metadata"] =
    args.service === "facebook"
      ? { facebook: { type: args.contentKind, ...firstComment } }
      : { instagram: { type: args.contentKind, ...firstComment } };
  const input: CreatePostInputVariables["input"] = {
    channelId: args.channelId,
    text: args.text,
    mode: args.mode,
    schedulingType: BufferSchedulingType.automatic,
    needsApproval: false,
    // oneOf AssetInput: exactly one key per asset. Text-only → []; a visual
    // attaches as a single image asset keyed by url (the one unverified
    // subshape — Buffer field errors surface verbatim if it complains).
    assets: args.mediaUrl ? [{ image: { url: args.mediaUrl } }] : [],
    metadata,
  };
  if (args.mode === "customScheduled") {
    if (!args.dueAt) {
      throw new Error("buildCreatePostVariables: customScheduled requires dueAt (ISO-8601 string).");
    }
    input.dueAt = args.dueAt;
  }
  if (args.aiAssisted) input.aiAssisted = true;
  return { input };
}

export type BufferOrganization = { id: string; name: string };

/** List the connected Buffer account's organizations (GraphQL account →
 *  organizations). An account with zero organizations is ok with []. */
export async function getOrganizations(
  accessToken: string,
): Promise<BufferApiResult<BufferOrganization[]>> {
  const res = await bufferGraphQL<{ account?: { organizations?: unknown } | null }>(
    accessToken,
    "GetOrganizations",
    ORGANIZATIONS_QUERY,
  );
  if (!res.ok) return res;
  const orgs = res.data.account?.organizations;
  if (!Array.isArray(orgs)) {
    return {
      ok: false,
      reason: "invalid_response",
      message: "Buffer organizations query returned an unexpected payload.",
    };
  }
  const mapped: BufferOrganization[] = [];
  for (const raw of orgs) {
    if (!isRecord(raw)) continue;
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id) continue;
    mapped.push({ id, name: typeof raw.name === "string" ? raw.name : "" });
  }
  return { ok: true, data: mapped };
}

/** Map one raw channels[] entry to the product shape — the documented payload
 *  is exactly { id, name, service } (no avatar or default; those fields were
 *  a REST-era artifact and are no longer requested). */
function toChannel(raw: unknown): BufferChannel | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" && raw.id.length > 0 ? raw.id : "";
  const service = typeof raw.service === "string" && raw.service.length > 0 ? raw.service : "";
  if (!id || !service) return null;
  return { id, service, username: typeof raw.name === "string" ? raw.name : "" };
}

/** List the channels of ONE organization (GraphQL channels(input:
 *  { organizationId })). A Buffer account can hold several organizations, so
 *  the caller iterates orgs and merges supported channels across them. */
export async function listChannels(
  accessToken: string,
  organizationId: string,
): Promise<BufferApiResult<BufferChannel[]>> {
  const res = await bufferGraphQL<{ channels?: unknown }>(
    accessToken,
    "GetChannels",
    channelsQuery(organizationId),
  );
  if (!res.ok) return res;
  const raw = Array.isArray(res.data.channels) ? res.data.channels : null;
  if (!raw) {
    return {
      ok: false,
      reason: "invalid_response",
      message: "Buffer channels query returned an unexpected payload.",
    };
  }
  const channels = raw.map(toChannel).filter((c): c is BufferChannel => c !== null);
  return { ok: true, data: channels };
}

/* ── Posts (GraphQL createPost) ───────────────────────────────────── */

export type BufferUpdateRef = { id: string; status: string; dueAt?: string | null };

/** Documented createPost call: the single low-level entry point the rest of
 *  the codebase uses. Supports both shareNow (publish immediately) and
 *  customScheduled (queue for dueAt) modes via the documented `mode` enum.
 *
 *  - The caller MUST pass `service: "facebook" | "instagram"` so the
 *    variables builder can stamp `metadata.<service>.type` — Buffer's
 *    current `PostInputMetaData` input is keyed by service, and the legacy
 *    top-level `metadata: { type }` shape is no longer accepted. The
 *    centralized publishing service (lib/publishing/service.ts) is the
 *    only caller that knows the platform; it plumbs `service` from
 *    `ResolvedConnection.platform`.
 *  - `contentKind` maps to the per-service enum (post/reel/story) and is
 *    runtime-validated in buildCreatePostVariables — an invalid value throws
 *    BEFORE the wire instead of returning an opaque Buffer enum error.
 *  - dueAt is REQUIRED when mode=customScheduled and FORBIDDEN when
 *    mode=shareNow; the variables builder enforces this too.
 *  - `mediaUrl` attaches ONE image asset (`assets: [{ image: { url } }]` —
 *    oneOf-compliant); text-only posts send `assets: []`. The `image.url`
 *    subshape is the one unverified detail (AssetInputImage's full shape is
 *    auth-gated) — Buffer field errors surface verbatim. `firstComment`
 *    rides inside the per-channel metadata (metadata.<service>.firstComment)
 *    — the centralized publishing service plumbs it from the variant (with
 *    the item-level comment as fallback). `aiAssisted` is supported by the
 *    contract but not wired by the service yet.
 */
export async function createPostForBuffer(
  accessToken: string,
  args: {
    channelId: string;
    text: string;
    mode: BufferPostMode;
    contentKind: BufferPostType;
    service: BufferService;
    dueAt?: Date;
    mediaUrl?: string | null;
    firstComment?: string | null;
    aiAssisted?: boolean;
  },
): Promise<BufferApiResult<BufferUpdateRef>> {
  const dueAtIso = args.dueAt ? args.dueAt.toISOString() : undefined;
  const variables = buildCreatePostVariables({
    channelId: args.channelId,
    text: args.text,
    mode: args.mode,
    contentKind: args.contentKind,
    service: args.service,
    dueAt: dueAtIso,
    firstComment: args.firstComment ?? null,
    mediaUrl: args.mediaUrl ?? null,
    aiAssisted: args.aiAssisted,
  });
  const res = await bufferGraphQL<{
    createPost?: { post?: { id?: unknown; dueAt?: unknown } | null; message?: unknown } | null;
  }>(accessToken, "CreatePost", CREATE_POST_MUTATION, variables);
  if (!res.ok) return res;
  const payload = res.data.createPost;
  if (payload && typeof payload.message === "string" && payload.message.length > 0) {
    return { ok: false, reason: "rejected", message: sanitizeMessage(payload.message) };
  }
  const id = payload?.post && typeof payload.post.id === "string" && payload.post.id.length > 0 ? payload.post.id : null;
  if (!id) {
    return { ok: false, reason: "rejected", message: "Buffer createPost returned no post." };
  }
  const dueAt =
    payload?.post && typeof payload.post.dueAt === "string" && payload.post.dueAt.length > 0
      ? payload.post.dueAt
      : (dueAtIso ?? null);
  return { ok: true, data: { id, status: args.mode === "shareNow" ? "sent" : "queued", dueAt } };
}

/** Backwards-compatible scheduled-only alias for legacy callers. New code
 *  MUST use createPostForBuffer directly — it is the source of truth. Kept
 *  exported so existing tests / imports do not need to be rewired. The
 *  `service` parameter is REQUIRED — it is the channel's Buffer service
 *  (facebook/instagram); default is facebook so the legacy test path keeps
 *  working, but production callers must pass the platform's service. */
export async function createPost(
  accessToken: string,
  args: { channelId: string; text: string; dueAt: Date; service?: BufferService },
): Promise<BufferApiResult<BufferUpdateRef>> {
  return createPostForBuffer(accessToken, {
    channelId: args.channelId,
    text: args.text,
    mode: "customScheduled",
    contentKind: "post",
    service: args.service ?? "facebook",
    dueAt: args.dueAt,
  });
}

/* ── OAuth state marker (stateless, HMAC-signed) ──────────────────── */

export type BufferOAuthScope = { workspaceId: string; userId: string; codeVerifier: string };

/** Builds `workspaceId.userId.codeVerifier.exp.hmac` for the connect flow. The
 *  PKCE code_verifier rides inside the signed scope so the callback can
 *  complete the token exchange without any server-side store. The HMAC key is
 *  derived from the same ENCRYPTION_KEY used for token encryption (shared
 *  accessor in lib/crypto/tokens — no new env var). */
export function signBufferOAuthState({ workspaceId, userId, codeVerifier }: BufferOAuthScope): string {
  const exp = Math.floor(Date.now() / 1000) + BUFFER_OAUTH_STATE_TTL_SECONDS;
  const payload = `${workspaceId}.${userId}.${codeVerifier}.${exp}`;
  const hmac = crypto.createHmac("sha256", getEncryptionKey()).update(payload, "utf8").digest("hex");
  return `${payload}.${hmac}`;
}

/**
 * Validates shape, expiry and signature of a Buffer OAuth state marker and
 * returns its scope (incl. the PKCE code_verifier). Comparison is
 * timing-safe; anything malformed, expired or tampered with returns null.
 * Never throws.
 */
export function verifyBufferOAuthState(token: string): BufferOAuthScope | null {
  try {
    const [ws, uid, verifier, expStr, sig, ...extra] = token.split(".");
    if (extra.length > 0 || !ws || !uid || !verifier || !expStr || !sig) return null;
    const exp = Number(expStr);
    if (!Number.isSafeInteger(exp) || exp <= Math.floor(Date.now() / 1000)) return null;
    const expected = crypto
      .createHmac("sha256", getEncryptionKey())
      .update(`${ws}.${uid}.${verifier}.${expStr}`, "utf8")
      .digest("hex");
    if (sig.length !== expected.length) return null;
    return crypto.timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))
      ? { workspaceId: ws, userId: uid, codeVerifier: verifier }
      : null;
  } catch {
    return null;
  }
}
