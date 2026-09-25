import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAllowedAiEndpoint } from "../ai-endpoint";
afterEach(() => vi.unstubAllEnvs());
describe("AI endpoint boundary", () => {
  it("trusts only canonical Cloudflare account AI bases without changing the custom allowlist", () => {
    vi.stubEnv("AI_ALLOWED_BASE_URLS", "https://private-gateway.example/v1");
    const account = "0123456789abcdef0123456789abcdef";
    for (const base of [
      `https://api.cloudflare.com/client/v4/accounts/${account}/ai`,
      `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1`,
    ]) expect(() => assertAllowedAiEndpoint(base)).not.toThrow();
    for (const base of [
      `http://api.cloudflare.com/client/v4/accounts/${account}/ai`,
      `https://api.cloudflare.com.evil.test/client/v4/accounts/${account}/ai`,
      `https://api.cloudflare.com:444/client/v4/accounts/${account}/ai`,
      `https://api.cloudflare.com/client/v4/accounts/bad/ai`,
      `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/x/y`,
      `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/../run/@cf/x/y`,
      `https://api.cloudflare.com/client/v4/accounts/${account}/ai?redirect=https://evil.test`,
    ]) expect(() => assertAllowedAiEndpoint(base)).toThrow();
    expect(() => assertAllowedAiEndpoint("https://private-gateway.example/v1")).not.toThrow();
  });
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
    vi.stubEnv("AI_ALLOWED_BASE_URLS", "http://example.com/v1,https://127.0.0.1/v1");
    expect(() => assertAllowedAiEndpoint("http://example.com/v1")).toThrow(/HTTPS/);
    expect(() => assertAllowedAiEndpoint("https://127.0.0.1/v1")).toThrow(/private-network/);
  });
});
