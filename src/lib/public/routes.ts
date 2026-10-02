/** Exact public routes: never exempt arbitrary application routes from auth. */
export const PUBLIC_PAGE_PATHS = [
  "/",
  "/features",
  "/about",
  "/open-source",
  "/security",
  "/contact",
  "/changelog",
  "/faq",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/data-deletion",
  "/articles",
] as const;
export function isPublicWebsitePath(path: string): boolean {
  return (
    PUBLIC_PAGE_PATHS.some((p) => p === path) ||
    /^\/articles\/[^/]+\/?$/.test(path) ||
    [
      "/sitemap.xml",
      "/robots.txt",
      "/rss.xml",
      "/llms.txt",
      "/manifest.webmanifest",
      "/opengraph-image",
      "/icon",
      "/apple-icon",
    ].some((p) => path === p || path.startsWith(`${p}/`))
  );
}

export function safeAuthDestination(value: string | null): string {
  if (
    !value ||
    value === "/" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value) ||
    /^\/(login|signup|auth)(\/|\?|#|$)/.test(value)
  )
    return "/dashboard";
  return value;
}
