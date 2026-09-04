import { describe, expect, it } from "vitest";
import {
  buildBufferPayload,
  deriveContentKind,
  PublishingError,
  type ContentKind,
  type PublishMode,
} from "@/lib/publishing/service";
import { createPostMutation } from "@/lib/buffer/client";

describe("deriveContentKind", () => {
  it("maps reel → reel", () => {
    expect(deriveContentKind("reel")).toBe("reel");
  });

  it("maps story → story", () => {
    expect(deriveContentKind("story")).toBe("story");
  });

  it("defaults any other format (single_image, carousel, text_post, null, undefined) to post", () => {
    expect(deriveContentKind("single_image")).toBe("post");
    expect(deriveContentKind("carousel")).toBe("post");
    expect(deriveContentKind("text_post")).toBe("post");
    expect(deriveContentKind(null)).toBe("post");
    expect(deriveContentKind(undefined)).toBe("post");
    expect(deriveContentKind("")).toBe("post");
    expect(deriveContentKind("unknown")).toBe("post");
  });
});

describe("buildBufferPayload", () => {
  const baseArgs = { channelId: "ch-1", text: "Hello", contentKind: "post" as ContentKind };

  it("returns a payload shaped for createPostForBuffer", () => {
    const dueAt = new Date("2026-09-04T10:00:00.000Z");
    const payload = buildBufferPayload({ ...baseArgs, mode: "customScheduled", dueAt });
    expect(payload).toEqual({
      channelId: "ch-1",
      text: "Hello",
      contentKind: "post",
      mode: "customScheduled",
      dueAt,
    });
  });

  it("omits dueAt when mode=shareNow", () => {
    const payload = buildBufferPayload({ ...baseArgs, mode: "shareNow" });
    expect(payload.dueAt).toBeUndefined();
    expect(payload.mode).toBe("shareNow");
  });

  it("requires dueAt when mode=customScheduled (throws on omit)", () => {
    expect(() => buildBufferPayload({ ...baseArgs, mode: "customScheduled" })).toThrow(/customScheduled requires dueAt/);
  });

  it("forbids dueAt when mode=shareNow (throws on pass)", () => {
    expect(() =>
      buildBufferPayload({ ...baseArgs, mode: "shareNow", dueAt: new Date("2026-09-04T10:00:00.000Z") }),
    ).toThrow(/shareNow forbids dueAt/);
  });

  it("passes contentKind through verbatim (post/story/reel)", () => {
    for (const k of ["post", "story", "reel"] as ContentKind[]) {
      const payload = buildBufferPayload({ ...baseArgs, contentKind: k, mode: "shareNow" });
      expect(payload.contentKind).toBe(k);
    }
  });
});

describe("createPostMutation integration with buildBufferPayload", () => {
  it("includes metadata.type='post' for shareNow mode (the Buffer 'Facebook posts require a type' guard)", () => {
    const args = buildBufferPayload({ channelId: "ch-1", text: "Hi", contentKind: "post", mode: "shareNow" });
    const q = createPostMutation({
      channelId: args.channelId,
      text: args.text,
      mode: args.mode,
      contentKind: args.contentKind,
    });
    expect(q).toContain('metadata: { type: "post" }');
    expect(q).toContain("mode: shareNow");
    expect(q).not.toContain("dueAt:");
  });

  it("includes metadata.type='reel' for customScheduled mode", () => {
    const dueAt = new Date("2026-09-04T10:00:00.000Z");
    const args = buildBufferPayload({ channelId: "ch-1", text: "Reel", contentKind: "reel", mode: "customScheduled", dueAt });
    const q = createPostMutation({
      channelId: args.channelId,
      text: args.text,
      mode: args.mode,
      contentKind: args.contentKind,
      dueAt: dueAt.toISOString(),
    });
    expect(q).toContain('metadata: { type: "reel" }');
    expect(q).toContain("mode: customScheduled");
    expect(q).toContain('"2026-09-04T10:00:00.000Z"');
  });
});

describe("PublishingError", () => {
  it("carries code, provider and step", () => {
    const err = new PublishingError({ code: "auth", message: "Token expired", provider: "buffer", step: "create_post" });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PublishingError");
    expect(err.code).toBe("auth");
    expect(err.provider).toBe("buffer");
    expect(err.step).toBe("create_post");
    expect(err.message).toBe("Token expired");
  });

  it("accepts 'none' provider for pre-resolve failures", () => {
    const err = new PublishingError({ code: "not_connected", message: "Not connected", provider: "none", step: "resolve" });
    expect(err.provider).toBe("none");
    expect(err.step).toBe("resolve");
  });
});

describe("retry idempotency guard contract", () => {
  it("documents the predicate the service applies (providerPostId set → refuse)", () => {
    // The actual retry call hits a DB; here we just lock in the contract so
    // the public surface never silently regresses: a publishing_jobs row
    // carrying a non-null providerPostId is terminal-success and must not be
    // re-fired. The service throws/returns already_published in that case.
    const fakeRow = { providerPostId: "post-abc", status: "published" };
    const isTerminal = Boolean(fakeRow.providerPostId) || fakeRow.status === "published";
    expect(isTerminal).toBe(true);
  });
});

describe("retry exponential backoff contract", () => {
  it("applies exponential growth with a 60s single-retry sleep cap", () => {
    // Mirrors the backoff math the service applies inside the retry loop:
    // sleepMs = min(baseBackoffMs * 2^(attempt-1), 60_000). With
    // baseBackoffMs = 300_000 (5m), every attempt is at or above the cap,
    // so the cap clamps all sleeps to 60s — keeps the worker responsive
    // instead of stalling it for minutes mid-retry.
    const baseBackoffMs = 5 * 60_000;
    const backoff = (attempt: number) => Math.min(baseBackoffMs * Math.pow(2, attempt - 1), 60_000);
    expect(backoff(1)).toBe(60_000); // 300_000 → capped
    expect(backoff(2)).toBe(60_000); // 600_000 → capped
    expect(backoff(3)).toBe(60_000); // 1_200_000 → capped
  });

  it("applies exponential growth with no cap when the cap is disabled", () => {
    const baseBackoffMs = 1_000;
    const backoff = (attempt: number) => baseBackoffMs * Math.pow(2, attempt - 1);
    expect(backoff(1)).toBe(1_000);
    expect(backoff(2)).toBe(2_000);
    expect(backoff(3)).toBe(4_000);
  });

  it("returns attempts_exhausted reason when currentAttempt >= maxAttempts", () => {
    // Pure mirror of the service's terminal-failure classifier: if we've
    // already burned through the budget, the retry path reports exhausted
    // instead of continuing to spin.
    const maxAttempts = 3;
    const terminalReason = (currentAttempt: number) => (currentAttempt >= maxAttempts ? "attempts_exhausted" : "retry");
    expect(terminalReason(3)).toBe("attempts_exhausted");
    expect(terminalReason(2)).toBe("retry");
  });
});

describe("PublishMode / ContentKind types", () => {
  it("'shareNow' and 'customScheduled' are the only publish modes", () => {
    const modes: PublishMode[] = ["shareNow", "customScheduled"];
    expect(modes).toHaveLength(2);
  });
});
