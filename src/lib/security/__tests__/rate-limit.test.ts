import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { rateLimit } from "@/lib/security/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows requests under the limit", () => {
    const k = "test-a-" + Math.random();
    expect(rateLimit(k, 3, 60_000).allowed).toBe(true);
    expect(rateLimit(k, 3, 60_000).allowed).toBe(true);
    expect(rateLimit(k, 3, 60_000).allowed).toBe(true);
    expect(rateLimit(k, 3, 60_000).allowed).toBe(false);
  });

  it("recovers after the window passes", () => {
    const k = "test-b-" + Math.random();
    expect(rateLimit(k, 1, 60_000).allowed).toBe(true);
    expect(rateLimit(k, 1, 60_000).allowed).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(rateLimit(k, 1, 60_000).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const k1 = "k1-" + Math.random();
    const k2 = "k2-" + Math.random();
    expect(rateLimit(k1, 1, 60_000).allowed).toBe(true);
    expect(rateLimit(k2, 1, 60_000).allowed).toBe(true);
    expect(rateLimit(k1, 1, 60_000).allowed).toBe(false);
  });

  it("reports retry-after seconds", () => {
    const k = "test-c-" + Math.random();
    rateLimit(k, 1, 30_000);
    const r = rateLimit(k, 1, 30_000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
    expect(r.retryAfterSeconds).toBeLessThanOrEqual(30);
  });
});
