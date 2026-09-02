import type { LanguageModelV2 } from "@ai-sdk/provider";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatibleModel } from "@/lib/ai/openai-compatible";

/**
 * Provider registry (Phase 1: workspace-isolated BYOK).
 *
 * Every workspace owns an AI configuration row (workspace_ai_config) with a
 * TEXT provider/model (Chat, Content Studio, Research, Bulk, Campaigns,
 * Analytics, Growth) and an IMAGE provider/model (AI Visual Generation).
 * `resolveTextModel` / `resolveImageTarget` below map a config to a real
 * SDK model at runtime — there is no module-level global key and no
 * production fallback to GEMINI_API_KEY (that would mix tenants).
 *
 * Only providers whose SDK packages exist in package.json are registered.
 * Today that is `gemini` (@ai-sdk/google) and `openai-compatible` (a small
 * OpenAI Chat Completions client built on @ai-sdk/provider, no extra
 * dependency). Adding `openai` / `anthropic` / etc. later is a one-line
 * addition to `createTextModel` below plus a package.json entry.
 */

export const TEXT_PROVIDER_IDS = ["gemini", "openai-compatible"] as const;
export type TextProviderId = (typeof TEXT_PROVIDER_IDS)[number];

export const IMAGE_PROVIDER_IDS = ["gemini", "openai-compatible"] as const;
export type ImageProviderId = (typeof IMAGE_PROVIDER_IDS)[number];

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

export function isKnownTextProvider(id: string): id is TextProviderId {
  return (TEXT_PROVIDER_IDS as readonly string[]).includes(id);
}

export function isKnownImageProvider(id: string): id is ImageProviderId {
  return (IMAGE_PROVIDER_IDS as readonly string[]).includes(id);
}

/**
 * Validate the user-supplied shape of an AI config BEFORE it is persisted.
 * Returns null when valid, otherwise a human-readable reason.
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
  if (cfg.textProvider === "openai-compatible" && !cfg.textBaseUrl?.trim()) {
    return "OpenAI-compatible text endpoints require a Base URL (e.g. https://api.openai.com/v1).";
  }
  if (cfg.imageProvider === "openai-compatible" && !cfg.imageBaseUrl?.trim()) {
    return "OpenAI-compatible image endpoints require a Base URL (e.g. https://api.openai.com/v1).";
  }
  return null;
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

/** Build the SDK text model instance for a provider/model/key triple. */
export function createTextModel(
  provider: TextProviderId,
  modelId: string,
  apiKey: string,
  baseUrl: string | null,
): LanguageModelV2 {
  switch (provider) {
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(modelId);
    }
    case "openai-compatible": {
      return createOpenAICompatibleModel({ modelId, apiKey, baseUrl });
    }
  }
}

/**
 * Resolve the TEXT model for a workspace config, honoring per-task
 * overrides. Pure function of the decrypted config — no globals, no env.
 */
export function resolveTextModel(config: WorkspaceAIConfig, task?: AiTask): ResolvedTextModel {
  const modelId = (task ? config.taskOverrides?.[task] : undefined)?.trim() || config.textModel;
  const model = createTextModel(config.textProvider, modelId, config.textApiKey, config.textBaseUrl);
  return {
    provider: config.textProvider,
    modelId,
    apiKey: config.textApiKey,
    baseUrl: config.textBaseUrl,
    model,
  };
}

/** Resolve the IMAGE target for a workspace config. */
export function resolveImageTarget(config: WorkspaceAIConfig): ImageTarget {
  return {
    provider: config.imageProvider,
    modelId: config.imageModel,
    apiKey: config.imageApiKey,
    baseUrl: config.imageBaseUrl,
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
