import crypto from "node:crypto";
import { getEncryptionKey } from "@/lib/crypto/tokens";

/**
 * Buffer OAuth + publish client (Buffer API v1, legacy endpoints).
 *
 * Buffer is the interim publishing route until the Meta App Review passes.
 * All URLs are module constants so a future migration to Buffer's v2 API
 * (api.buffer.com) stays a one-file change.
 *
 * Design notes:
 * - Buffer's current developer program requires OAuth2 Authorization Code
 *   WITH PKCE. This client therefore sends code_challenge/code_challenge_method
 *   on the authorize step and code_verifier on the token exchange. Legacy
 *   authorization servers ignore unknown parameters, so the PKCE addition is
 *   dual-compatible (authorize + exchange work against both old and new
 *   endpoints); the code_verifier travels inside the signed state marker, so
 *   no server-side store is required.
 * - Publishing is "publish-at-due-time": when a due publishing job fires, the
 *   update is created with `scheduled_at` ≈ now + 60s, so Buffer's free-plan
 *   queue cap (10 scheduled updates/channel) never accumulates.
 * - Buffer has NO upload endpoint — visuals are attached as publicly
 *   reachable signed URLs (minted fresh at fire time by the buffer provider).
 * - HTTP failures map to typed results ({ ok: false, reason, message }).
 *   Raw tokens never appear in errors or logs.
 * - The OAuth `state` marker is a stateless HMAC-signed
 *   workspaceId.userId.codeVerifier.exp token (same key derivation as
 *   lib/workspace-delete.ts) — no server-side store or cookie required.
 */

/**
 * Buffer endpoint roots. Defaults track Buffer's live hosts: the OAuth
 * authorize dialog lives on buffer.com — bufferapp.com permanently redirects
 * there (an earlier build of this file pointed at the redirecting host, so the
 * browser silently landed on buffer.com); the token exchange and v1 API still
 * resolve on api.bufferapp.com. Each value is env-overridable via
 * BUFFER_AUTHORIZE_URL / BUFFER_TOKEN_URL / BUFFER_API_BASE so a live endpoint
 * migration can be validated from .env.local without a code deploy. Empty
 * strings count as unset.
 */
function bufferEndpoint(name: string, fallback: string): string {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export const BUFFER_AUTHORIZE_URL = bufferEndpoint("BUFFER_AUTHORIZE_URL", "https://buffer.com/oauth2/authorize");
export const BUFFER_TOKEN_URL = bufferEndpoint("BUFFER_TOKEN_URL", "https://api.bufferapp.com/1/oauth2/token.json");
export const BUFFER_API_BASE = bufferEndpoint("BUFFER_API_BASE", "https://api.bufferapp.com/1/");

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
  username: string;
  avatar?: string | null;
  default?: boolean;
};

/** Raw shape of the v1 token.json response (snake_case, API-owned). */
export type BufferTokenResponse = {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number | null;
};

/** What we persist (encrypted, camelCase) as the connection token envelope. */
export type BufferTokenEnvelope = {
  accessToken: string;
  refreshToken?: string | null;
  /** Epoch ms, present only when the provider returned expires_in. */
  expiresAt?: number | null;
};

export function buildBufferTokenEnvelope(token: BufferTokenResponse): BufferTokenEnvelope {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresAt: token.expires_in != null ? Date.now() + token.expires_in * 1000 : null,
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
    };
  } catch {
    return null;
  }
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
    const reason: BufferErrorReason =
      res.status === 401 || res.status === 403
        ? "auth"
        : res.status === 429
          ? "rate_limited"
          : res.status >= 500
            ? "invalid_response"
            : "rejected";
    return {
      ok: false,
      reason,
      message: messageOf(body) ?? `Buffer API error (HTTP ${res.status}).`,
    };
  }
  return { ok: true, data: body as T };
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
    code_challenge: args.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${BUFFER_AUTHORIZE_URL}?${params.toString()}`;
}

/** Exchange the OAuth code for an access token (POST token.json). PKCE
 *  verifies the authorize step: the code_verifier must match the
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

/* ── Channels ─────────────────────────────────────────────────────── */

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

function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}

/** Map one raw channel payload to the product shape. Field fallbacks absorb
 *  v1/v2 naming drift (service ← service|type|service_type, username ←
 *  formatted_username|username|name, avatar ← avatar|profile_image). */
function toChannel(raw: unknown): BufferChannel | null {
  if (!isRecord(raw)) return null;
  const id = raw.id != null ? String(raw.id) : "";
  const service = pickString(raw, ["service", "type", "service_type"]);
  if (!id || !service) return null;
  const channel: BufferChannel = { id, service, username: pickString(raw, ["formatted_username", "username", "name"]) };
  const avatar = pickString(raw, ["avatar", "profile_image"]);
  if (avatar) channel.avatar = avatar;
  if (typeof raw.default === "boolean") channel.default = raw.default;
  return channel;
}

/** List the Buffer account's connected channels (GET profiles.json). The
 *  payload shape has drifted across Buffer API generations, so it is parsed
 *  defensively: a top-level array, { profiles: [...] } or { data: [...] }. */
export async function listChannels(accessToken: string): Promise<BufferApiResult<BufferChannel[]>> {
  const url = `${BUFFER_API_BASE}profiles.json?access_token=${encodeURIComponent(accessToken)}`;
  const res = await requestJson<unknown>(url);
  if (!res.ok) return res;
  const raw = Array.isArray(res.data)
    ? res.data
    : isRecord(res.data) && Array.isArray(res.data.profiles)
      ? res.data.profiles
      : isRecord(res.data) && Array.isArray(res.data.data)
        ? res.data.data
        : null;
  if (!raw) {
    return { ok: false, reason: "invalid_response", message: "Buffer profiles.json returned an unexpected payload." };
  }
  const channels = raw.map(toChannel).filter((c): c is BufferChannel => c !== null);
  return { ok: true, data: channels };
}

/* ── Updates ──────────────────────────────────────────────────────── */

export type BufferUpdateRef = { id: string; status: string };

/**
 * Queue an update on a channel (POST updates/create.json). The media link is
 * a PUBLIC url — Buffer has no upload endpoint. scheduled_at ≈ now + 60s is
 * the publish-at-due-time model (see module header).
 */
export async function createUpdate(args: {
  accessToken: string;
  channelId: string;
  text: string;
  mediaUrl?: string | null;
  scheduledAt: Date;
}): Promise<BufferApiResult<BufferUpdateRef>> {
  const params = new URLSearchParams();
  params.append("profile_ids[]", args.channelId);
  params.append("text", args.text);
  params.append("scheduled_at", args.scheduledAt.toISOString());
  if (args.mediaUrl) {
    params.append("media[link]", args.mediaUrl);
    params.append("media[title]", "");
    params.append("media[description]", "");
  }
  const url = `${BUFFER_API_BASE}updates/create.json?access_token=${encodeURIComponent(args.accessToken)}`;
  const res = await requestJson<Record<string, unknown>>(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) return res;
  const body = res.data;
  const updates = Array.isArray(body?.updates) ? body.updates : [];
  const first = isRecord(updates[0]) ? updates[0] : null;
  const id = first && typeof first.id === "string" ? first.id : typeof body?.id === "string" ? body.id : null;
  if (!id) {
    return { ok: false, reason: "invalid_response", message: "Buffer accepted the request but returned no update id." };
  }
  const status =
    (first && typeof first.status === "string" ? first.status : null) ??
    (typeof body?.status === "string" ? body.status : null) ??
    "queued";
  return { ok: true, data: { id, status } };
}

/** Fetch one update's current state (GET updates/{id}.json) — minimal, for
 *  later status checks on queued updates. */
export async function getUpdate(args: {
  accessToken: string;
  updateId: string;
}): Promise<BufferApiResult<BufferUpdateRef>> {
  const url = `${BUFFER_API_BASE}updates/${encodeURIComponent(args.updateId)}.json?access_token=${encodeURIComponent(args.accessToken)}`;
  const res = await requestJson<Record<string, unknown>>(url);
  if (!res.ok) return res;
  const body = res.data;
  const id = typeof body?.id === "string" ? body.id : args.updateId;
  const status = typeof body?.status === "string" ? body.status : "unknown";
  return { ok: true, data: { id, status } };
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
