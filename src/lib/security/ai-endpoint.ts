import "server-only";
import { AI_PROVIDER_CATALOG } from "@/lib/ai/provider-catalog";
import { cloudflareAccountIdFromBaseUrl } from "@/lib/ai/cloudflare";

/** Workspace settings cannot turn the server into an arbitrary HTTP proxy.
 * Custom gateways are explicitly trusted by the deployment operator. */
export function assertAllowedAiEndpoint(raw: string): void {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Invalid AI endpoint URL."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("AI endpoints must be HTTP(S) URLs without credentials, query strings or fragments.");
  }
  // Trust only Cloudflare's exact account-scoped AI bases. Never allow an
  // arbitrary hostname, path, port, redirect target, or account-ID fragment.
  if (url.hostname === "api.cloudflare.com" && url.pathname.startsWith("/client/v4/accounts/")) {
    if (!cloudflareAccountIdFromBaseUrl(raw)) throw new Error("Invalid Cloudflare Workers AI endpoint.");
    return;
  }
  const normalize = (value: string) => new URL(value).href.replace(/\/+$/, "");
  const configured = (process.env.AI_ALLOWED_BASE_URLS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const presets = Object.values(AI_PROVIDER_CATALOG).flatMap((entry) =>
    entry.defaultBaseUrl && (entry.group !== "local" || process.env.NODE_ENV !== "production")
      ? [entry.defaultBaseUrl] : []);
  const allowed = [...presets, ...configured].some((value) => {
    try { return normalize(value) === normalize(raw); } catch { return false; }
  });
  if (!allowed) {
    throw new Error("This AI endpoint is not allowed by the server. Add its exact base URL to AI_ALLOWED_BASE_URLS or use a preset endpoint.");
  }
}
