/**
 * Notification payload + destination logic (pure — no DB, no React).
 *
 * Producers (Auto Run, publishing worker, bulk pipeline) build structured
 * metadata here and persist it in notifications.meta (jsonb). The
 * Notifications page resolves CLICK DESTINATIONS from that metadata:
 * real platform permalinks for live posts ("View on Facebook" / "View on
 * Instagram" in a new tab), the relevant Qurtiz context otherwise. URLs
 * are only ever taken from real publishing results — never fabricated.
 */

export type NotificationPlatform = "facebook" | "instagram";

export type NotificationFormat = "single_image" | "carousel" | "reel" | "story" | "text_post" | string;

export type PublishedDestination = {
  platform: NotificationPlatform;
  permalink: string;
  providerPostId?: string | null;
};

export type NotificationPostSummary = {
  id?: string;
  topic: string;
  format?: NotificationFormat;
  platforms?: NotificationPlatform[];
  status?: string;
  scheduledAt?: string | null;
};

export type NotificationMeta = {
  /** Stable event family: auto_run, bulk_plan, publish_completed, publish_failed, auth_expired, scheduled … */
  type?: string;
  contentItemId?: string;
  jobId?: string;
  autoRunId?: string;
  runId?: string;
  topic?: string;
  format?: NotificationFormat;
  /** Single-platform events set this; multi-platform events set `platforms`. */
  platform?: NotificationPlatform;
  platforms?: NotificationPlatform[];
  status?: string;
  scheduledAt?: string | null;
  publishStatus?: string;
  posts?: NotificationPostSummary[];
  /** Real live-post permalinks (Meta pipeline; Buffer has none reliable). */
  destinations?: PublishedDestination[];
  error?: string;
  createdCount?: number;
  failedCount?: number;
  qaFailedCount?: number;
  targetCount?: number;
};

/* ── Label helpers ─────────────────────────────────────────────────── */

export function formatLabel(format: NotificationFormat | null | undefined): string {
  switch (format) {
    case "single_image":
      return "Single Image";
    case "carousel":
      return "Carousel";
    case "reel":
      return "Reel";
    case "story":
      return "Story";
    case "text_post":
      return "Text Post";
    default:
      return format ? String(format).replaceAll("_", " ") : "Post";
  }
}

export function platformLabel(platform: NotificationPlatform): string {
  return platform === "facebook" ? "Facebook" : "Instagram";
}

export function summarizePlatforms(platforms: readonly NotificationPlatform[] | null | undefined): string {
  const set = new Set(platforms ?? []);
  if (set.has("facebook") && set.has("instagram")) return "Facebook + Instagram";
  if (set.has("facebook")) return "Facebook";
  if (set.has("instagram")) return "Instagram";
  return "—";
}

export function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "ready_for_review":
      return "Ready for Review";
    case "approved":
      return "Approved";
    case "scheduled":
      return "Scheduled";
    case "published":
      return "Published";
    case "failed":
      return "Failed";
    case "rejected":
      return "Rejected";
    default:
      return status ?? "Ready for Review";
  }
}

/** Compact schedule time for notification copy: "2026-09-30 18:30". */
export function formatScheduleWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/* ── Auto Run notification ─────────────────────────────────────────── */

export function buildAutoRunCompletedNotification(args: {
  jobId: string;
  posts: NotificationPostSummary[];
  targetCount: number;
  errors: string[];
}): { title: string; body: string; kind: "content_ready"; link: string; meta: NotificationMeta } {
  const { posts, targetCount, jobId } = args;

  let body: string;
  if (posts.length === 1) {
    const p = posts[0];
    const scheduled = formatScheduleWhen(p.scheduledAt);
    body =
      `Created: "${p.topic}"\n` +
      `${summarizePlatforms(p.platforms)} · ${formatLabel(p.format)} · ${statusLabel(p.status)}` +
      (scheduled ? ` · Scheduled ${scheduled}` : "");
  } else if (posts.length > 1) {
    const shown = posts.slice(0, 3).map((p) => `"${p.topic}"`);
    const rest = posts.length - shown.length;
    body = `${posts.length} posts created: ${shown.join(", ")}${rest > 0 ? ` +${rest} more` : ""}.`;
  } else {
    body = `Run finished — no QA-passed posts were produced. Review the run for details.`;
  }
  if (args.errors.length > 0) {
    body += `\nWarnings: ${args.errors.join("; ").slice(0, 300)}`;
  }

  return {
    kind: "content_ready",
    title: "Auto Run completed",
    body,
    link: "/content-studio",
    meta: {
      type: "auto_run",
      jobId,
      autoRunId: jobId,
      posts,
      createdCount: posts.length,
      targetCount,
      status:
        posts.length > 0 && posts.every((p) => p.status === "scheduled")
          ? "scheduled"
          : posts.length > 0 && posts.every((p) => p.status === "published")
            ? "published"
            : "ready_for_review",
    },
  };
}

export function buildAutoRunTerminalNotification(args: {
  jobId: string;
  createdCount: number;
  total: number;
  disabled: boolean;
  message: string;
}): { title: string; body: string; kind: "system"; link: string; meta: NotificationMeta } {
  return {
    kind: "system",
    title: args.disabled ? "Auto Run stopped" : "Auto Run failed",
    body: `${args.createdCount} / ${args.total} valid posts preserved. ${args.disabled ? "Disabled in Settings." : args.message}`,
    link: "/content-studio",
    meta: { type: "auto_run", jobId: args.jobId, autoRunId: args.jobId, status: args.disabled ? "cancelled" : "failed", error: args.disabled ? undefined : args.message },
  };
}

/* ── Publishing notifications ──────────────────────────────────────── */

export function buildPublishedNotification(args: {
  contentItemId: string;
  topic: string;
  format?: NotificationFormat;
  destinations: PublishedDestination[];
  /** Platforms published (includes those without a reliable permalink, e.g. Buffer). */
  publishedPlatforms: NotificationPlatform[];
  pendingDelivery?: boolean;
  commentNote?: string | null;
}): { title: string; body: string; kind: "publishing_completed"; link: string | null; meta: NotificationMeta } {
  const platformsText = summarizePlatforms(args.publishedPlatforms);
  return {
    kind: "publishing_completed",
    title: args.pendingDelivery ? "Accepted for delivery" : "Published successfully",
    body: args.pendingDelivery
      ? `"${args.topic}" was accepted by the provider and is awaiting delivery confirmation.`
      : `"${args.topic}" is live on ${platformsText}.` + (args.commentNote ? `\nFirst Comment: ${args.commentNote}` : ""),
    // Internal Open survives ONLY as a no-permalink fallback — a live post
    // always wins over routing the user back to Content Studio.
    link: args.destinations.length > 0 ? null : "/content-studio",
    meta: {
      type: "publish_completed",
      contentItemId: args.contentItemId,
      topic: args.topic,
      format: args.format,
      platforms: args.publishedPlatforms,
      publishStatus: args.pendingDelivery ? "pending" : "published",
      destinations: args.destinations.length > 0 ? args.destinations : undefined,
    },
  };
}

export function buildPublishFailedNotification(args: {
  contentItemId: string;
  platform?: NotificationPlatform;
  topic?: string;
  error: string;
}): { title: string; body: string; kind: "publishing_failed"; link: string; meta: NotificationMeta } {
  return {
    kind: "publishing_failed",
    title: "Publishing failed",
    body: `${args.topic ? `"${args.topic}"` : "Post"}${args.platform ? ` (${platformLabel(args.platform)})` : ""}: ${args.error} Review the post and retry.`,
    link: "/content-studio",
    meta: {
      type: "publish_failed",
      contentItemId: args.contentItemId,
      topic: args.topic,
      platforms: args.platform ? [args.platform] : undefined,
      publishStatus: "failed",
      error: args.error,
    },
  };
}

/* ── Destination resolution (UI) ───────────────────────────────────── */

export type NotificationDestinations = {
  external: PublishedDestination[];
  internal: string | null;
};

/**
 * Where the notification should take the user. Live platform permalinks
 * ALWAYS win; Content Studio/Post Review is only the fallback when there
 * is no external live post (ready-for-review, scheduled, draft, failed).
 * Legacy rows (meta = {}) keep their stored link.
 */
export function resolveNotificationDestinations(row: { link: string | null; meta?: unknown }): NotificationDestinations {
  const meta = (row.meta ?? {}) as NotificationMeta;
  const external = (meta.destinations ?? []).filter(
    (d) => typeof d?.permalink === "string" && /^https?:\/\//.test(d.permalink),
  );
  // A live platform post ALWAYS wins: never route a successful publish with a
  // valid URL back to Content Studio.
  if (external.length > 0) return { external, internal: null };
  const internal = row.link ?? (meta.contentItemId ? "/content-studio" : null);
  return { external, internal };
}
