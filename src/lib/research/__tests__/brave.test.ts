import { afterEach, describe, expect, it, vi } from "vitest";
import { BraveSearchError, braveWebSearch, isBraveConfigured } from "@/lib/research/brave";

const KEY = "test-brave-key-super-secret";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const BRAVE_BODY = {
  web: {
    results: [
      { title: "<b>Qurtiz</b> launches", url: "https://qurtiz.ai/blog/launch", description: "Qurtiz <strong>AI</strong> launch", age: "2 days ago" },
      { title: "Not http", url: "ftp://example.com/x", description: "filtered" },
      { title: "", url: "https://example.com/second", description: "second result" },
    ],
  },
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.BRAVE_SEARCH_API_KEY;
});

describe("BraveSearchProvider", () => {
  it("is disabled and never calls fetch when the key is missing", async () => {
    const fetchImpl = vi.fn();
    expect(isBraveConfigured()).toBe(false);
    const err = await braveWebSearch({ query: "hello world", fetchImpl: fetchImpl as unknown as typeof fetch }).catch((e) => e);
    expect(err).toBeInstanceOf(BraveSearchError);
    expect(err.kind).toBe("disabled");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("normalizes results, strips markup, and filters non-http urls", async () => {
    process.env.BRAVE_SEARCH_API_KEY = KEY;
    const fetchImpl = vi.fn(async () => jsonResponse(200, BRAVE_BODY));
    const results = await braveWebSearch({ query: "qurtiz launch", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: "Qurtiz launches",
      url: "https://qurtiz.ai/blog/launch",
      description: "Qurtiz AI launch",
      age: "2 days ago",
    });
    expect(results[1].title).toBe("");
  });

  it("sends the key ONLY in the X-Subscription-Token header — never in the URL", async () => {
    process.env.BRAVE_SEARCH_API_KEY = KEY;
    const fetchImpl = vi.fn(async () => jsonResponse(200, BRAVE_BODY));
    await braveWebSearch({
      query: "qurtiz",
      region: "GB",
      language: "en",
      freshness: "pw",
      count: 5,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain(KEY);
    expect(url).toContain("https://api.search.brave.com/res/v1/web/search?");
    expect(url).toContain("country=GB");
    expect(url).toContain("search_lang=en");
    expect(url).toContain("freshness=pw");
    expect(url).toContain("count=5");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Subscription-Token"]).toBe(KEY);
  });

  it("maps 401 to unauthorized and never leaks the key in the error", async () => {
    process.env.BRAVE_SEARCH_API_KEY = KEY;
    const fetchImpl = vi.fn(async () => jsonResponse(401, { error: "invalid token" }));
    const err = await braveWebSearch({ query: "x".repeat(3), fetchImpl: fetchImpl as unknown as typeof fetch }).catch((e) => e);
    expect(err.kind).toBe("unauthorized");
    expect(err.httpStatus).toBe(401);
    expect(String(err.message)).not.toContain(KEY);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // never retried — a bad key stays bad
  });

  it("maps 429 to quota and surfaces Retry-After without retrying into the window", async () => {
    process.env.BRAVE_SEARCH_API_KEY = KEY;
    const fetchImpl = vi.fn(async () => jsonResponse(429, {}, { "retry-after": "45" }));
    const err = await braveWebSearch({ query: "rate limited query", fetchImpl: fetchImpl as unknown as typeof fetch }).catch((e) => e);
    expect(err.kind).toBe("quota");
    expect(err.retryAfterSeconds).toBe(45);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a transient 5xx exactly once, then reports http", async () => {
    process.env.BRAVE_SEARCH_API_KEY = KEY;
    const fetchImpl = vi.fn(async () => jsonResponse(503, {}));
    const err = await braveWebSearch({ query: "flaky upstream", fetchImpl: fetchImpl as unknown as typeof fetch }).catch((e) => e);
    expect(err.kind).toBe("http");
    expect(err.httpStatus).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("recovers when the retry after a transient 5xx succeeds", async () => {
    process.env.BRAVE_SEARCH_API_KEY = KEY;
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse(500, {}))
      .mockImplementationOnce(async () => jsonResponse(200, BRAVE_BODY));
    const results = await braveWebSearch({ query: "recovering upstream", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(results).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("maps transport failure to network after one retry", async () => {
    process.env.BRAVE_SEARCH_API_KEY = KEY;
    const fetchImpl = vi.fn(async () => Promise.reject(new Error("ECONNRESET")));
    const err = await braveWebSearch({ query: "offline query", fetchImpl: fetchImpl as unknown as typeof fetch }).catch((e) => e);
    expect(err.kind).toBe("network");
    expect(String(err.message)).not.toContain(KEY);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("maps abort-timeouts to timeout", async () => {
    process.env.BRAVE_SEARCH_API_KEY = KEY;
    const fetchImpl = vi.fn(async () => Promise.reject(new DOMException("The operation timed out.", "TimeoutError")));
    const err = await braveWebSearch({ query: "slow query", fetchImpl: fetchImpl as unknown as typeof fetch }).catch((e) => e);
    expect(err.kind).toBe("timeout");
  });

  it("stays server-only: module declares server-only and errors/results never contain the key", async () => {
    process.env.BRAVE_SEARCH_API_KEY = KEY;
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("../brave.ts", import.meta.url), "utf8");
    expect(src.startsWith('import "server-only";')).toBe(true);
    expect(src).not.toContain("NEXT_PUBLIC");

    const fetchImpl = vi.fn(async () => jsonResponse(500, {}));
    const err = await braveWebSearch({ query: "anything here", fetchImpl: fetchImpl as unknown as typeof fetch }).catch((e) => e);
    expect(JSON.stringify(err)).not.toContain(KEY);
  });
});
