import "server-only";

import { readBoundedJson } from "@/lib/security/bounded-response";
import sharp from "sharp";
import type { ImageProviderId } from "@/lib/ai/provider";
import { catalogEntry, resolvedBaseUrl } from "@/lib/ai/provider-catalog";
import { assertAllowedAiEndpoint, fetchPublicAiEndpoint } from "@/lib/security/ai-endpoint";
import { generateCloudflareImage } from "@/lib/ai/cloudflare-image";
import { inspectImageRequest, type ImageDebugContext } from "@/lib/ai/image-debug";

/**
 * Image generation via REST, driven by the workspace's own AI config
 * (provider + model + API key resolved from workspace_ai_config at call
 * time — never from a shared env key in production).
 *
 * - gemini: Google's generateContent REST API (direct fetch for full
 *   control over reference images / img2img, which SDK image APIs do not
 *   expose). Models are tried in order; the first with quota wins.
 * - cloudflare: native Workers AI /ai/run/{model}, normalized to PNG.
 * - other catalog providers are openai-compatible: POST
 *   {baseUrl}/images/generations (OpenAI Images API shape — also served by
 *   OpenRouter and compatible gateways). The base URL is the EFFECTIVE one
 *   (stored ?? catalog default); a `custom` provider without an endpoint
 *   fails honestly instead of silently targeting a default host.
 */
export type { ImageReference } from "@/lib/ai/image-references";
import type { ImageReference } from "@/lib/ai/image-references";

export type ImageGenerationOptions = {
  width?: number;
  height?: number;
  aspectRatio?: string;
  negativePrompt?: string;
  steps?: number;
  guidance?: number;
  seed?: number;
  quality?: string;
  style?: string;
};

export type ImageGenResult =
  | { ok: true; png: Buffer; model: string }
  | { ok: false; reason: "quota_or_billing" | "api_error"; message: string };

async function imageResult(base64: string, model: string): Promise<ImageGenResult> {
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > 16 * 1024 * 1024) {
    return { ok: false, reason: "api_error", message: `${model}: image response is empty or too large.` };
  }
  try {
    const png = await sharp(bytes, { limitInputPixels: 16 * 1024 * 1024 }).png().toBuffer();
    if (png.length > 16 * 1024 * 1024) throw new Error("too large");
    return { ok: true, png, model };
  } catch {
    return { ok: false, reason: "api_error", message: `${model}: provider returned malformed or oversized image data.` };
  }
}

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
  options?: ImageGenerationOptions;
  debug?: ImageDebugContext;
}): Promise<ImageGenResult> {
  const parts: Record<string, unknown>[] = [];
  for (const ref of args.references ?? []) {
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
  }
  parts.push({ text: args.prompt });

  // The configured model is authoritative. Do not silently switch models.
  const chain = [args.modelId];

  let lastError = "";
  let sawQuota = false;

  for (const model of chain) {
    try {
      const generationConfig = { responseModalities: ["IMAGE"],
        ...(args.options?.aspectRatio ? { imageConfig: { aspectRatio: args.options.aspectRatio } } : {}) };
      const request = async (config: Record<string, unknown>) => {
        inspectImageRequest({ provider: "gemini", model, prompt: args.prompt, referenceCount: args.references?.length ?? 0, references: args.references,
          parameters: config, context: args.debug });
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": args.apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts }], generationConfig: config }),
          signal: AbortSignal.timeout(120_000),
        });
        const json = (await readBoundedJson(res)) as
        | { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] }
        | { error?: { message?: string; status?: string } }
        | null;
        return { res, json };
      };
      let { res, json } = await request(generationConfig);
      const initialError = (json as { error?: { message?: string } } | null)?.error?.message ?? "";
      if (!res.ok && res.status === 400 && args.options?.aspectRatio && /imageConfig|aspectRatio|unknown field|unsupported parameter/i.test(initialError)) {
        ({ res, json } = await request({ responseModalities: ["IMAGE"] }));
      }

      if (!res.ok) {
        const message = (json as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
        if (res.status === 429 || message.includes("quota") || message.includes("Quota")) {
          sawQuota = true;
          lastError = message;
          continue;
        }
        return { ok: false, reason: "api_error", message: `${model}: ${message.replaceAll(args.apiKey, "[redacted]")}` };
      }

      const imgPart = (json as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] })
        ?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!imgPart?.inlineData?.data) {
        lastError = `${model}: response contained no image`;
        continue;
      }
      return imageResult(imgPart.inlineData.data, model);
    } catch (error) {
      lastError = (error instanceof Error ? error.message : String(error)).replaceAll(args.apiKey, "[redacted]");
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
  references?: ImageReference[];
  apiKey: string;
  modelId: string;
  baseUrl: string;
  options?: ImageGenerationOptions;
  debug?: ImageDebugContext;
  provider: string;
}): Promise<ImageGenResult> {
  const baseUrl = args.baseUrl.replace(/\/+$/, "");
  assertAllowedAiEndpoint(baseUrl);
  const model = args.modelId;
  const size = args.options?.height && args.options?.width && args.options.height > args.options.width
    ? "1024x1536" : args.options?.height && args.options?.width && args.options.width > args.options.height ? "1536x1024" : "1024x1024";
  try {
    let res: Response | undefined;
    if (args.provider === "openrouter") {
      // OpenRouter's native Images API is not the OpenAI edits endpoint.
      // Discover per-endpoint reference limits rather than infer them from a model name.
      const discovery = await fetchPublicAiEndpoint(`${baseUrl}/images/models/${model.split("/").map(encodeURIComponent).join("/")}/endpoints`, {
        redirect: "error", headers: { Authorization: `Bearer ${args.apiKey}` }, signal: AbortSignal.timeout(20_000),
      });
      const capabilities = await readBoundedJson(discovery) as { endpoints?: { provider_tag?: string; supported_parameters?: Record<string, { type?: string; max?: number; values?: string[] }> }[] } | null;
      const count = args.references?.length ?? 0;
      const eligible = (capabilities?.endpoints ?? []).filter(endpoint => count === 0 ||
        (endpoint.supported_parameters?.input_references?.type === "range" && (endpoint.supported_parameters.input_references.max ?? 0) >= count));
      if (!discovery.ok || !eligible.length) return { ok: false, reason: "api_error",
        message: `The configured OpenRouter model has no image endpoint supporting ${count} references. Select an image-generation model that supports your complete reference set.` };
      const endpoint = eligible[0];
      const parameters: Record<string, unknown> = { model, prompt: args.prompt,
        ...(endpoint.provider_tag ? { provider: { only: [endpoint.provider_tag], allow_fallbacks: false } } : {}),
        ...(count ? { input_references: args.references!.map(reference => ({ type: "image_url", image_url: { url: `data:${reference.mimeType};base64,${reference.base64}` } })) } : {}) };
      const aspect = args.options?.aspectRatio;
      if (aspect && endpoint.supported_parameters?.aspect_ratio?.values?.includes(aspect)) parameters.aspect_ratio = aspect;
      inspectImageRequest({ provider: args.provider, model, prompt: args.prompt, referenceCount: count, references: args.references,
        parameters: { operation: "images", aspectRatio: parameters.aspect_ratio }, context: args.debug });
      res = await fetchPublicAiEndpoint(`${baseUrl}/images`, { redirect: "error", method: "POST",
        headers: { Authorization: `Bearer ${args.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(parameters), signal: AbortSignal.timeout(120_000) });
    } else if (args.references?.length) {
      const edit = new FormData();
      edit.set("model", model);
      edit.set("prompt", args.prompt);
      edit.set("size", size);
      args.references.forEach((reference, index) => edit.append(args.references!.length > 1 ? "image[]" : "image",
        new Blob([Buffer.from(reference.base64, "base64")], { type: reference.mimeType }), `reference-${index + 1}.${reference.mimeType === "image/jpeg" ? "jpg" : reference.mimeType.split("/")[1]}`));
      inspectImageRequest({ provider: args.provider, model, prompt: args.prompt, referenceCount: args.references.length, references: args.references,
        parameters: { operation: "images/edits", size }, context: args.debug });
      const editResponse = await fetchPublicAiEndpoint(`${baseUrl}/images/edits`, {
        redirect: "error", method: "POST", headers: { Authorization: `Bearer ${args.apiKey}` },
        body: edit, signal: AbortSignal.timeout(120_000),
      });
      if (editResponse.ok) res = editResponse;
      else {
        const error = await readBoundedJson(editResponse) as { error?: { message?: string } } | null;
        const message = error?.error?.message ?? `HTTP ${editResponse.status}`;
        return { ok: false, reason: editResponse.status === 429 ? "quota_or_billing" : "api_error",
          message: `${model}: could not generate with all ${args.references.length} image references: ${message.replaceAll(args.apiKey, "[redacted]")}. No references were silently discarded.` };
      }
    }
    if (!res) {
      inspectImageRequest({ provider: args.provider, model, prompt: args.prompt, referenceCount: 0,
        parameters: { operation: "images/generations", n: 1, size, response_format: "b64_json" }, context: args.debug });
      res = await fetchPublicAiEndpoint(`${baseUrl}/images/generations`, {
        redirect: "error", method: "POST",
        headers: { Authorization: `Bearer ${args.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: args.prompt, n: 1, size, response_format: "b64_json" }),
        signal: AbortSignal.timeout(120_000),
      });
    }
    const json = (await readBoundedJson(res)) as
      | { data?: { b64_json?: string }[]; error?: { message?: string } }
      | null;
    if (!res.ok) {
      const message = json?.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 429 || /quota|billing|credit/i.test(message)) {
        return {
          ok: false,
          reason: "quota_or_billing",
          message: `Image generation blocked by the provider: ${message.replaceAll(args.apiKey, "[redacted]")}`,
        };
      }
      return { ok: false, reason: "api_error", message: `${model}: ${message.replaceAll(args.apiKey, "[redacted]")}` };
    }
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) {
      return {
        ok: false,
        reason: "api_error",
        message: `${model}: response contained no image (provider returned no b64_json data)`,
      };
    }
    return imageResult(b64, model);
  } catch (error) {
    return { ok: false, reason: "api_error", message: (error instanceof Error ? error.message : String(error)).replaceAll(args.apiKey, "[redacted]") };
  }
}

/**
 * Generate an image using the workspace's configured image provider/model.
 * `target` comes from getWorkspaceImageTarget(workspaceId) — the caller
 * resolves it so this module stays free of DB access. Dispatch follows the
 * catalog: Gemini → Google REST; Cloudflare → native Workers AI; other
 * providers → the OpenAI Images API against the effective base URL. The
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
  options?: ImageGenerationOptions;
  debug?: ImageDebugContext;
}): Promise<ImageGenResult> {
  if (!args.apiKey) {
    return { ok: false, reason: "api_error", message: "No API key is configured for this workspace's image provider." };
  }
  const entry = catalogEntry(args.provider);
  if (!entry) {
    return { ok: false, reason: "api_error", message: `Unknown image provider "${args.provider}".` };
  }
  if (entry.kind === "gemini") {
    return geminiGenerate({ prompt: args.prompt, references: args.references, apiKey: args.apiKey, modelId: args.modelId, options: args.options, debug: args.debug });
  }
  if (entry.id === "cloudflare") {
    return generateCloudflareImage({ prompt: args.prompt, references: args.references, apiKey: args.apiKey,
      modelId: args.modelId, baseUrl: args.baseUrl ?? "", options: args.options, debug: args.debug });
  }
  // OpenAI-compatible kind. Resolution already filled the catalog default
  // for presets; a `custom` provider with no endpoint fails honestly here
  // instead of silently targeting a default host.
  try {
    const baseUrl = resolvedBaseUrl(args.provider, args.baseUrl);
    if (!baseUrl) throw new Error(`Provider "${args.provider}" requires a Base URL.`);
    return openaiCompatibleGenerate({ prompt: args.prompt, references: args.references, apiKey: args.apiKey, modelId: args.modelId, baseUrl,
      options: args.options, debug: args.debug, provider: args.provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed";
    return { ok: false, reason: "api_error", message };
  }
}
