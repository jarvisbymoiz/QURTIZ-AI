import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validCronAuthorization } from "../cron-auth";

describe("cron authorization", () => {
  const secret = "test-only-scheduler-credential";
  const now = 1790876400000;
  const signed = (endpoint: string, time = now) => {
    const ts = String(Math.floor(time / 1000));
    return `Bearer v1:${ts}:${createHmac("sha256", secret).update(`${endpoint}:${ts}`).digest("hex")}`;
  };
  it("accepts a current signature only for its endpoint", () => {
    expect(validCronAuthorization(signed("maintenance"), secret, "maintenance", now)).toBe(true);
    expect(validCronAuthorization(signed("maintenance"), secret, "publish", now)).toBe(false);
  });
  it("rejects expired, future and forged signatures", () => {
    expect(validCronAuthorization(signed("publish", now - 61000), secret, "publish", now)).toBe(false);
    expect(validCronAuthorization(signed("publish", now + 61000), secret, "publish", now)).toBe(false);
    expect(validCronAuthorization(signed("publish").slice(0, -1) + "x", secret, "publish", now)).toBe(false);
  });
  it("preserves the manual recovery bearer and rejects missing credentials", () => {
    expect(validCronAuthorization(`Bearer ${secret}`, secret, "publish", now)).toBe(true);
    expect(validCronAuthorization(null, secret, "publish", now)).toBe(false);
    expect(validCronAuthorization("Bearer wrong", secret, "publish", now)).toBe(false);
  });
});
