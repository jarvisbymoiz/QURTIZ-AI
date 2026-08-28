import { createGoogleGenerativeAI } from "@ai-sdk/google";

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

export function getModelId(): string {
  return process.env.QURTIZ_AI_MODEL?.trim() || DEFAULT_MODEL;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Resolve the configured model from the provider registry.
 * Returns null when no API key is configured — callers must render an
 * honest "Configuration Required" state instead of faking a response.
 */
export function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const modelId = getModelId();
  // Provider registry: Google first. Additional providers (OpenAI, etc.)
  // plug in here without touching agent code.
  const google = createGoogleGenerativeAI({ apiKey });
  return google(modelId);
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

