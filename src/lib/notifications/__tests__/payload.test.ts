import { describe, expect, it } from "vitest";
import {
  buildAutoRunCompletedNotification,
  buildPublishedNotification,
  buildPublishFailedNotification,
  formatLabel,
  platformLabel,
  resolveNotificationDestinations,
  statusLabel,
  type NotificationPostSummary,
} from "../payload";

describe("labels", () => {
  it("formats content types for humans", () => {
    expect(formatLabel("single_image")).toBe("Single Image");
    expect(formatLabel("carousel")).toBe("Carousel");
    expect(formatLabel("reel")).toBe("Reel");
    expect(formatLabel("text_post")).toBe("Text Post");
  });

  it("formats platforms + statuses", () => {
    expect(platformLabel("facebook")).toBe("Facebook");
    expect(platformLabel("instagram")).toBe("Instagram");
    expect(statusLabel("ready_for_review")).toBe("Ready for Review");
    expect(statusLabel("scheduled")).toBe("Scheduled");
    expect(statusLabel("published")).toBe("Published");
  });
});

describe("Auto Run notifications", () => {
  const singlePost: NotificationPostSummary = {
    id: "item-1",
    topic: "5 Canva AI Hacks",
    format: "carousel",
    status: "ready_for_review",
    scheduledAt: null,
    platforms: ["instagram"],
  };

  it("names the created post (topic · format · platform · status)", () => {
    const n = buildAutoRunCompletedNotification({ jobId: "job-1", posts: [singlePost], targetCount: 1, errors: [] });
    expect(n.kind).toBe("content_ready");
    expect(n.title).toBe("Auto Run completed");
    expect(n.body).toContain('Created: "5 Canva AI Hacks"');
    expect(n.body).toContain("Instagram · Carousel · Ready for Review");
    expect(n.meta.posts?.[0]?.topic).toBe("5 Canva AI Hacks");
    expect(n.meta.posts?.[0]?.format).toBe("carousel");
    expect(n.meta.posts?.[0]?.platforms).toEqual(["instagram"]);
    expect(n.link).toBe("/content-studio");
    expect(n.meta.type).toBe("auto_run");
    expect(n.meta.createdCount).toBe(1);
  });

  it("shows both platforms for a cross-posted item", () => {
    const n = buildAutoRunCompletedNotification({
      jobId: "job-2",
      posts: [{ ...singlePost, id: "item-2", platforms: ["facebook", "instagram"], format: "single_image", status: "published" }],
      targetCount: 1,
      errors: [],
    });
    expect(n.body).toContain("Facebook + Instagram · Single Image · Published");
    expect(n.meta.status).toBe("published");
  });

  it("summarises multi-post runs with a count and topic preview", () => {
    const posts: NotificationPostSummary[] = [
      { id: "a", topic: "Alpha", format: "single_image", status: "draft", scheduledAt: null, platforms: ["facebook"] },
      { id: "b", topic: "Beta", format: "reel", status: "ready_for_review", scheduledAt: null, platforms: ["instagram"] },
      { id: "c", topic: "Gamma", format: "text_post", status: "draft", scheduledAt: null, platforms: ["facebook", "instagram"] },
      { id: "d", topic: "Delta", format: "carousel", status: "draft", scheduledAt: null, platforms: ["facebook"] },
    ];
    const n = buildAutoRunCompletedNotification({ jobId: "job-3", posts, targetCount: 5, errors: [] });
    expect(n.body).toContain("4 posts created");
    expect(n.body).toContain('"Alpha"');
    expect(n.body).toContain("+1 more");
    expect(n.meta.createdCount).toBe(4);
    expect(n.meta.targetCount).toBe(5);
    // Mixed statuses honestly collapse to the review state, never "published".
    expect(n.meta.status).toBe("ready_for_review");
  });

  it("shows scheduled date/time for scheduled posts", () => {
    const n = buildAutoRunCompletedNotification({
      jobId: "job-4",
      posts: [{ ...singlePost, id: "item-5", status: "scheduled", scheduledAt: "2026-09-22T14:30:00.000Z" }],
      targetCount: 1,
      errors: [],
    });
    expect(n.body).toContain("Scheduled 2026-09-22 14:30 UTC");
    expect(n.meta.posts?.[0]?.scheduledAt).toBe("2026-09-22T14:30:00.000Z");
    expect(n.meta.status).toBe("scheduled");
  });

  it("surfaces warnings when the run had errors", () => {
    const n = buildAutoRunCompletedNotification({
      jobId: "job-6",
      posts: [singlePost],
      targetCount: 2,
      errors: ["Rate limited on topic 2", "Visual generation failed"],
    });
    expect(n.body).toContain("Warnings:");
    expect(n.body).toContain("Rate limited on topic 2");
  });

  it("handles a run that created nothing", () => {
    const n = buildAutoRunCompletedNotification({ jobId: "job-7", posts: [], targetCount: 3, errors: [] });
    expect(n.body).toContain("no QA-passed posts");
    expect(n.meta.createdCount).toBe(0);
  });
});

describe("Published notifications", () => {
  it("Meta publish exposes the real permalink as an external destination", () => {
    const n = buildPublishedNotification({
      contentItemId: "item-1",
      topic: "Launch teaser",
      publishedPlatforms: ["facebook"],
      destinations: [{ platform: "facebook", permalink: "https://www.facebook.com/123/posts/456" }],
    });
    expect(n.kind).toBe("publishing_completed");
    expect(n.title).toBe("Published successfully");
    expect(n.body).toContain('"Launch teaser" is live on Facebook');
    // The notification itself links externally — never back to Content Studio.
    expect(n.link).toBeNull();
    expect(n.meta.destinations).toEqual([{ platform: "facebook", permalink: "https://www.facebook.com/123/posts/456" }]);
    expect(n.meta.publishStatus).toBe("published");
  });

  it("both platforms produce both destinations", () => {
    const n = buildPublishedNotification({
      contentItemId: "item-2",
      topic: "Cross post",
      publishedPlatforms: ["facebook", "instagram"],
      destinations: [
        { platform: "facebook", permalink: "https://www.facebook.com/1/posts/2" },
        { platform: "instagram", permalink: "https://www.instagram.com/p/ABC/" },
      ],
    });
    expect(n.body).toContain("Facebook + Instagram");
    expect(n.meta.destinations).toHaveLength(2);
  });

  it("Buffer without a permalink keeps the internal fallback (never fabricates URLs)", () => {
    const n = buildPublishedNotification({
      contentItemId: "item-3",
      topic: "Buffered",
      publishedPlatforms: ["facebook"],
      destinations: [],
      pendingDelivery: true,
    });
    expect(n.title).toBe("Accepted for delivery");
    expect(n.link).toBe("/content-studio");
    expect(n.meta.publishStatus).toBe("pending");
    expect(n.meta.destinations).toBeUndefined();
  });
});

describe("Failed publish notifications", () => {
  it("points at the post with error context for review/retry", () => {
    const n = buildPublishFailedNotification({
      contentItemId: "item-9",
      platform: "instagram",
      topic: "Reel draft",
      error: "Media upload timed out",
    });
    expect(n.kind).toBe("publishing_failed");
    expect(n.title).toBe("Publishing failed");
    expect(n.body).toContain("(Instagram)");
    expect(n.body).toContain('"Reel draft"');
    expect(n.body).toContain("Media upload timed out");
    expect(n.link).toBe("/content-studio");
    expect(n.meta.publishStatus).toBe("failed");
    expect(n.meta.platforms).toEqual(["instagram"]);
  });
});

describe("resolveNotificationDestinations", () => {
  it("passes through validated external destinations from meta", () => {
    const r = resolveNotificationDestinations({
      link: null,
      meta: { destinations: [{ platform: "instagram", permalink: "https://www.instagram.com/p/XYZ/" }] },
    });
    expect(r.external).toHaveLength(1);
    expect(r.internal).toBeNull();
  });

  it("rejects non-http(s) permalinks and falls back internally", () => {
    const r = resolveNotificationDestinations({
      link: "/content-studio",
      meta: { destinations: [{ platform: "instagram", permalink: "javascript:alert(1)" }] },
    });
    expect(r.external).toHaveLength(0);
    expect(r.internal).toBe("/content-studio");
  });

  it("builds the internal fallback from meta contentItemId when no link stored", () => {
    const r = resolveNotificationDestinations({
      link: null,
      meta: { contentItemId: "item-42" },
    });
    expect(r.internal).toBe("/content-studio");
  });

  it("legacy rows (empty meta object) keep their stored link", () => {
    const r = resolveNotificationDestinations({ link: "/settings", meta: {} });
    expect(r.external).toHaveLength(0);
    expect(r.internal).toBe("/settings");
  });

  it("old rows with no meta value at all still render", () => {
    const r = resolveNotificationDestinations({ link: "/content-studio", meta: undefined });
    expect(r.internal).toBe("/content-studio");
  });

  it("survives a JSON round trip (persistence after refresh/login)", () => {
    const n = buildPublishedNotification({
      contentItemId: "item-rt",
      topic: "Round trip",
      publishedPlatforms: ["facebook"],
      destinations: [{ platform: "facebook", permalink: "https://www.facebook.com/9/posts/8" }],
    });
    const revived = JSON.parse(JSON.stringify(n.meta));
    const r = resolveNotificationDestinations({ link: n.link, meta: revived });
    expect(r.external[0]?.permalink).toBe("https://www.facebook.com/9/posts/8");
    expect(r.internal).toBeNull();
  });
});
