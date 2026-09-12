/**
 * Centralized utility to resolve the canonical public application URL.
 * Used across authentication redirects (magic link, signup confirmation),
 * OAuth callbacks (Meta, Buffer), and transactional links.
 */

export function getPublicAppUrl(request?: Request): string {
  // 1. Explicit environment variable takes highest priority if set to a real domain
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (envUrl && !envUrl.includes("localhost")) {
    return envUrl;
  }

  // 2. Derive from incoming HTTP request headers (works seamlessly on Vercel)
  if (request) {
    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host");
    const proto =
      request.headers.get("x-forwarded-proto") ||
      (host?.includes("localhost") ? "http" : "https");

    if (host) {
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  }

  // 3. Client-side browser origin
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  // 4. Fallback if envUrl is set
  if (envUrl) {
    return envUrl;
  }

  // 5. Canonical production Vercel deployment URL
  return "https://qurtiz-ai.vercel.app";
}
