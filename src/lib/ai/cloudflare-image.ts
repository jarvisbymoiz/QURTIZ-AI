import "server-only";

import sharp from "sharp";
import { cloudflareAccountIdFromBaseUrl, isSupportedCloudflareImageModel } from "@/lib/ai/cloudflare";
import { assertAllowedAiEndpoint } from "@/lib/security/ai-endpoint";
import type { ImageGenResult, ImageReference } from "@/lib/ai/image";

const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const FLUX = "@cf/black-forest-labs/flux-1-schnell";
const SDXL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";

function decodeImageBase64(value: unknown): Buffer | null {
  if (typeof value !== "string") return null;
  const b64 = value.replace(/^data:image\/(?:png|jpeg|webp);base64,/i, "");
  if (!b64 || b64.length > MAX_IMAGE_BYTES * 1.4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b64)) return null;
  const bytes = Buffer.from(b64, "base64");
  return bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES ? bytes : null;
}

function providerError(status: number, detail: string, apiKey: string): ImageGenResult {
  const safeDetail = detail.replaceAll(apiKey, "[redacted]").slice(0, 240);
  if (status === 401 && /permission|scope|not authorized|not allowed/i.test(safeDetail)) {
    return { ok: false, reason: "api_error", message: "Cloudflare token lacks Workers AI permission for this account. Check its account scope and Workers AI Read/Edit permissions." };
  }
  if (status === 401) return { ok: false, reason: "api_error", message: "Cloudflare API token is invalid or revoked. Re-enter it in AI Settings." };
  if (status === 403) return { ok: false, reason: "api_error", message: "Cloudflare token lacks Workers AI permission for this account. Check its account scope and Workers AI Read/Edit permissions." };
  if (status === 404 && /model/i.test(safeDetail)) return { ok: false, reason: "api_error", message: "Cloudflare image model was not found or is unavailable for this account." };
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
}): Promise<ImageGenResult> {
  const accountId = cloudflareAccountIdFromBaseUrl(args.baseUrl, "image");
  if (!accountId) return { ok: false, reason: "api_error", message: "Invalid Cloudflare Account ID or image endpoint. Re-save AI Settings." };
  if (!isSupportedCloudflareImageModel(args.modelId)) {
    return { ok: false, reason: "api_error", message: "Unsupported Cloudflare image model. Choose FLUX.1 schnell or Stable Diffusion XL in AI Settings." };
  }
  if (args.prompt.length > 2048 && args.modelId === FLUX) {
    return { ok: false, reason: "api_error", message: "FLUX.1 schnell accepts image prompts up to 2,048 characters." };
  }
  const references = args.references ?? [];
  if (references.length > 0 && (args.modelId === FLUX || references.length > 1)) {
    return { ok: false, reason: "api_error", message: args.modelId === FLUX
      ? "FLUX.1 schnell does not accept reference images. Use Stable Diffusion XL or remove the Brand Brain image reference."
      : "Stable Diffusion XL accepts one reference image. Keep one avatar or reference image in Brand Brain." };
  }
  assertAllowedAiEndpoint(args.baseUrl);
  const body: Record<string, string> = { prompt: args.prompt };
  if (args.modelId === SDXL && references[0]) body.image_b64 = references[0].base64;
  const endpoint = `${args.baseUrl.replace(/\/+$/, "")}/run/${args.modelId}`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers: { Authorization: `Bearer ${args.apiKey}`, "Content-Type": "application/json", Accept: "image/*, application/json" },
      body: JSON.stringify(body),
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
      const json = parseJson(await readLimited(res, MAX_IMAGE_BYTES)) as { success?: boolean; result?: { image?: string } | string; image?: string; errors?: { message?: string }[] } | null;
      if (json?.success === false) return providerError(400, json.errors?.[0]?.message ?? "Cloudflare reported an unsuccessful response.", args.apiKey);
      const result = json?.result;
      image = decodeImageBase64(typeof result === "string" ? result : result?.image ?? json?.image);
    } else {
      return { ok: false, reason: "api_error", message: "Cloudflare returned an unsupported image response format." };
    }
    if (!image || image.length === 0 || image.length > MAX_IMAGE_BYTES) {
      return { ok: false, reason: "api_error", message: "Cloudflare returned no valid image data." };
    }
    // The existing media pipeline stores PNG. FLUX emits JPEG; SDXL may emit
    // binary. Normalize and validate bytes before handing them to storage.
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
