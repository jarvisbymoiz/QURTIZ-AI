import "server-only";

import sharp from "sharp";
import { cloudflareAccountIdFromBaseUrl, isCloudflareModel } from "@/lib/ai/cloudflare";
import { assertAllowedAiEndpoint } from "@/lib/security/ai-endpoint";
import type { ImageGenResult, ImageReference, ImageGenerationOptions } from "@/lib/ai/image";
import { getCloudflareInputSchema, supportedNumber } from "@/lib/ai/cloudflare-capabilities";
import { inspectImageRequest, type ImageDebugContext } from "@/lib/ai/image-debug";

const MAX_IMAGE_BYTES = 16 * 1024 * 1024;

function decodeImageBase64(value: unknown): Buffer | null {
  if (typeof value !== "string") return null;
  const b64 = value.replace(/^data:image\/(?:png|jpeg|webp);base64,/i, "");
  if (!b64 || b64.length > MAX_IMAGE_BYTES * 1.4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b64)) return null;
  const bytes = Buffer.from(b64, "base64");
  return bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES ? bytes : null;
}

function imageFromResult(value: unknown, depth = 0): Buffer | null {
  if (depth > 3) return null;
  const direct = decodeImageBase64(value);
  if (direct) return direct;
  if (Array.isArray(value)) {
    for (const candidate of value.slice(0, 4)) {
      const image = imageFromResult(candidate, depth + 1);
      if (image) return image;
    }
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["image", "image_b64", "b64_json", "images", "output", "data"]) {
      const image = imageFromResult(record[key], depth + 1);
      if (image) return image;
    }
  }
  return null;
}

function providerError(status: number, detail: string, apiKey: string): ImageGenResult {
  const safeDetail = detail.replaceAll(apiKey, "[redacted]").slice(0, 240);
  if (status === 401 && /permission|scope|not authorized|not allowed/i.test(safeDetail)) {
    return { ok: false, reason: "api_error", message: "Cloudflare token lacks Workers AI permission for this account. Check its account scope and Workers AI Read/Edit permissions." };
  }
  if (status === 401) return { ok: false, reason: "api_error", message: "Cloudflare API token is invalid or revoked. Re-enter it in AI Settings." };
  if (status === 403) return { ok: false, reason: "api_error", message: "Cloudflare token lacks Workers AI permission for this account. Check its account scope and Workers AI Read/Edit permissions." };
  if (status === 404 && /model/i.test(safeDetail)) return { ok: false, reason: "api_error", message: `Cloudflare rejected the image model: ${safeDetail}` };
  if (status === 404) return { ok: false, reason: "api_error", message: "Cloudflare account or image model was not found. Check the Account ID and model name." };
  if (status === 429 || status === 402 || /quota|credit|billing|rate limit/i.test(detail)) {
    return { ok: false, reason: "quota_or_billing", message: "Cloudflare Workers AI rate limit or quota reached. Check usage and billing, then retry." };
  }
  return { ok: false, reason: "api_error", message: `Cloudflare Workers AI rejected the image request (HTTP ${status}): ${safeDetail || "No details provided."}` };
}

async function readLimited(res: Response, limit: number): Promise<Buffer> {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Cloudflare image response exceeded the size limit.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, size);
}

function parseJson(bytes: Buffer): unknown {
  try { return JSON.parse(bytes.toString("utf8")); } catch { return null; }
}

export async function generateCloudflareImage(args: {
  prompt: string;
  references?: ImageReference[];
  apiKey: string;
  modelId: string;
  baseUrl: string;
  options?: ImageGenerationOptions;
  debug?: ImageDebugContext;
}): Promise<ImageGenResult> {
  const accountId = cloudflareAccountIdFromBaseUrl(args.baseUrl, "image");
  if (!accountId) return { ok: false, reason: "api_error", message: "Invalid Cloudflare Account ID or image endpoint. Re-save AI Settings." };
  if (!isCloudflareModel(args.modelId)) {
    return { ok: false, reason: "api_error", message: "Invalid Workers AI model ID. Enter @cf/author/model in AI Settings." };
  }
  const references = args.references ?? [];
  assertAllowedAiEndpoint(args.baseUrl);
  const schema = await getCloudflareInputSchema(args.baseUrl, args.modelId, args.apiKey);
  const properties = schema?.properties ?? {};
  const multipart = Boolean(properties.multipart || schema?.required?.includes("multipart") || Object.keys(properties).some(key => /^input_image_\d+$/.test(key)));
  const body: Record<string, string | number> = { prompt: args.prompt };
  const numeric: [string, number | undefined][] = [
    ["width", args.options?.width], ["height", args.options?.height],
    ["num_steps", args.options?.steps], ["guidance", args.options?.guidance],
    ["steps", args.options?.steps], ["seed", args.options?.seed],
  ];
  for (const [key, desired] of numeric) {
    const value = supportedNumber(properties[key], desired);
    if (value !== undefined) body[key] = value;
  }
  if (properties.negative_prompt && args.options?.negativePrompt) body.negative_prompt = args.options.negativePrompt;
  if (properties.aspect_ratio && args.options?.aspectRatio) body.aspect_ratio = args.options.aspectRatio;
  if (!multipart && references[0] && properties.image_b64) body.image_b64 = references[0].base64;
  const form = new FormData();
  if (multipart) {
    for (const [key, value] of Object.entries(body)) form.set(key, String(value));
    references.slice(0, 4).forEach((reference, index) => {
      if (!properties[`input_image_${index}`]) return;
      form.set(`input_image_${index}`, new Blob([Buffer.from(reference.base64, "base64")], { type: reference.mimeType }), `reference-${index}`);
    });
  }
  const sentReferences = multipart ? references.slice(0, 4).filter((_, index) => Boolean(properties[`input_image_${index}`])).length : Number(Boolean(body.image_b64));
  const { image_b64: _reference, prompt: _prompt, ...loggedParameters } = body;
  void _reference; void _prompt;
  inspectImageRequest({ provider: "cloudflare", model: args.modelId, prompt: args.prompt,
    referenceCount: sentReferences, parameters: { transport: multipart ? "multipart" : "json", ...loggedParameters }, context: args.debug });
  const endpoint = `${args.baseUrl.replace(/\/+$/, "")}/run/${args.modelId}`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers: { Authorization: `Bearer ${args.apiKey}`, ...(!multipart ? { "Content-Type": "application/json" } : {}), Accept: "image/*, application/json" },
      body: multipart ? form : JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    const contentLength = Number(res.headers.get("content-length"));
    if (contentLength > MAX_IMAGE_BYTES) return { ok: false, reason: "api_error", message: "Cloudflare image response is too large." };
    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    if (!res.ok) {
      const errorJson = parseJson(await readLimited(res, 64 * 1024)) as { errors?: { message?: string }[]; error?: { message?: string } } | null;
      const detail = errorJson?.errors?.[0]?.message ?? errorJson?.error?.message ?? "";
      return providerError(res.status, detail, args.apiKey);
    }
    let image: Buffer | null;
    if (!contentType || contentType.startsWith("image/") || contentType.startsWith("application/octet-stream")) {
      image = await readLimited(res, MAX_IMAGE_BYTES);
    } else if (contentType.includes("json")) {
      const json = parseJson(await readLimited(res, MAX_IMAGE_BYTES)) as { success?: boolean; result?: unknown; image?: string; errors?: { message?: string }[] } | null;
      if (json?.success === false) return providerError(400, json.errors?.[0]?.message ?? "Cloudflare reported an unsuccessful response.", args.apiKey);
      image = imageFromResult(json?.result ?? json?.image);
    } else {
      return { ok: false, reason: "api_error", message: "Cloudflare returned an unsupported image response format." };
    }
    if (!image || image.length === 0 || image.length > MAX_IMAGE_BYTES) {
      return { ok: false, reason: "api_error", message: "Cloudflare returned no valid image data." };
    }
    // Normalize any supported model's returned image to the existing PNG storage format.
    let png: Buffer;
    try {
      png = await sharp(image, { limitInputPixels: 16 * 1024 * 1024 }).png().toBuffer();
    } catch {
      return { ok: false, reason: "api_error", message: "Cloudflare returned malformed image data." };
    }
    if (png.length > MAX_IMAGE_BYTES) return { ok: false, reason: "api_error", message: "Generated image exceeds the storage size limit." };
    return { ok: true, png, model: args.modelId };
  } catch (error) {
    return { ok: false, reason: "api_error", message: `Cloudflare image request failed: ${error instanceof Error ? error.message.replaceAll(args.apiKey, "[redacted]") : "Network or image decoding error."}` };
  }
}
