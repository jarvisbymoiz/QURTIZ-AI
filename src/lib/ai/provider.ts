import type { LanguageModelV2 } from "@ai-sdk/provider";
import { APICallError } from "@ai-sdk/provider";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatibleModel } from "@/lib/ai/openai-compatible";
import {
  AI_PROVIDER_CATALOG,
  CATALOG_PROVIDER_IDS,
  catalogEntry,
  isCatalogProviderId,
  providerRequiresBaseUrl,
  resolvedBaseUrl,
  type ProviderId,
} from "@/lib/ai/provider-catalog";

/**
 * Provider registry (Phase 1: workspace-isolated BYOK, Phase 3: curated
 * third-party catalog).
 *
 * Every workspace owns an AI configuration row (workspace_ai_config) with a
 * TEXT provider/model (Chat, Content Studio, Research, Bulk, Campaigns,
 * Analytics, Growth) and an IMAGE provider/model (AI Visual Generation).
 * `resolveTextModel` / `resolveImageTarget` below map a config to a real
 * SDK model at runtime — there is no module-level global key and no
 * production fallback to GEMINI_API_KEY (that would mix tenants).
 *
 * Providers come from the catalog (lib/ai/provider-catalog.ts): `gemini`
 * (@ai-sdk/google SDK) plus OpenAI-compatible gateways (OpenAI, OpenRouter,
 * NVIDIA NIM, Groq, Together, … and a fully custom endpoint) — all served
 * by the small native OpenAI Chat Completions client built on
 * @ai-sdk/provider, no extra dependency. The legacy stored id
 * "openai-compatible" (Phase 1/2 rows) resolves to the catalog's `custom`
 * entry through catalogEntry(), so old rows keep working unchanged.
 */

export type TextProviderId = ProviderId;
export type ImageProviderId = ProviderId;

/** Savable catalog ids (same list for TEXT and IMAGE). */
export const TEXT_PROVIDER_IDS = CATALOG_PROVIDER_IDS;
export const IMAGE_PROVIDER_IDS = CATALOG_PROVIDER_IDS;

export { AI_PROVIDER_CATALOG };

/** Tasks that consume the workspace's TEXT model. */
export const AI_TASKS = [
  "chat",
  "content",
  "research",
  "bulk",
  "campaign",
  "analytics",
  "growth",
] as const;
export type AiTask = (typeof AI_TASKS)[number];

/**
 * Optional per-task model overrides, e.g. {"chat":"gemini-2.5-flash-lite"}.
 * Stored as jsonb on workspace_ai_config.task_overrides.
 */
export type AiTaskOverrides = Partial<Record<AiTask, string>>;

/**
 * Decrypted, runtime-ready AI configuration for one workspace. Never
 * persisted in this shape — keys come from AES-256-GCM decryption of the
 * *_api_key_enc columns at call time.
 */
export type WorkspaceAIConfig = {
  workspaceId: string;
  textProvider: TextProviderId;
  textModel: string;
  textBaseUrl: string | null;
  textApiKey: string;
  imageProvider: ImageProviderId;
  imageModel: string;
  imageBaseUrl: string | null;
  imageApiKey: string;
  taskOverrides: AiTaskOverrides;
};

/** A resolved TEXT model plus the metadata call sites need (bookkeeping,
 *  Gemini REST grounding). */
export type ResolvedTextModel = {
  provider: TextProviderId;
  modelId: string;
  apiKey: string;
  baseUrl: string | null;
  model: LanguageModelV2;
};

/** A resolved IMAGE target for the REST image generators (image.ts). */
export type ImageTarget = {
  provider: ImageProviderId;
  modelId: string;
  apiKey: string;
  baseUrl: string | null;
};

export const AI_CONFIGURATION_REQUIRED_MESSAGE =
  "AI is not configured for this workspace — add your provider + API key in Workspace Settings.";

/**
 * Honest "no workspace AI config" error. `message` stays exactly
 * "CONFIGURATION_REQUIRED" so the existing L9 action-level mapping (which
 * converts that message into a human toast) keeps working; `detail` carries
 * the human-readable explanation for paths that render it directly.
 */
export class AIConfigError extends Error {
  readonly detail: string;
  constructor(
    message = "CONFIGURATION_REQUIRED",
    detail = AI_CONFIGURATION_REQUIRED_MESSAGE,
  ) {
    super(message);
    this.name = "AIConfigError";
    this.detail = detail;
  }
}

/**
 * SAVE-side provider checks: only catalog ids may be persisted. The legacy
 * stored id "openai-compatible" is accepted on READ (catalogEntry resolves
 * the alias) but is not a valid save target.
 */
export function isKnownTextProvider(id: string): id is TextProviderId {
  return isCatalogProviderId(id);
}

export function isKnownImageProvider(id: string): id is ImageProviderId {
  return isCatalogProviderId(id);
}

/**
 * Validate the user-supplied shape of an AI config BEFORE it is persisted.
 * Returns null when valid, otherwise a human-readable reason.
 * Base URLs are required only for openai-compatible providers without a
 * catalog default (today: `custom`); presets may leave the field blank and
 * runtime resolution fills their catalog default.
 */
export function validateAIConfigShape(cfg: {
  textProvider: string;
  textModel: string;
  textBaseUrl?: string | null;
  imageProvider: string;
  imageModel: string;
  imageBaseUrl?: string | null;
}): string | null {
  if (!isKnownTextProvider(cfg.textProvider)) {
    return `Unknown text provider "${cfg.textProvider}". Supported: ${TEXT_PROVIDER_IDS.join(", ")}.`;
  }
  if (!isKnownImageProvider(cfg.imageProvider)) {
    return `Unknown image provider "${cfg.imageProvider}". Supported: ${IMAGE_PROVIDER_IDS.join(", ")}.`;
  }
  if (!cfg.textModel?.trim()) return "A text model is required.";
  if (!cfg.imageModel?.trim()) return "An image model is required.";
  if (providerRequiresBaseUrl(cfg.textProvider) && !cfg.textBaseUrl?.trim()) {
    return baseUrlRequiredMessage(cfg.textProvider, "text");
  }
  if (providerRequiresBaseUrl(cfg.imageProvider) && !cfg.imageBaseUrl?.trim()) {
    return baseUrlRequiredMessage(cfg.imageProvider, "image");
  }
  return null;
}

function baseUrlRequiredMessage(providerId: string, side: "text" | "image"): string {
  const name = catalogEntry(providerId)?.label ?? providerId;
  return `${name} ${side} endpoints require a Base URL (e.g. https://gateway.example.com/v1).`;
}

/** Mask a key for display: first 3 chars + "…" + last 4 chars. */
export function maskApiKey(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return "••••••";
  return `${k.slice(0, 3)}…${k.slice(-4)}`;
}

/**
 * Per-model USD cost per 1M tokens (input/output).
 * Verified against public pricing pages at plan time; refresh periodically.
 */
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gemini-3.6-flash": { input: 0.75, output: 3.75 },
  "gemini-3.7-flash": { input: 0.75, output: 3.75 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
};

export const DEFAULT_MODEL = "gemini-3.6-flash";

/**
 * Legacy env-based default model id — used only for display (settings page,
 * dashboard model label) and the dev-only fallback config. Real AI calls
 * resolve the model from the workspace config instead.
 */
export function getModelId(): string {
  return process.env.QURTIZ_AI_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * Legacy env-based "is AI configured" gate for UI display. Real capability
 * is per-workspace (see lib/ai/config.ts getWorkspaceAIConfig); the UI
 * switches to that in Phase 2.
 */
export function isAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Classify a provider rate-limit / quota error so the caller can decide
 * whether retrying soon is useful.
 *
 * - `tpm` / `rpm` — short windows (tokens/requests per minute). Recover in
 *   seconds-to-minutes. Worth retrying with backoff.
 * - `tpd` / `rpd` — long windows (tokens/requests per DAY). OpenRouter free
 *   tier limits e.g. gpt-oss-120b to 200K TPD. Retry is wasteful — the
 *   user is blocked for the rest of the calendar day. Surface the
 *   retry-after honestly so they know whether to wait or switch models.
 * - `quota` — hard quota exhaustion (account-level credits exhausted,
 *   upgrade required). Retrying is never useful.
 * - `other` — unclassified 429/5xx. Default to "recoverable" (tpm).
 */
export type RateLimitKind = "tpm" | "rpm" | "tpd" | "rpd" | "quota" | "other";

export type RateLimitInfo = {
  kind: RateLimitKind;
  /** Seconds until retry, parsed from Retry-After header or message; null when unknown. */
  retryAfterSeconds: number | null;
  /** Provider-reported limit (e.g. 200000 for TPD), null when unparsed. */
  limit: number | null;
  /** Tokens/requests already used in the current window, null when unparsed. */
  used: number | null;
  /** Tokens/requests requested by this call, null when unparsed. */
  requested: number | null;
};

// (kept historically for symmetry with the parseRetryAfter internals —
// the actual matching is now inlined inside parseRetryAfter with a single
// greedy regex that handles fractional seconds correctly.)

/**
 * Parse OpenRouter's free-tier TPD message shape:
 *   "Rate limit reached for model `openai/gpt-oss-120b` in organization ...
 *    on tokens per day (TPD): Limit 200000, Used 199147, Requested 2075.
 *    Please try again in 8m47.904s. Need more tokens? Upgrade to Dev Tier ..."
 * Also handles generic TPM/RPM/TPD from any provider.
 */
export function parseRateLimitError(error: unknown): RateLimitInfo {
  const empty: RateLimitInfo = { kind: "other", retryAfterSeconds: null, limit: null, used: null, requested: null };
  if (!error) return empty;

  let message = "";
  let headers: Record<string, unknown> = {};
  if (APICallError.isInstance(error)) {
    message = error.message ?? "";
    headers = (error.responseHeaders ?? {}) as Record<string, unknown>;
  } else if (error instanceof Error) {
    message = error.message ?? "";
  } else if (typeof error === "string") {
    message = error;
  } else {
    return empty;
  }

  const lower = message.toLowerCase();

  // Hard quota exhaustion — never worth retrying.
  if (
    /\bquota\b/.test(lower) ||
    /\bresource_exhausted\b/.test(lower) ||
    /\binsufficient[_ ]quota\b/.test(lower) ||
    /\bcredit(?:s)?\s+(?:exhausted|balance)\b/.test(lower) ||
    /\bbilling\b/.test(lower) ||
    /\bexceeded\s+your\s+current\s+quota\b/.test(lower)
  ) {
    return { ...empty, kind: "quota", retryAfterSeconds: parseRetryAfter(message, headers) };
  }

  // Per-window kind detection (TPD wins over TPM when both are mentioned).
  const kind: RateLimitKind =
    /\btokens?\s+per\s+day\b|\bTPD\b/i.test(lower) ? "tpd" :
    /\brequests?\s+per\s+day\b|\bRPD\b/i.test(lower) ? "rpd" :
    /\btokens?\s+per\s+(?:minute|min)\b|\bTPM\b/i.test(lower) ? "tpm" :
    /\brequests?\s+per\s+(?:minute|min)\b|\bRPM\b/i.test(lower) ? "rpm" :
    /\brate\s+limit\b|\btoo\s+many\s+requests\b|\b429\b/i.test(lower) ? "other" :
    "other";

  return {
    kind,
    retryAfterSeconds: parseRetryAfter(message, headers),
    limit: parseField(message, /\bLimit\s+([\d,]+)/i),
    used: parseField(message, /\bUsed\s+([\d,]+)/i),
    requested: parseField(message, /\bRequested\s+([\d,]+)/i),
  };
}

function parseField(message: string, regex: RegExp): number | null {
  const m = message.match(regex);
  if (!m) return null;
  const n = Number(m[1].replaceAll(",", ""));
  return Number.isFinite(n) ? n : null;
}

function parseRetryAfter(message: string, headers: Record<string, unknown>): number | null {
  // 1. HTTP Retry-After header (seconds OR HTTP-date).
  const headerVal = headers["retry-after"] ?? headers["Retry-After"] ?? headers["x-ratelimit-reset"];
  if (headerVal != null) {
    if (typeof headerVal === "number" && Number.isFinite(headerVal)) return Math.max(0, Math.floor(headerVal));
    if (typeof headerVal === "string") {
      const num = Number(headerVal);
      if (Number.isFinite(num)) return Math.max(0, Math.floor(num));
      const dateMs = Date.parse(headerVal);
      if (!Number.isNaN(dateMs)) return Math.max(0, Math.floor((dateMs - Date.now()) / 1000));
    }
  }

  // 2. Milliseconds ("500ms") — match first because fractional seconds below
  //    would otherwise swallow it.
  const msMatch = message.match(/(\d+(?:\.\d+)?)\s*(ms|milliseconds?)\b/i);
  if (msMatch) return Math.max(1, Math.ceil(Number(msMatch[1]) / 1000));

  // 3. Composite durations like "8m47.904s" / "1h30m15s". To avoid
  //    matching unrelated `<digits><unit>` tokens (e.g. org IDs, quota
  //    numbers like "Limit 200000"), we scope the search to a small
  //    window around retry-style cue phrases. Cues are anchored on a
  //    word boundary and exclude the bare word "in" (which appears in
  //    "in organization", "in region", etc. and is too noisy). The
  //    span boundary is "letter, semicolon, exclamation, question-mark,
  //    end-of-string" — but NOT a period, because fractional seconds
  //    like "47.904s" include one in the middle.
  let total = 0;
  let matched = false;
  const cuePattern =
    /\b(?:try\s+again\s+in|retry\s+after|wait(?:\s+for)?\s+(?:approximately|about|approx\.?)?|available\s+again\s+in|next\s+window\s+in)\s+([^\n\r;!?]*)/gi;
  let cueMatch: RegExpExecArray | null;
  while ((cueMatch = cuePattern.exec(message)) !== null) {
    const span = cueMatch[1];
    if (!/^\s*\d/.test(span)) continue;
    const composite = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)(?![a-z])/gi;
    let unitMatch: RegExpExecArray | null;
    while ((unitMatch = composite.exec(span)) !== null) {
      const value = Number(unitMatch[1]);
      const unit = unitMatch[2].toLowerCase();
      if (!Number.isFinite(value) || value < 0 || value > 1e7) continue;
      if (unit.startsWith("h")) total += value * 3600;
      else if (unit.startsWith("m")) total += value * 60;
      else if (unit.startsWith("s")) total += value;
      matched = true;
    }
  }
  if (matched) return Math.max(1, Math.floor(total));

  return null;
}

/**
 * Human-readable retry hint keyed off the rate-limit kind. TPD/RPD/quota
 * messages tell the user the recovery is hours, not seconds — so they do not
 * waste time retrying. TPM/RPM messages invite a short retry.
 */
export function rateLimitHint(info: RateLimitInfo): string {
  const minutes = info.retryAfterSeconds != null ? Math.ceil(info.retryAfterSeconds / 60) : null;
  switch (info.kind) {
    case "tpd":
    case "rpd":
      return minutes != null
        ? `Daily ${info.kind.toUpperCase()} limit reached — quota resets in ~${minutes} min. Switch to a different model or upgrade your plan to continue now.`
        : `Daily ${info.kind.toUpperCase()} limit reached — Switch to a different model or upgrade your plan to continue now.`;
    case "quota":
      return `Account quota exhausted. Upgrade the plan or top up credits to continue.`;
    case "tpm":
    case "rpm":
      if (info.retryAfterSeconds == null) {
        return `Rate limited (${info.kind.toUpperCase()}) — wait and retry.`;
      }
      // Use seconds when under a minute (TPM windows are typically <60s);
      // minutes otherwise. Avoid the "wait ~1s" rounding artifact when
      // the wait is e.g. 30 seconds.
      if (info.retryAfterSeconds < 60) {
        return `Rate limited (${info.kind.toUpperCase()}) — wait ~${Math.max(1, Math.ceil(info.retryAfterSeconds))}s and retry.`;
      }
      return `Rate limited (${info.kind.toUpperCase()}) — wait ~${minutes}s and retry.`;
    default:
      return "Rate limited — wait and retry, or switch to a different model.";
  }
}

/**
 * Thrown when a generative AI call is permanently blocked (TPD/RPD/quota),
 * NOT a transient rate limit. Carries the parsed RateLimitInfo so the UI can
 * render an actionable hint instead of a misleading "Failed after N attempts"
 * stack trace. The original error is preserved on `cause` for diagnostics.
 */
export class RateLimitExceededError extends Error {
  readonly info: RateLimitInfo;
  constructor(info: RateLimitInfo, options?: { cause?: unknown }) {
    super(rateLimitHint(info));
    this.name = "RateLimitExceededError";
    this.info = info;
    if (options?.cause !== undefined) {
      // ES2022 `cause` slot — keeps the original error in the chain without
      // losing stack fidelity for logs.
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/**
 * Retry a generative AI call when the provider returns 429.
 *
 * Two categories of 429 are handled differently:
 * - **TPM/RPM** (short window) — retry up to `attempts` with the
 *   provider's `Retry-After` header when present, capped at 60s.
 * - **TPD/RPD/quota** (long window / hard cap) — do NOT retry: a TPD
 *   exhaustion on OpenRouter's free tier blocks for the rest of the day,
 *   and each retry attempt burns more of the user's remaining quota. The
 *   error is re-thrown wrapped in `RateLimitExceededError` so the caller
 *   can render a clear "try a different model" message instead of the
 *   misleading "Failed after N attempts".
 *
 * Non-429 errors propagate unchanged.
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T> | T,
  attempts = 2,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const e = err as { statusCode?: number; message?: string };
      const is429 = e?.statusCode === 429 || /RESOURCE_EXHAUSTED|Rate limit/i.test(e?.message ?? "");
      if (!is429) throw err;
      // Classify BEFORE deciding to retry — TPD/RPD/quota must surface
      // immediately instead of burning more quota on doomed attempts.
      const info = parseRateLimitError(err);
      if (info.kind === "tpd" || info.kind === "rpd" || info.kind === "quota") {
        throw new RateLimitExceededError(info, { cause: err });
      }
      if (i === attempts - 1) throw err;
      const waitSeconds = info.retryAfterSeconds != null
        ? Math.min(Math.max(1, info.retryAfterSeconds), 60)
        : 10;
      await new Promise((r) => setTimeout(r, waitSeconds * 1000));
    }
  }
  throw lastErr;
}

/**
 * Effective base URL for a provider, converted into this module's error
 * contract: catalog resolution throws plain Errors for a `custom` provider
 * without a stored URL (and for unknown ids); callers here surface the same
 * honest reason as an AIConfigError so the existing L9 error mapping keeps
 * working.
 */
function effectiveBaseUrl(providerId: string, storedBaseUrl: string | null): string | null {
  try {
    return resolvedBaseUrl(providerId, storedBaseUrl);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : `Provider "${providerId}" requires a Base URL.`;
    throw new AIConfigError("INVALID_CONFIG", reason);
  }
}

/** Build the SDK text model instance for a provider/model/key triple. */
export function createTextModel(
  provider: TextProviderId,
  modelId: string,
  apiKey: string,
  baseUrl: string | null,
): LanguageModelV2 {
  const entry = catalogEntry(provider);
  if (!entry) {
    throw new AIConfigError("INVALID_CONFIG", `Unknown text provider "${provider}".`);
  }
  if (entry.kind === "gemini") {
    const google = createGoogleGenerativeAI({ apiKey });
    return google(modelId);
  }
  // OpenAI-compatible kind: presets fall back to their catalog default when
  // no URL is given; `custom` without a URL fails honestly here.
  const effective = effectiveBaseUrl(provider, baseUrl);
  return createOpenAICompatibleModel({ modelId, apiKey, baseUrl: effective });
}

/**
 * Resolve the TEXT model for a workspace config, honoring per-task
 * overrides. Pure function of the decrypted config — no globals, no env.
 * `baseUrl` on the result is the EFFECTIVE endpoint (stored ?? catalog
 * default) so bookkeeping matches what the client actually talks to.
 */
export function resolveTextModel(config: WorkspaceAIConfig, task?: AiTask): ResolvedTextModel {
  const modelId = (task ? config.taskOverrides?.[task] : undefined)?.trim() || config.textModel;
  const baseUrl = effectiveBaseUrl(config.textProvider, config.textBaseUrl);
  const model = createTextModel(config.textProvider, modelId, config.textApiKey, baseUrl);
  return {
    provider: config.textProvider,
    modelId,
    apiKey: config.textApiKey,
    baseUrl,
    model,
  };
}

/** Resolve the IMAGE target for a workspace config. */
export function resolveImageTarget(config: WorkspaceAIConfig): ImageTarget {
  return {
    provider: config.imageProvider,
    modelId: config.imageModel,
    apiKey: config.imageApiKey,
    baseUrl: effectiveBaseUrl(config.imageProvider, config.imageBaseUrl),
  };
}

export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const rates = MODEL_COSTS[modelId];
  if (!rates) return 0;
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

export function estimateCostFromUsage(
  modelId: string,
  usage: { inputTokens?: number | null; outputTokens?: number | null },
): number {
  return estimateCost(modelId, usage.inputTokens ?? 0, usage.outputTokens ?? 0);
}
