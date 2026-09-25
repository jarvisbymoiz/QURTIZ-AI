import { describe, expect, it, vi } from "vitest";
import { assertAllowedAiEndpoint, assertPublicAiEndpoint, fetchPublicAiEndpoint, isPublicAiAddress } from "../ai-endpoint";

describe("AI endpoint boundary without a domain allowlist", () => {
  it("accepts arbitrary public HTTPS provider bases and Cloudflare account endpoints", () => {
    for (const base of [
      "https://api.openai.com/v1",
      "https://new-model-gateway.ai.example.org/v1/custom",
      "https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/v1",
      "https://8.8.8.8/v1",
    ]) expect(() => assertAllowedAiEndpoint(base)).not.toThrow();
  });

  it("rejects unsafe URLs and non-public literal addresses", () => {
    for (const base of [
      "http://provider.com/v1", "https://key@provider.com/v1",
      "https://provider.com/v1?next=https://internal", "https://provider.com/v1#fragment",
      "https://localhost/v1", "https://service.internal/v1", "https://metadata.google.internal/v1",
      "https://127.1/v1", "https://10.0.0.1/v1", "https://172.16.0.1/v1",
      "https://192.168.1.1/v1", "https://169.254.169.254/latest",
      "https://[::1]/v1", "https://[fc00::1]/v1", "https://[::ffff:127.0.0.1]/v1",
    ]) expect(() => assertAllowedAiEndpoint(base), base).toThrow();
  });

  it("classifies special-use ranges and rejects any mixed private DNS answer", async () => {
    for (const address of ["127.0.0.1", "10.2.3.4", "100.64.0.1", "169.254.169.254", "192.0.0.9", "198.18.0.1", "203.0.113.1", "0.0.0.0", "::1", "fc00::1", "fe80::1", "2001:db8::1", "::ffff:10.0.0.1", "64:ff9b:1::a00:1"]) {
      expect(isPublicAiAddress(address), address).toBe(false);
    }
    expect(isPublicAiAddress("8.8.8.8")).toBe(true);
    expect(isPublicAiAddress("2606:4700:4700::1111")).toBe(true);
    const publicDns = vi.fn(async () => [{ address: "8.8.8.8", family: 4 }]);
    await expect(assertPublicAiEndpoint("https://new-provider.org/v1", publicDns)).resolves.toBeUndefined();
    expect(publicDns).toHaveBeenCalledWith("new-provider.org", expect.objectContaining({ all: true }));
    const rebindingDns = vi.fn(async () => [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }]);
    await expect(assertPublicAiEndpoint("https://new-provider.org/v1", rebindingDns)).rejects.toThrow(/non-public/);
  });

  it("forces redirect rejection and the guarded connector on requests", async () => {
    const fakeFetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fakeFetch);
    try {
      await fetchPublicAiEndpoint("https://another-provider.org/v1/chat/completions", { method: "POST", redirect: "follow" });
      expect(fakeFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ redirect: "error", dispatcher: expect.any(Object) }));
    } finally { vi.unstubAllGlobals(); }
  });
});
