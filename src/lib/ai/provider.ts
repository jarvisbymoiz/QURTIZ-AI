import type { LanguageModelV2 } from "@ai-sdk/provider";
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
 * Retry a generative AI call when the provider returns 429
 * (rate limit / quota exhausted - e.g. Gemini free tier: 20 req/min).
 * Honors the Retry-After header when present, otherwise backs off.
 * Non-429 errors propagate immediately. Re-throws after attempts.
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T> | T,
  attempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const e = err as { statusCode?: number; headers?: Record<string, unknown>; message?: string };
      const is429 = e?.statusCode === 429 || (e?.message ?? "").includes("RESOURCE_EXHAUSTED");
      if (!is429 || i === attempts - 1) throw err;
      let waitMs = 10_000;
      const ra = (e?.headers as Record<string, unknown>)?.["retry-after"];
      const raNum = typeof ra === "number" ? ra : ra != null ? Number(String(ra)) : NaN;
      if (!Number.isNaN(raNum) && raNum > 0) waitMs = Math.min(raNum * 1000, 60_000);
      await new Promise((r) => setTimeout(r, waitMs));
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
