import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAllowedAiEndpoint } from "../ai-endpoint";
afterEach(() => vi.unstubAllEnvs());
describe("AI endpoint boundary", () => {
  it("blocks metadata, loopback overrides, credentials and redirect targets", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_ALLOWED_BASE_URLS", "");
    for (const url of ["http://169.254.169.254/latest", "http://localhost:80", "http://127.0.0.1/v1", "https://api.openai.com.evil.test/v1", "https://key@api.openai.com/v1", "https://api.openai.com/v1?next=foo"]) {
      expect(() => assertAllowedAiEndpoint(url)).toThrow();
    }
    expect(() => assertAllowedAiEndpoint("https://api.openai.com/v1")).not.toThrow();
  });
  it("requires the operator to allow the exact custom base URL", () => {
    vi.stubEnv("AI_ALLOWED_BASE_URLS", "https://private-gateway.example/v1");
    expect(() => assertAllowedAiEndpoint("https://private-gateway.example/v1/")).not.toThrow();
    expect(() => assertAllowedAiEndpoint("https://private-gateway.example/admin")).toThrow();
  });
});
