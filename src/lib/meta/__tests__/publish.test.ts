import { afterEach, describe, expect, it, vi } from "vitest";
import { GRAPH_VERSION } from "@/lib/meta/oauth";
import { publishFirstComment } from "@/lib/meta/publish";

/**
 * The first comment is a SEPARATE Graph API request made after the main post:
 *   - Facebook  : POST /{post-id}/comments
 *   - Instagram : POST /{ig-media-id}/comments
 * These tests lock in the endpoint, the message param and the
 * unsupported-vs-error classification.
 */

function stubFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

function bodyParams(init?: RequestInit): URLSearchParams {
  return new URLSearchParams(String(init?.body ?? ""));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("publishFirstComment", () => {
  it("Facebook: POSTs to /{post-id}/comments with the message and the Page token", async () => {
    const { calls } = stubFetch({ id: "fb-cmt-1" });

    const res = await publishFirstComment({
      platform: "facebook",
      pageToken: "page-token-1",
      postId: "123_456",
      message: "First comment!",
    });

    expect(res).toMatchObject({ ok: true, commentId: "fb-cmt-1", status: 200 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://graph.facebook.com/${GRAPH_VERSION}/123_456/comments`);
    expect(calls[0].init?.method).toBe("POST");
    const params = bodyParams(calls[0].init);
    expect(params.get("message")).toBe("First comment!");
    expect(params.get("access_token")).toBe("page-token-1");
  });

  it("Instagram: the target is the media id returned by the main publish", async () => {
    const { calls } = stubFetch({ id: "ig-cmt-1" });

    const res = await publishFirstComment({
      platform: "instagram",
      pageToken: "page-token-2",
      postId: "17895695668004550",
      message: "IG first comment",
    });

    expect(res).toMatchObject({ ok: true, commentId: "ig-cmt-1", status: 200 });
    expect(calls[0].url).toBe(`https://graph.facebook.com/${GRAPH_VERSION}/17895695668004550/comments`);
    expect(bodyParams(calls[0].init).get("message")).toBe("IG first comment");
  });

  it("classifies a capability rejection as unsupported", async () => {
    stubFetch({ error: { message: "Unsupported request - this media type cannot be commented", code: 3 } }, 400);
    const res = await publishFirstComment({
      platform: "instagram",
      pageToken: "t",
      postId: "media-1",
      message: "hi",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("unsupported");
      expect(res.code).toBe(3);
    }
  });

  it("classifies a genuine API error as graph_error", async () => {
    stubFetch({ error: { message: "Invalid parameter", code: 100 } }, 400);
    const res = await publishFirstComment({
      platform: "facebook",
      pageToken: "t",
      postId: "post-1",
      message: "hi",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("graph_error");
  });

  it("does not call Meta at all when there is no comment to publish", async () => {
    const { fetchMock } = stubFetch({ id: "never" });
    const res = await publishFirstComment({
      platform: "facebook",
      pageToken: "t",
      postId: "post-1",
      message: "   ",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("unsupported");
  });

  it("reports a transport failure as network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("socket hang up"); }));
    const res = await publishFirstComment({
      platform: "facebook",
      pageToken: "t",
      postId: "post-1",
      message: "hi",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("network");
      expect(res.message).toContain("socket hang up");
    }
  });

  it("classifies a permissions error as permission_required (never retried blindly)", async () => {
    stubFetch({ error: { message: "Permissions error", code: 200, error_subcode: 460 } }, 400);
    const res = await publishFirstComment({
      platform: "instagram",
      pageToken: "t",
      postId: "media-1",
      message: "hi",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("permission_required");
      expect(res.code).toBe(200);
      expect(res.subcode).toBe(460);
      expect(res.status).toBe(400);
    }
  });

  it("classifies an App-Review / Live-mode rejection (code 283) as permission_required", async () => {
    stubFetch(
      { error: { message: "The app permission is not available for this app", code: 283 } },
      400,
    );
    const res = await publishFirstComment({
      platform: "facebook",
      pageToken: "t",
      postId: "post-1",
      message: "hi",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("permission_required");
  });

  it("logs sanitized diagnostics (endpoint, status, error code) and never the token", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubFetch({ error: { message: "Permissions error", code: 200, fbtrace_id: "trace-1" } }, 400);

    await publishFirstComment({
      platform: "facebook",
      pageToken: "SECRET-PAGE-TOKEN-VALUE",
      postId: "post-1",
      message: "hi",
    });

    const logged = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("/comments");
    expect(logged).toContain("400");
    expect(logged).toContain("first_comment");
    expect(logged).not.toContain("SECRET-PAGE-TOKEN-VALUE");
    expect(logged).not.toContain("access_token");
    warn.mockRestore();
  });
});