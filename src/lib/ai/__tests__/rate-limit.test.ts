import { describe, expect, it } from "vitest";
import { APICallError } from "@ai-sdk/provider";
import {
  parseRateLimitError,
  rateLimitHint,
  RateLimitExceededError,
  withRateLimitRetry,
} from "@/lib/ai/provider";

describe("parseRateLimitError", () => {
  const openRouterTpdMessage =
    "Rate limit reached for model `openai/gpt-oss-120b` in organization `org_01m203jkpfen3958nzrdf3g03y` " +
    "service tier `on_demand` on tokens per day (TPD): Limit 200000, Used 199147, Requested 2075. " +
    "Please try again in 8m47.904s. Need more tokens? Upgrade to Dev Tier to unlock more.";

  it("recognizes OpenRouter TPD with full quota details", () => {
    const info = parseRateLimitError(openRouterTpdMessage);
    expect(info.kind).toBe("tpd");
    expect(info.limit).toBe(200000);
    expect(info.used).toBe(199147);
    expect(info.requested).toBe(2075);
    expect(info.retryAfterSeconds).toBe(527); // 8m47.904s floored (8*60+47)
  });

  it("preserves explicit provider TPD numbers even when the response also mentions quota", () => {
    const info = parseRateLimitError("Provider quota reached on tokens per day (TPD): Limit 200000, Used 199147, Requested 2075. Try again in 8m.");
    expect(info).toMatchObject({ kind: "tpd", limit: 200000, used: 199147, requested: 2075, retryAfterSeconds: 480 });
  });

  it("recognizes plain TPM errors", () => {
    const info = parseRateLimitError("Rate limit hit: TPM limit 8000 Used 7990 Requested 1000");
    expect(info.kind).toBe("tpm");
  });

  it("recognizes RPM errors", () => {
    const info = parseRateLimitError("Rate limit: RPM exceeded for this model");
    expect(info.kind).toBe("rpm");
  });

  it("recognizes hard quota exhaustion (never retry)", () => {
    const info = parseRateLimitError("You exceeded your current quota — billing required");
    expect(info.kind).toBe("quota");
  });

  it("recognizes RESOURCE_EXHAUSTED as quota", () => {
    const info = parseRateLimitError("RESOURCE_EXHAUSTED: insufficient quota for this model");
    expect(info.kind).toBe("quota");
  });

  it("falls back to 'other' for unclassified 429s", () => {
    const info = parseRateLimitError("HTTP 429: too many requests");
    expect(info.kind).toBe("other");
  });

  it("parses Retry-After header when present", () => {
    const err = new APICallError({
      message: "Rate limit reached",
      url: "https://openrouter.ai/api/v1/chat/completions",
      requestBodyValues: {},
      statusCode: 429,
      responseHeaders: { "retry-after": "60" },
    });
    const info = parseRateLimitError(err);
    expect(info.retryAfterSeconds).toBe(60);
  });

  it("parses composite duration (hours, minutes, seconds)", () => {
    const info = parseRateLimitError("Rate limit: please try again in 1h30m15s");
    expect(info.retryAfterSeconds).toBe(1 * 3600 + 30 * 60 + 15);
  });

  it("returns empty defaults for non-error input", () => {
    const info = parseRateLimitError(null);
    expect(info.kind).toBe("other");
    expect(info.limit).toBeNull();
  });
});

describe("rateLimitHint", () => {
  it("gives actionable TPD message with minutes until reset", () => {
    const hint = rateLimitHint({
      kind: "tpd",
      retryAfterSeconds: 528,
      limit: 200000,
      used: 199147,
      requested: 2075,
    });
    expect(hint).toMatch(/AI provider daily TPD limit/);
    expect(hint).toMatch(/quota resets in ~9 min/);
    expect(hint).toMatch(/another configured model or check provider limits/);
  });

  it("gives a TPD hint without a reset time when retry-after is unknown", () => {
    const hint = rateLimitHint({
      kind: "tpd",
      retryAfterSeconds: null,
      limit: null,
      used: null,
      requested: null,
    });
    expect(hint).toMatch(/AI provider daily TPD limit/);
    expect(hint).toMatch(/another configured model/);
  });

  it("tells the user quota is exhausted (never worth retrying)", () => {
    const hint = rateLimitHint({ kind: "quota", retryAfterSeconds: null, limit: null, used: null, requested: null });
    expect(hint).toMatch(/quota exhausted/);
    expect(hint).toMatch(/AI provider/);
  });

  it("gives short wait hint for TPM", () => {
    const hint = rateLimitHint({ kind: "tpm", retryAfterSeconds: 30, limit: null, used: null, requested: null });
    expect(hint).toMatch(/Rate limited \(TPM\)/);
    expect(hint).toMatch(/wait ~30s/);
  });
});

describe("RateLimitExceededError", () => {
  it("carries parsed RateLimitInfo and a useful message", () => {
    const cause = new Error("wrapped");
    const err = new RateLimitExceededError(
      { kind: "tpd", retryAfterSeconds: 600, limit: 100000, used: 99900, requested: 100 },
      { cause },
    );
    expect(err.name).toBe("RateLimitExceededError");
    expect(err.info.kind).toBe("tpd");
    expect(err.message).toMatch(/AI provider daily TPD limit/);
    expect((err as { cause?: unknown }).cause).toBe(cause);
  });
});

describe("withRateLimitRetry", () => {
  it("returns immediately on success", async () => {
    let calls = 0;
    const result = await withRateLimitRetry(async () => {
      calls++;
      return "ok";
    });
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries TPM then succeeds (does NOT throw on transient)", async () => {
    let calls = 0;
    const result = await withRateLimitRetry(async () => {
      calls++;
      if (calls === 1) {
        throw new APICallError({
          message: "Rate limit hit: TPM exceeded, retry in 1 second",
          url: "https://api.example.com/v1/chat/completions",
          requestBodyValues: {},
          statusCode: 429,
          responseBody: "Rate limit hit: TPM exceeded",
          responseHeaders: { "retry-after": "1" },
        });
      }
      return "ok-after-retry";
    });
    expect(result).toBe("ok-after-retry");
    expect(calls).toBe(2);
  });

  it("does NOT retry on TPD — throws RateLimitExceededError immediately", async () => {
    let calls = 0;
    const tpdMessage =
      "Rate limit reached for model `openai/gpt-oss-120b` in organization `org_test` service tier `on_demand` " +
      "on tokens per day (TPD): Limit 200000, Used 199999, Requested 1000. Please try again in 4h30m.";
    await expect(
      withRateLimitRetry(async () => {
        calls++;
        throw new APICallError({
          message: tpdMessage,
          url: "https://openrouter.ai/api/v1/chat/completions",
          requestBodyValues: {},
          statusCode: 429,
          responseBody: tpdMessage,
        });
      }),
    ).rejects.toBeInstanceOf(RateLimitExceededError);
    // CRITICAL: exactly 1 attempt, no wasted retry that would burn quota.
    expect(calls).toBe(1);
  });

  it("does NOT retry on quota exhaustion — throws RateLimitExceededError", async () => {
    let calls = 0;
    await expect(
      withRateLimitRetry(async () => {
        calls++;
        throw new APICallError({
          message: "RESOURCE_EXHAUSTED: insufficient quota for this model",
          url: "https://api.openai.com/v1/chat/completions",
          requestBodyValues: {},
          statusCode: 429,
        });
      }),
    ).rejects.toBeInstanceOf(RateLimitExceededError);
    expect(calls).toBe(1);
  });

  it("propagates non-429 errors immediately", async () => {
    let calls = 0;
    await expect(
      withRateLimitRetry(async () => {
        calls++;
        throw new Error("network blip");
      }),
    ).rejects.toThrow("network blip");
    expect(calls).toBe(1);
  });
});
