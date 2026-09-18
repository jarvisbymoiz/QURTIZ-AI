import "server-only";

import type { ImageProviderId } from "@/lib/ai/provider";
import { catalogEntry, resolvedBaseUrl } from "@/lib/ai/provider-catalog";
import { assertAllowedAiEndpoint } from "@/lib/security/ai-endpoint";

/**
 * Image generation via REST, driven by the workspace's own AI config
 * (provider + model + API key resolved from workspace_ai_config at call
 * time — never from a shared env key in production).
 *
 * - gemini: Google's generateContent REST API (direct fetch for full
 *   control over reference images / img2img, which SDK image APIs do not
 *   expose). Models are tried in order; the first with quota wins.
 * - every other catalog provider is openai-compatible: POST
 *   {baseUrl}/images/generations (OpenAI Images API shape — also served by
 *   OpenRouter and compatible gateways). The base URL is the EFFECTIVE one
 *   (stored ?? catalog default); a `custom` provider without an endpoint
 *   fails honestly instead of silently targeting a default host.
 */
export const IMAGE_MODEL_CHAIN = [
  "gemini-3.1-flash-image",
  "gemini-2.5-flash-image",
];

export type ImageReference = {
  mimeType: string;
  base64: string;
};

export type ImageGenResult =
  | { ok: true; png: Buffer; model: string }
  | { ok: false; reason: "quota_or_billing" | "api_error"; message: string };

/**
 * Legacy env-based gate for UI display. Real capability is per-workspace
 * (lib/ai/config.ts); the UI switches to that in Phase 2.
 */
export function isImageGenConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function geminiGenerate(args: {
  prompt: string;
  references?: ImageReference[];
  apiKey: string;
  modelId: string;
}): Promise<ImageGenResult> {
  const parts: Record<string, unknown>[] = [];
  for (const ref of args.references ?? []) {
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
  }
  parts.push({ text: args.prompt });

  // Configured model first, then the known chain (quota can differ per
  // model); dedupe so the configured model is not called twice.
  const chain = [args.modelId, ...IMAGE_MODEL_CHAIN].filter((m, i, all) => all.indexOf(m) === i);

  let lastError = "";
  let sawQuota = false;

  for (const model of chain) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": args.apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ["IMAGE"] },
          }),
          signal: AbortSignal.timeout(120_000),
        },
      );
      const json = (await res.json().catch(() => null)) as
        | { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] }
        | { error?: { message?: string; status?: string } }
        | null;

      if (!res.ok) {
        const message = (json as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
        if (res.status === 429 || message.includes("quota") || message.includes("Quota")) {
          sawQuota = true;
          lastError = message;
          continue;
        }
        return { ok: false, reason: "api_error", message: `${model}: ${message}` };
      }

      const imgPart = (json as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] })
        ?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!imgPart?.inlineData?.data) {
        lastError = `${model}: response contained no image`;
        continue;
      }
      return { ok: true, png: Buffer.from(imgPart.inlineData.data, "base64"), model };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (sawQuota) {
    return {
      ok: false,
      reason: "quota_or_billing",
      message:
        "Image generation requires paid API billing (free tier quota is 0 for image models). Enable billing in Google AI Studio to use AI-photo visuals.",
    };
  }
  return { ok: false, reason: "api_error", message: lastError || "Image generation failed" };
}

async function openaiCompatibleGenerate(args: {
  prompt: string;
  apiKey: string;
  modelId: string;
  baseUrl: string;
}): Promise<ImageGenResult> {
  const baseUrl = args.baseUrl.replace(/\/+$/, "");
  assertAllowedAiEndpoint(baseUrl);
  const model = args.modelId;
  try {
    const res = await fetch(`${baseUrl}/images/generations`, {
      redirect: "error",
      method: "POST",
      headers: { Authorization: `Bearer ${args.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: args.prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const json = (await res.json().catch(() => null)) as
      | { data?: { b64_json?: string }[]; error?: { message?: string } }
      | null;
    if (!res.ok) {
      const message = json?.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 429 || /quota|billing|credit/i.test(message)) {
        return {
          ok: false,
          reason: "quota_or_billing",
          message: `Image generation blocked by the provider: ${message}`,
        };
      }
      return { ok: false, reason: "api_error", message: `${model}: ${message}` };
    }
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) {
      return {
        ok: false,
        reason: "api_error",
        message: `${model}: response contained no image (provider returned no b64_json data)`,
      };
    }
    return { ok: true, png: Buffer.from(b64, "base64"), model };
  } catch (error) {
    return { ok: false, reason: "api_error", message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Generate an image using the workspace's configured image provider/model.
 * `target` comes from getWorkspaceImageTarget(workspaceId) — the caller
 * resolves it so this module stays free of DB access. Dispatch follows the
 * catalog: kind "gemini" → Google REST; every other entry → the OpenAI
 * Images API shape against its (stored ?? catalog default) base URL. The
 * legacy stored id "openai-compatible" maps to `custom` via the catalog, so
 * old rows keep working here too.
 */
export async function generateImage(args: {
  prompt: string;
  references?: ImageReference[];
  provider: ImageProviderId;
  apiKey: string;
  modelId: string;
  baseUrl: string | null;
}): Promise<ImageGenResult> {
  if (!args.apiKey) {
    return { ok: false, reason: "api_error", message: "No API key is configured for this workspace's image provider." };
  }
  const entry = catalogEntry(args.provider);
  if (!entry) {
    return { ok: false, reason: "api_error", message: `Unknown image provider "${args.provider}".` };
  }
  if (entry.kind === "gemini") {
    return geminiGenerate({ prompt: args.prompt, references: args.references, apiKey: args.apiKey, modelId: args.modelId });
  }
  // OpenAI-compatible kind. Resolution already filled the catalog default
  // for presets; a `custom` provider with no endpoint fails honestly here
  // instead of silently targeting a default host.
  try {
    const baseUrl = resolvedBaseUrl(args.provider, args.baseUrl);
    if (!baseUrl) throw new Error(`Provider "${args.provider}" requires a Base URL.`);
    return openaiCompatibleGenerate({ prompt: args.prompt, apiKey: args.apiKey, modelId: args.modelId, baseUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed";
    return { ok: false, reason: "api_error", message };
  }
}
