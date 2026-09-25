import "server-only";

import { cloudflareAccountIdFromBaseUrl } from "@/lib/ai/cloudflare";

export type InputProperty = { type?: string; minimum?: number; maximum?: number; multipleOf?: number; maxLength?: number };
export type CloudflareInputSchema = { properties?: Record<string, InputProperty>; required?: string[] };
const cache = new Map<string, { schema: CloudflareInputSchema; expires: number }>();

/** Cloudflare publishes per-model input schemas; failure leaves generation available. */
export async function getCloudflareInputSchema(baseUrl: string, modelId: string, apiKey: string): Promise<CloudflareInputSchema | null> {
  if (!cloudflareAccountIdFromBaseUrl(baseUrl, "image")) return null;
  const key = `${baseUrl}:${modelId}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.schema;
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/models/schema?model=${encodeURIComponent(modelId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const data = await response.json() as { success?: boolean; result?: { input?: CloudflareInputSchema } };
    if (data.success === false || !data.result?.input) return null;
    cache.set(key, { schema: data.result.input, expires: Date.now() + 60 * 60_000 });
    return data.result.input;
  } catch { return null; }
}

export function supportedNumber(property: InputProperty | undefined, desired: number | undefined): number | undefined {
  if (!property || desired === undefined || !Number.isFinite(desired)) return undefined;
  const clamped = Math.min(property.maximum ?? desired, Math.max(property.minimum ?? desired, desired));
  const multiple = property.multipleOf;
  return multiple && multiple > 0 ? Math.round(clamped / multiple) * multiple : Math.round(clamped);
}
