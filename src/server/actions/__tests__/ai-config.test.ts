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

import { saveWorkspaceAIConfigAction } from "@/server/actions/ai-config";

const accountId = "0123456789abcdef0123456789abcdef";
const input = {
  textProvider: "gemini", textModel: "gemini-3.6-flash", textApiKey: "gemini-key",
  imageProvider: "cloudflare", imageModel: "@cf/black-forest-labs/flux-1-schnell",
  imageAccountId: accountId, imageApiKey: "cloudflare-token",
};

beforeEach(() => { state.saved = null; state.existing = null; });

describe("Cloudflare settings save action", () => {
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
