import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptToken } from "@/lib/crypto/tokens";

const state = vi.hoisted(() => ({ saved: null as Record<string, unknown> | null, existing: null as Record<string, unknown> | null }));
vi.mock("@/db", () => ({ getDb: () => ({
  select: () => ({ from: () => ({ where: async () => state.existing ? [state.existing] : [] }) }),
  insert: () => ({ values: (row: Record<string, unknown>) => {
    state.saved = row;
    return { onConflictDoUpdate: async () => undefined };
  } }),
}) }));
vi.mock("@/lib/workspace", () => ({ getActiveContext: vi.fn(async () => ({ workspaceId: "ws-test" })) }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: vi.fn(() => ({ allowed: true })) }));
vi.mock("@/lib/security/ai-endpoint", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/security/ai-endpoint")>(),
  assertPublicAiEndpoint: vi.fn(async (url: string) => {
    const { assertAllowedAiEndpoint } = await import("@/lib/security/ai-endpoint");
    assertAllowedAiEndpoint(url);
  }),
}));

import { saveWorkspaceAIConfigAction, testCloudflareModelAction } from "@/server/actions/ai-config";

const accountId = "0123456789abcdef0123456789abcdef";
const input = {
  textProvider: "gemini", textModel: "gemini-3.6-flash", textApiKey: "gemini-key",
  imageProvider: "cloudflare", imageModel: "@cf/black-forest-labs/flux-1-schnell",
  imageAccountId: accountId, imageApiKey: "cloudflare-token",
};

beforeEach(() => { state.saved = null; state.existing = null; });

describe("Cloudflare settings save action", () => {
  it("saves an unlisted custom public HTTPS text provider without deployment configuration", async () => {
    const result = await saveWorkspaceAIConfigAction({
      ...input, textProvider: "custom", textModel: "future/model", textBaseUrl: "https://new-provider.org/v1", textApiKey: "server-only-key",
    });
    expect(result).toEqual({ ok: true });
    expect(state.saved).toMatchObject({ textProvider: "custom", textModel: "future/model", textBaseUrl: "https://new-provider.org/v1" });
    expect(state.saved?.textApiKeyEnc).not.toContain("server-only-key");
  });
  it("refuses an internal custom provider before persisting credentials", async () => {
    const result = await saveWorkspaceAIConfigAction({
      ...input, textProvider: "custom", textModel: "any-model", textBaseUrl: "https://127.0.0.1/v1", textApiKey: "secret",
    });
    expect(result.ok).toBe(false);
    expect(state.saved).toBeNull();
  });
  it("constructs the official endpoint on the server and encrypts the image token", async () => {
    expect(await saveWorkspaceAIConfigAction({ ...input, imageBaseUrl: "https://evil.test/ai" })).toEqual({ ok: true });
    expect(state.saved).toMatchObject({ textProvider: "gemini", textBaseUrl: null,
      imageProvider: "cloudflare", imageBaseUrl: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai` });
    expect(state.saved?.imageApiKeyEnc).not.toContain("cloudflare-token");
    expect(decryptToken(String(state.saved?.imageApiKeyEnc))).toBe("cloudflare-token");
  });
  it("constructs the separate OpenAI-compatible text endpoint when Cloudflare handles chat", async () => {
    const result = await saveWorkspaceAIConfigAction({
      textProvider: "cloudflare", textModel: "@cf/meta/llama-3.1-8b-instruct", textAccountId: accountId,
      textApiKey: "cloudflare-text-token", imageProvider: "gemini", imageModel: "gemini-3.1-flash-image",
      imageApiKey: "gemini-image-key", textBaseUrl: "http://127.0.0.1/redirect",
    });
    expect(result).toEqual({ ok: true });
    expect(state.saved).toMatchObject({ textBaseUrl: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`, imageBaseUrl: null });
  });
  it("accepts a newer Cloudflare image model and tests its saved ID with the provider", async () => {
    const model = "@cf/leonardo/lucid-origin";
    expect(await saveWorkspaceAIConfigAction({ ...input, imageModel: model })).toEqual({ ok: true });
    state.existing = state.saved;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, result: { input: {}, output: {} } }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await testCloudflareModelAction("image")).toEqual({ ok: true });
    const [url, init] = (fetchMock.mock.calls as unknown as [string, RequestInit][])[0];
    expect(url).toContain(`/models/schema?model=${encodeURIComponent(model)}`);
    expect(init.headers).toMatchObject({ Authorization: "Bearer cloudflare-token" });
    expect(init.redirect).toBe("error");
    vi.unstubAllGlobals();
  });
  it("shows Cloudflare's model error from the test action", async () => {
    expect(await saveWorkspaceAIConfigAction({ ...input, imageModel: "@cf/vendor/new-model" })).toEqual({ ok: true });
    state.existing = state.saved;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: false, errors: [{ message: "Model is unavailable for this account" }] }), { status: 404, headers: { "Content-Type": "application/json" } })));
    expect(await testCloudflareModelAction("image")).toMatchObject({ ok: false, error: expect.stringContaining("Model is unavailable for this account") });
    vi.unstubAllGlobals();
  });
  it("rejects an invalid account ID before any database write", async () => {
    const result = await saveWorkspaceAIConfigAction({ ...input, imageAccountId: "bad" });
    expect(result.ok).toBe(false);
    expect(state.saved).toBeNull();
  });
  it("requires a new key when changing the saved image provider", async () => {
    state.existing = { textProvider: "gemini", imageProvider: "openai", textApiKeyEnc: "saved-text", imageApiKeyEnc: "saved-image" };
    const result = await saveWorkspaceAIConfigAction({ ...input, textApiKey: null, imageApiKey: null });
    expect(result).toEqual({ ok: false, error: "Enter an API key for the new image provider." });
    expect(state.saved).toBeNull();
  });
});
