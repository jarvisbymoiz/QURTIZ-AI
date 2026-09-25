/** Cloudflare Workers AI account URLs are derived from a 32-digit account ID.
 * This pure module is shared by the settings UI and server validation. */
const ACCOUNT_ID = /^[0-9a-f]{32}$/i;
const BASE = /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/([0-9a-f]{32})\/ai(?:\/(v1))?\/?$/i;
const MODEL = /^@cf\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i;

export function isCloudflareAccountId(value: string): boolean {
  return ACCOUNT_ID.test(value);
}

export function cloudflareBaseUrl(accountId: string, side: "text" | "image"): string {
  if (!isCloudflareAccountId(accountId)) throw new Error("Cloudflare Account ID must be 32 hexadecimal characters.");
  return `https://api.cloudflare.com/client/v4/accounts/${accountId.toLowerCase()}/ai${side === "text" ? "/v1" : ""}`;
}

export function cloudflareAccountIdFromBaseUrl(baseUrl: string, side?: "text" | "image"): string | null {
  const match = BASE.exec(baseUrl);
  if (!match || (side === "text" && !match[2]) || (side === "image" && match[2])) return null;
  return match[1].toLowerCase();
}

export function isCloudflareModel(model: string): boolean {
  return MODEL.test(model);
}
