import { afterEach, describe, expect, it, vi } from "vitest";
import { GRAPH_VERSION } from "@/lib/meta/oauth";
import { publishPost } from "@/lib/meta/publish";
import { buildCreatePostVariables } from "@/lib/buffer/client";
import { mediaFormatError, orderVisuals, selectPublishMedia } from "@/lib/publishing/media";

/* --------------------------- selection (pure) --------------------------- */
describe("selectPublishMedia", () => {
  it("rejects image-only Reels and video carousels before publishing", () => {
    const image = selectPublishMedia([{ storagePath: "a", mimeType: "image/png", slideIndex: 0 }]);
    const video = selectPublishMedia([{ storagePath: "v", mimeType: "video/quicktime", slideIndex: 0 }]);
    expect(mediaFormatError("reel", image)).toMatch(/uploaded video/);
    expect(mediaFormatError("reel", selectPublishMedia([]))).toMatch(/uploaded video/);
    expect(mediaFormatError("carousel", video)).toMatch(/images/);
    expect(mediaFormatError("reel", video)).toBeNull();
    expect(mediaFormatError("carousel", image)).toBeNull();
    expect(mediaFormatError("single", image)).toBeNull();
  });

  it("preserves legacy ties and row identity without mutating persisted inputs", () => {
    const rows = [
      { id: "legacy", storagePath: "a", mimeType: "image/png", slideIndex: null },
      { id: "second", storagePath: "b", mimeType: "image/png", slideIndex: 2 },
      { id: "first", storagePath: "c", mimeType: "image/png", slideIndex: 0 },
      { id: "tied", storagePath: "d", mimeType: "image/png", slideIndex: 2 },
    ];
    expect(orderVisuals(rows).map(r => r.id)).toEqual(["first", "second", "tied", "legacy"]);
    expect(rows.map(r => r.id)).toEqual(["legacy", "second", "first", "tied"]);
  });
  it("1 image -> image; 3 images -> ordered carousel", () => {
    const one = selectPublishMedia([{ storagePath: "a.png", mimeType: "image/png", slideIndex: 0 }]);
    expect(one.kind).toBe("image");
    const three = selectPublishMedia([
      { storagePath: "c.png", mimeType: "image/png", slideIndex: 2 },
      { storagePath: "a.png", mimeType: "image/png", slideIndex: 0 },
      { storagePath: "b.png", mimeType: "image/png", slideIndex: 1 },
    ]);
    expect(three.kind).toBe("images");
    expect(three.paths).toEqual(["a.png", "b.png", "c.png"]);
  });

  it("a video wins over images and is never converted", () => {
    const s = selectPublishMedia([
      { storagePath: "a.png", mimeType: "image/png", slideIndex: 0 },
      { storagePath: "reel.mp4", mimeType: "video/mp4", slideIndex: 1 },
    ]);
    expect(s).toEqual({ kind: "video", paths: ["reel.mp4"], mimeTypes: ["video/mp4"] });
  });

  it("ignores unknown mime types and puts null slideIndex last", () => {
    expect(selectPublishMedia([{ storagePath: "x.bin", mimeType: "application/pdf", slideIndex: 0 }]).kind).toBe("none");
    const ordered = orderVisuals([
      { storagePath: "n.png", mimeType: "image/png", slideIndex: null },
      { storagePath: "s.png", mimeType: "image/png", slideIndex: 0 },
    ]);
    expect(ordered.map((v) => v.storagePath)).toEqual(["s.png", "n.png"]);
  });
});

/* ------------------------- Meta payloads (mocked) ----------------------- */
type Call = { url: string; method: string; params: URLSearchParams; headers: Headers };

function stubGraph() {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    const params = new URLSearchParams(String(init?.body ?? ""));
    const headers = new Headers(init?.headers);
    calls.push({ url: u, method, params, headers });
    const path = new URL(u).pathname;
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });

    // IG container status poll
    if (method === "GET" && params.has("fields") === false && u.includes("fields=status_code")) return json({ status_code: "FINISHED" });
    if (method === "GET" && u.includes("fields=status_code,status")) return json({ status_code: "FINISHED" });
    if (method === "GET" && u.includes("fields=permalink")) return json({ permalink: "https://example/p/1" });
    if (method === "GET" && u.includes("fields=permalink_url")) return json({ permalink_url: "https://fb/p/1" });
    if (method === "POST" && path.endsWith("/media_publish")) return json({ id: "media-1" });
    if (method === "POST" && path.endsWith("/media")) return json({ id: "container-" + String(calls.length) });
    if (method === "POST" && path.endsWith("/feed")) return json({ id: "fb-post-1" });
    if (method === "POST" && path.endsWith("/photos")) return json({ id: "fb-photo-" + String(calls.length) });
    if (method === "POST" && path.endsWith("/video_reels") && params.get("upload_phase") === "START") {
      return json({ video_id: "fb-reel-1", upload_url: `https://rupload.facebook.com/video-upload/${GRAPH_VERSION}/fb-reel-1` });
    }
    if (method === "POST" && u.startsWith("https://rupload.facebook.com/")) return json({ success: true });
    if (method === "POST" && path.endsWith("/video_reels") && params.get("upload_phase") === "FINISH") return json({ success: true });
    if (method === "POST" && path.endsWith("/videos")) return json({ id: "fb-video-1" });
    return json({ id: "ok" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls };
}

afterEach(() => vi.unstubAllGlobals());

const base = { pageToken: "token", pageId: "page-1", igUserId: "ig-1", message: "hello" };

describe("Facebook payloads", () => {
  it("treats a successful HTTP response with no post ID as an uncertain delivery", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    expect(await publishPost({ ...base, platform: "facebook", imageUrl: null })).toMatchObject({ ok: false, reason: "unknown_outcome" });
  });
  it.each([
    [{ code: 4, message: "Throttled" }, "rate_limited"],
    [{ code: 2, is_transient: true, message: "Try later" }, "transient_provider"],
    [{ code: 100, message: "Invalid parameter" }, "graph_error"],
  ])("classifies explicit main-post rejections without changing successful payloads", async (error, reason) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error }), { status: 400 })));
    const result = await publishPost({ ...base, platform: "facebook", imageUrl: null });
    expect(result).toMatchObject({ ok: false, reason });
  });
  it("single image -> /photos with url + caption", async () => {
    const { calls } = stubGraph();
    const res = await publishPost({ ...base, platform: "facebook", imageUrl: "https://cdn/1.png" });
    expect(res.ok).toBe(true);
    const photo = calls.find((c) => c.url.endsWith("/photos"))!;
    expect(photo.params.get("url")).toBe("https://cdn/1.png");
    expect(photo.params.get("caption")).toBe("hello");
  });

  it("carousel -> unpublished photos + one feed post with attached_media", async () => {
    const { calls } = stubGraph();
    const res = await publishPost({
      ...base, platform: "facebook", imageUrl: null,
      imageUrls: ["https://cdn/1.png", "https://cdn/2.png"],
    });
    expect(res.ok).toBe(true);
    const photos = calls.filter((c) => c.url.endsWith("/photos"));
    expect(photos).toHaveLength(2);
    expect(photos.every((p) => p.params.get("published") === "false")).toBe(true);
    const feed = calls.find((c) => c.url.endsWith("/feed"))!;
    expect(feed.params.get("message")).toBe("hello");
    const attached = JSON.parse(feed.params.get("attached_media") ?? "[]");
    expect(attached).toHaveLength(2);
    expect(attached[0]).toHaveProperty("media_fbid");
  });

  it("reel -> initializes, uploads and publishes through the Page Reels API", async () => {
    const { calls } = stubGraph();
    const res = await publishPost({ ...base, platform: "facebook", imageUrl: null, videoUrl: "https://cdn/reel.mp4", contentKind: "reel" });
    expect(res.ok).toBe(true);
    const start = calls.find((c) => c.url.endsWith("/video_reels") && c.params.get("upload_phase") === "START")!;
    const upload = calls.find((c) => c.url.startsWith("https://rupload.facebook.com/"))!;
    const finish = calls.find((c) => c.url.endsWith("/video_reels") && c.params.get("upload_phase") === "FINISH")!;
    expect(start).toBeDefined();
    expect(upload.headers.get("file_url")).toBe("https://cdn/reel.mp4");
    expect(upload.headers.get("authorization")).toBe("OAuth token");
    expect(finish.params.get("video_id")).toBe("fb-reel-1");
    expect(finish.params.get("video_state")).toBe("PUBLISHED");
    expect(calls.some((c) => c.url.endsWith("/photos"))).toBe(false);
  });
});

describe("Instagram payloads", () => {
  it("single image -> one image container then media_publish", async () => {
    const { calls } = stubGraph();
    const res = await publishPost({ ...base, platform: "instagram", imageUrl: "https://cdn/1.png" });
    expect(res.ok).toBe(true);
    const media = calls.find((c) => c.url.includes(`${GRAPH_VERSION}/ig-1/media`))!;
    expect(media.params.get("image_url")).toBe("https://cdn/1.png");
    expect(calls.some((c) => c.url.includes("/media_publish"))).toBe(true);
  });

  it("carousel -> child containers then a CAROUSEL parent, then publish", async () => {
    const { calls } = stubGraph();
    const res = await publishPost({
      ...base, platform: "instagram", imageUrl: null,
      imageUrls: ["https://cdn/1.png", "https://cdn/2.png", "https://cdn/3.png"],
    });
    expect(res.ok).toBe(true);
    const children = calls.filter((c) => c.url.includes("/media") && c.params.get("is_carousel_item") === "true");
    expect(children).toHaveLength(3);
    const parent = calls.find((c) => c.url.includes("/media") && c.params.get("media_type") === "CAROUSEL")!;
    const ids = (parent.params.get("children") ?? "").split(",");
    expect(ids).toHaveLength(3);
    expect(parent.params.get("caption")).toBe("hello");
    expect(calls.some((c) => c.url.includes("/media_publish"))).toBe(true);
  });

  it("reel -> REELS container with video_url", async () => {
    const { calls } = stubGraph();
    const res = await publishPost({ ...base, platform: "instagram", imageUrl: null, videoUrl: "https://cdn/reel.mp4" });
    expect(res.ok).toBe(true);
    const media = calls.find((c) => c.url.includes("/ig-1/media"))!;
    expect(media.params.get("media_type")).toBe("REELS");
    expect(media.params.get("video_url")).toBe("https://cdn/reel.mp4");
  });

  it("a failing child container reports carousel_media_failed and never claims success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const params = new URLSearchParams(String(init?.body ?? ""));
        if (String(url).includes("/media") && params.get("is_carousel_item") === "true") {
          return new Response(JSON.stringify({ error: { message: "boom", code: 9004 } }), { status: 400 });
        }
        return new Response(JSON.stringify({ id: "x" }), { status: 200 });
      }),
    );
    const res = await publishPost({
      ...base, platform: "instagram", imageUrl: null,
      imageUrls: ["https://cdn/1.png", "https://cdn/2.png"],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("carousel_media_failed");
      expect(res.message).toContain("0/2");
    }
  });
});

/* ------------------------- Buffer payloads (pure) ----------------------- */
describe("Buffer payloads", () => {
  const args = { channelId: "ch-1", text: "hi", mode: "shareNow" as const, contentKind: "post" as const, service: "instagram" as const };

  it("image -> one image asset; carousel -> N ordered image assets", () => {
    const one = buildCreatePostVariables({ ...args, mediaUrls: ["https://cdn/1.png"] });
    expect(one.input.assets).toEqual([{ image: { url: "https://cdn/1.png" } }]);
    const two = buildCreatePostVariables({ ...args, mediaUrls: ["https://cdn/1.png", "https://cdn/2.png"] });
    expect(two.input.assets).toEqual([
      { image: { url: "https://cdn/1.png" } },
      { image: { url: "https://cdn/2.png" } },
    ]);
  });

  it("video -> one video asset (never an image)", () => {
    const v = buildCreatePostVariables({ ...args, contentKind: "reel", videoUrl: "https://cdn/reel.mp4" });
    expect(v.input.assets).toEqual([{ video: { url: "https://cdn/reel.mp4" } }]);
  });

  it("no media -> empty assets (unchanged text-only behavior)", () => {
    expect(buildCreatePostVariables({ ...args }).input.assets).toEqual([]);
  });
});
