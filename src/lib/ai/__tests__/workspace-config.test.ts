import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import {
  AI_CONFIGURATION_REQUIRED_MESSAGE,
  AIConfigError,
  createTextModel,
  maskApiKey,
  resolveImageTarget,
  resolveTextModel,
  validateAIConfigShape,
  type WorkspaceAIConfig,
} from "@/lib/ai/provider";
import { createOpenAICompatibleModel } from "@/lib/ai/openai-compatible";
import { getWorkspaceTextModel, prepareConfigRow } from "@/lib/ai/config";

/**
 * DB stub: getWorkspaceAIConfig reads a single row via getDb().select()...
 * We control `state.rows` per test — this is a unit test of resolution
 * logic, not of drizzle's SQL builder.
 */
const dbMock = vi.hoisted(() => {
  const state = { rows: [] as Record<string, unknown>[] };
  const getDb = () => ({
    select: () => ({
      from: () => ({
        where: async () => state.rows,
      }),
    }),
  });
  return { getDb, state };
});

vi.mock("@/db", () => ({ getDb: dbMock.getDb }));

function makeRow(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    workspaceId: "00000000-0000-0000-0000-0000000000a1",
    textProvider: "gemini",
    textModel: "gemini-3.6-flash",
    textBaseUrl: null,
    textApiKeyEnc: encryptToken("text-key-a1"),
    imageProvider: "gemini",
    imageModel: "gemini-3.1-flash-image",
    imageBaseUrl: null,
    imageApiKeyEnc: encryptToken("image-key-a1"),
    taskOverrides: null,
    ...over,
  };
}

function config(over: Partial<WorkspaceAIConfig> = {}): WorkspaceAIConfig {
  return {
    workspaceId: "ws-a",
    textProvider: "gemini",
    textModel: "gemini-3.6-flash",
    textBaseUrl: null,
    textApiKey: "text-key-a",
    imageProvider: "gemini",
    imageModel: "gemini-3.1-flash-image",
    imageBaseUrl: null,
    imageApiKey: "image-key-a",
    taskOverrides: {},
    ...over,
  };
}

/** AIConfigError carries a stable code in `message` and the human text in
 *  `detail` — assertions must look at the detail, not the code. */
function expectAIConfigError(fn: () => unknown, detailRegex: RegExp): void {
  try {
    fn();
    throw new Error("expected AIConfigError");
  } catch (error) {
    if (error instanceof Error && error.message === "expected AIConfigError") throw error;
    expect(error).toBeInstanceOf(AIConfigError);
    expect((error as AIConfigError).detail).toMatch(detailRegex);
  }
}

beforeEach(() => {
  // The dev-only env fallback must never interfere with these tests: a
  // workspace with no row must throw AIConfigError, not resolve via
  // GEMINI_API_KEY.
  delete process.env.GEMINI_API_KEY;
  dbMock.state.rows = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prepareConfigRow (encryption + validation)", () => {
  it("encrypts both keys at rest (v1 payload, no plaintext, decrypt round-trip)", () => {
    const row = prepareConfigRow({
      workspaceId: "ws",
      textProvider: "gemini",
      textModel: "gemini-3.6-flash",
      textBaseUrl: null,
      textApiKey: "  sk-text-1234567890  ",
      imageProvider: "openai-compatible",
      imageModel: "gpt-image-1",
      imageBaseUrl: "https://api.openai.com/v1",
      imageApiKey: "sk-image-0987654321",
    });

    expect(row.textApiKeyEnc).toMatch(/^v1\./);
    expect(row.imageApiKeyEnc).toMatch(/^v1\./);
    expect(row.textApiKeyEnc).not.toContain("sk-text-1234567890");
    expect(row.imageApiKeyEnc).not.toContain("sk-image-0987654321");
    expect(decryptToken(row.textApiKeyEnc!)).toBe("sk-text-1234567890");
    expect(decryptToken(row.imageApiKeyEnc!)).toBe("sk-image-0987654321");
    // trimmed before encryption
    expect(decryptToken(row.textApiKeyEnc!)).not.toContain("  ");
  });

  it("rejects unknown providers", () => {
    expectAIConfigError(
      () =>
        prepareConfigRow({
          workspaceId: "ws",
          textProvider: "claude" as unknown as string,
          textModel: "m",
          textApiKey: "k",
          imageProvider: "gemini",
          imageModel: "img",
          imageApiKey: "k",
        }),
      /Unknown text provider/,
    );
  });

  it("rejects openai-compatible without a base URL", () => {
    expectAIConfigError(
      () =>
        prepareConfigRow({
          workspaceId: "ws",
          textProvider: "openai-compatible",
          textModel: "gpt-4o-mini",
          textApiKey: "k",
          imageProvider: "gemini",
          imageModel: "img",
          imageApiKey: "k",
        }),
      /Base URL/,
    );
  });

  it("rejects empty keys and models", () => {
    expectAIConfigError(
      () =>
        prepareConfigRow({
          workspaceId: "ws",
          textProvider: "gemini",
          textModel: "m",
          textApiKey: "   ",
          imageProvider: "gemini",
          imageModel: "img",
          imageApiKey: "k",
        }),
      /API keys are required/,
    );
  });
});

describe("validateAIConfigShape", () => {
  it("accepts a valid config", () => {
    expect(
      validateAIConfigShape({
        textProvider: "gemini",
        textModel: "gemini-3.6-flash",
        imageProvider: "openai-compatible",
        imageModel: "gpt-image-1",
        imageBaseUrl: "https://api.openai.com/v1",
      }),
    ).toBeNull();
  });

  it("reports unknown providers", () => {
    expect(
      validateAIConfigShape({
        textProvider: "anthropic",
        textModel: "m",
        imageProvider: "gemini",
        imageModel: "img",
      }),
    ).toMatch(/Unknown text provider/);
  });

  it("requires a base URL for openai-compatible", () => {
    expect(
      validateAIConfigShape({
        textProvider: "gemini",
        textModel: "m",
        imageProvider: "openai-compatible",
        imageModel: "img",
      }),
    ).toMatch(/Base URL/);
  });
});

describe("createTextModel (provider factory)", () => {
  it("builds a gemini model from the @ai-sdk/google SDK", () => {
    const m = createTextModel("gemini", "gemini-3.6-flash", "key", null);
    expect(m.specificationVersion).toBe("v2");
    // SDK provider id (the workspace-level "gemini" id is carried on
    // ResolvedTextModel.provider by resolveTextModel).
    expect(m.provider).toBe("google.generative-ai");
    expect(m.modelId).toBe("gemini-3.6-flash");
    expect(typeof m.doGenerate).toBe("function");
    expect(typeof m.doStream).toBe("function");
  });

  it("builds an openai-compatible model (native client, no SDK dep)", () => {
    const m = createTextModel("openai-compatible", "gpt-4o-mini", "key", "https://x.example/v1");
    expect(m.provider).toBe("openai-compatible");
    expect(m.modelId).toBe("gpt-4o-mini");
    expect(typeof m.doGenerate).toBe("function");
    expect(typeof m.doStream).toBe("function");
  });
});

describe("resolveTextModel / resolveImageTarget", () => {
  it("resolves the configured text model, honoring per-task overrides", () => {
    const r = resolveTextModel(
      config({ textModel: "gemini-3.6-flash", taskOverrides: { chat: "gemini-2.5-flash-lite" } }),
      "chat",
    );
    expect(r.modelId).toBe("gemini-2.5-flash-lite");
    expect(r.provider).toBe("gemini");
    expect(r.apiKey).toBe("text-key-a");

    const r2 = resolveTextModel(config({ taskOverrides: { chat: "gemini-2.5-flash-lite" } }), "content");
    expect(r2.modelId).toBe("gemini-3.6-flash");

    const r3 = resolveTextModel(config(), "bulk");
    expect(r3.modelId).toBe("gemini-3.6-flash");
  });

  it("resolves the image target from the config", () => {
    const t = resolveImageTarget(
      config({ imageProvider: "openai-compatible", imageModel: "gpt-image-1", imageBaseUrl: "https://api.openai.com/v1", imageApiKey: "img-key" }),
    );
    expect(t).toEqual({
      provider: "openai-compatible",
      modelId: "gpt-image-1",
      apiKey: "img-key",
      baseUrl: "https://api.openai.com/v1",
    });
  });

  it("masks keys for display without exposing the full value", () => {
    expect(maskApiKey("sk-1234567890abcdef")).toBe("sk-…cdef");
    expect(maskApiKey("short")).toBe("••••••");
  });
});

describe("getWorkspaceTextModel (workspace isolation + missing config)", () => {
  it("never mixes keys between workspaces", async () => {
    dbMock.state.rows = [makeRow({ textApiKeyEnc: encryptToken("text-key-A"), textModel: "model-A" })];
    const a = await getWorkspaceTextModel("00000000-0000-0000-0000-0000000000a1");
    expect(a.apiKey).toBe("text-key-A");
    expect(a.modelId).toBe("model-A");

    dbMock.state.rows = [
      makeRow({
        workspaceId: "00000000-0000-0000-0000-0000000000b2",
        textProvider: "openai-compatible",
        textModel: "model-B",
        textApiKeyEnc: encryptToken("text-key-B"),
        imageProvider: "openai-compatible",
      }),
    ];
    const b = await getWorkspaceTextModel("00000000-0000-0000-0000-0000000000b2");
    expect(b.apiKey).toBe("text-key-B");
    expect(b.modelId).toBe("model-B");
    expect(b.provider).toBe("openai-compatible");
  });

  it("throws AIConfigError (CONFIGURATION_REQUIRED) when the workspace has no config", async () => {
    await expect(
      getWorkspaceTextModel("00000000-0000-0000-0000-0000000000c3"),
    ).rejects.toMatchObject({
      name: "AIConfigError",
      message: "CONFIGURATION_REQUIRED",
      detail: AI_CONFIGURATION_REQUIRED_MESSAGE,
    });
    await expect(
      getWorkspaceTextModel("00000000-0000-0000-0000-0000000000c3"),
    ).rejects.toBeInstanceOf(AIConfigError);
  });

  it("binds each openai-compatible model to its own workspace key at the HTTP layer", async () => {
    const calls: { url: string; auth: string; model: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { headers?: Record<string, string>; body?: string }) => {
        calls.push({
          url,
          auth: init?.headers?.["Authorization"] ?? "",
          model: JSON.parse(init?.body ?? "{}").model,
        });
        return new Response(
          JSON.stringify({
            id: "cmpl-1",
            model: "m",
            choices: [{ message: { content: "hi" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const modelA = createOpenAICompatibleModel({
      modelId: "model-a",
      apiKey: "key-AAA",
      baseUrl: "https://a.example/v1",
    });
    const modelB = createOpenAICompatibleModel({
      modelId: "model-b",
      apiKey: "key-BBB",
      baseUrl: "https://b.example/v1",
    });
    const prompt = [{ role: "user" as const, content: [{ type: "text" as const, text: "hello" }] }];

    await modelA.doGenerate({ prompt });
    await modelB.doGenerate({ prompt });

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe("https://a.example/v1/chat/completions");
    expect(calls[0].auth).toBe("Bearer key-AAA");
    expect(calls[0].model).toBe("model-a");
    expect(calls[1].url).toBe("https://b.example/v1/chat/completions");
    expect(calls[1].auth).toBe("Bearer key-BBB");
    expect(calls[1].model).toBe("model-b");
  });
});
