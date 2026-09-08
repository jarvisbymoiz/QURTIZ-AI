import "server-only";

/**
 * Shared helpers for surfacing provider/stream failures as honest,
 * user-safe messages — and for normalizing tool outputs so nothing a tool
 * returns can poison the agent stream.
 *
 * - `describeStreamError` turns whatever the AI SDK's stream `onError`
 *   callback received (the SDK passes the EVENT `{ error }` — the caller
 *   must destructure it) into one sanitized string: real provider errors
 *   (429 rate limits, mid-stream drops, context errors) instead of the
 *   opaque "Provider stream error" wall.
 * - `safeToolResultJson` / `normalizeToolOutput` guarantee that tool results
 *   and other serialized content are plain-JSON-safe and size-capped, so
 *   neither the adapter's `toChatMessages` nor the SDK's own part
 *   serialization can throw mid-stream on a hostile value (BigInt, circular
 *   references, oversized payloads).
 */

const MAX_MESSAGE_LENGTH = 300;

/**
 * Credential-shaped text: common API-key prefixes, Bearer tokens, and
 * `api_key=` / `api-key:` assignments. Never surface anything that matches.
 */
export const CREDENTIAL_PATTERN =
  /\b(?:sk|rk|pk|ghp|gho)-[A-Za-z0-9_-]{8,}\b|Bearer\s+\S+|api[_-]?key\s*[=:]\s*\S+/gi;

export function scrubCredentials(message: string): string {
  return message.replace(CREDENTIAL_PATTERN, "[redacted]");
}

export function capMessage(message: string, maxLength = MAX_MESSAGE_LENGTH): string {
  return message.length > maxLength ? message.slice(0, maxLength) + "…" : message;
}

export const RATE_LIMIT_HINT =
  " (The configured AI model is rate-limited or stalled — try again or switch to a non-free model in AI Configuration.)";

/** Actionable hint for 429/rate-limit/timeout/abort failures (free-tier models). */
export function appendRateLimitHint(message: string): string {
  return /\b429\b|rate[\s-]?limit|time[\s-]?out|timed out|abort/i.test(message)
    ? message + RATE_LIMIT_HINT
    : message;
}

function safeJsonStringify(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    return typeof json === "string" ? json : String(value);
  } catch {
    return String(value);
  }
}

/**
 * One honest, sanitized message for whatever the AI SDK's stream `onError`
 * callback received. Covers Error instances (with an `HTTP <status>:` prefix
 * when a statusCode is present — e.g. APICallError), strings, plain objects
 * and null/undefined. Everything is credential-scrubbed, length-capped and
 * rate-limit-hint-annotated, so the persisted run error is actionable.
 */
export function describeStreamError(error: unknown): string {
  let message: string;
  if (error instanceof Error) {
    message = error.message;
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === "number") message = `HTTP ${statusCode}: ${message}`;
  } else if (typeof error === "string") {
    message = error;
  } else if (error == null) {
    message = "Provider stream error (no detail)";
  } else {
    message = safeJsonStringify(error);
  }
  if (message.length === 0) message = "Provider stream error (no detail)";
  return appendRateLimitHint(capMessage(scrubCredentials(message)));
}

// ---------------------------------------------------------------------------
// Tool-result serialization insurance
// ---------------------------------------------------------------------------

const MAX_LOSSY_DEPTH = 10;

/** JSON.stringify replacer: BigInt → string, functions/symbols dropped. */
function jsonSafeReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  return value;
}

/**
 * Serialize an arbitrary value to JSON that NEVER throws: fast path via
 * JSON.stringify with the safe replacer; on failure (circular references,
 * throwing toJSON/getters) a lossy but valid reconstruction; ultimate
 * fallback is a note object. The result is always a parseable JSON string.
 */
export function safeToolResultJson(value: unknown): string {
  try {
    const json = JSON.stringify(value, jsonSafeReplacer);
    return typeof json === "string" ? json : String(value);
  } catch {
    try {
      return stringifyLossy(value);
    } catch {
      return '{"note":"unserializable tool result"}';
    }
  }
}

/** Best-effort plain-JSON reconstruction for values JSON.stringify rejects. */
function stringifyLossy(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown, depth: number): string => {
    if (typeof v === "bigint") return JSON.stringify(v.toString());
    if (typeof v === "function" || typeof v === "symbol" || v === undefined) return "null";
    if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
    if (depth > MAX_LOSSY_DEPTH) return '"…"';
    if (seen.has(v)) return '"<circular>"';
    seen.add(v);
    try {
      if (Array.isArray(v)) {
        return "[" + v.map((item) => walk(item, depth + 1)).join(",") + "]";
      }
      const entries: string[] = [];
      for (const [key, item] of Object.entries(v)) {
        entries.push(JSON.stringify(key) + ":" + walk(item, depth + 1));
      }
      return "{" + entries.join(",") + "}";
    } finally {
      // Shared references (non-cyclic) serialize fully; only true cycles are
      // marked "<circular>".
      seen.delete(v);
    }
  };
  return walk(value, 0);
}

// ---------------------------------------------------------------------------
// Tool-output normalization
// ---------------------------------------------------------------------------

const MAX_TOOL_OUTPUT_CHARS = 24 * 1024; // ~24KB cap on the serialized tool result
const TOOL_OUTPUT_PREVIEW_CHARS = 4000;

/**
 * Normalize a tool's return value before it flows into the prompt:
 * - plain-JSON values under the 24KB cap pass through untouched (existing
 *   tools are unaffected);
 * - plain but oversized values are replaced with a truncated preview plus a
 *   `truncated: true` marker;
 * - values that plain JSON.stringify rejects (circular refs, BigInt,
 *   functions) are replaced with a lossy safe representation — the SDK's own
 *   serialization of the tool-result part can then never throw mid-stream.
 */
export function normalizeToolOutput<T>(value: T): T {
  let plain: string | undefined;
  try {
    plain = JSON.stringify(value);
  } catch {
    plain = undefined;
  }
  if (typeof plain === "string") {
    if (plain.length <= MAX_TOOL_OUTPUT_CHARS) return value;
    return {
      truncated: true,
      note: `Tool output exceeded the ${MAX_TOOL_OUTPUT_CHARS / 1024}KB safety cap and was truncated.`,
      preview: plain.slice(0, TOOL_OUTPUT_PREVIEW_CHARS),
    } as unknown as T;
  }
  return {
    note: "Tool output contained values that cannot be serialized (e.g. circular references) and was replaced.",
    preview: safeToolResultJson(value),
  } as unknown as T;
}
