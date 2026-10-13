import "server-only";

/** Deployment-wide traffic must not become visible to arbitrary tenant owners. Fail closed. */
export function canViewWebsiteAnalytics(userId: string): boolean {
  const configured = process.env.QURTIZ_WEBSITE_ANALYTICS_ADMIN_IDS ?? "";
  return configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(userId);
}
