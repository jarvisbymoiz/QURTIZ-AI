import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import {
  AI_CONFIGURATION_REQUIRED_MESSAGE,
  AIConfigError,
  DEFAULT_MODEL,
  createTextModel,
  maskApiKey,
  resolveImageTarget,
  resolveTextModel,
  validateAIConfigShape,
  type WorkspaceAIConfig,
} from "@/lib/ai/provider";
import {
  AI_PROVIDER_CATALOG,
  CATALOG_PROVIDER_IDS,
  PROVIDER_GROUP_ORDER,
  catalogEntry,
  isCatalogProviderId,
  isKnownProvider,
  resolvedBaseUrl,
  type CatalogProviderId,
} from "@/lib/ai/provider-catalog";
import { createOpenAICompatibleModel } from "@/lib/ai/openai-compatible";
import {
  getWorkspaceAIModelLabel,
  getWorkspaceTextModel,
  hasWorkspaceAIConfig,
  prepareConfigRow,
} from "@/lib/ai/config";
import { saveAIConfigInputSchema } from "@/lib/ai/ai-config-schema";

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
  vi.stubEnv("AI_ALLOWED_BASE_URLS", "https://a.example/v1,https://b.example/v1,https://gateway.example/v1,https://legacy-gateway.example/v1,https://legacy.example/v1,https://my-gateway.example/v1,https://proxy.example/v1,https://x.example/v1");
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
      imageProvider: "custom",
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

  it("rejects `custom` without a base URL (no catalog default to fall back on)", () => {
    expectAIConfigError(
      () =>
        prepareConfigRow({
          workspaceId: "ws",
          textProvider: "custom",
          textModel: "gpt-4o-mini",
          textApiKey: "k",
          imageProvider: "gemini",
          imageModel: "img",
          imageApiKey: "k",
        }),
      /Base URL/,
    );
  });

  it("allows presets without a base URL (catalog default fills in at runtime)", () => {
    const row = prepareConfigRow({
      workspaceId: "ws",
      textProvider: "groq",
      textModel: "llama-3.3-70b-versatile",
      textApiKey: "k",
      imageProvider: "openai",
      imageModel: "gpt-image-1",
      imageApiKey: "k",
    });
    expect(row.textProvider).toBe("groq");
    expect(row.textBaseUrl).toBeNull();
    expect(row.imageProvider).toBe("openai");
    expect(row.imageBaseUrl).toBeNull();
  });

  it("rejects the legacy id on save (read-side alias only)", () => {
    expectAIConfigError(
      () =>
        prepareConfigRow({
          workspaceId: "ws",
          textProvider: "openai-compatible",
          textModel: "m",
          textBaseUrl: "https://api.openai.com/v1",
          textApiKey: "k",
          imageProvider: "gemini",
          imageModel: "img",
          imageApiKey: "k",
        }),
      /Unknown text provider/,
    );
  });

  it("rejects empty keys and models", () => {
    // blank text key, no stored value
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
      /A text API key is required/,
    );
    // blank image key, no stored value
    expectAIConfigError(
      () =>
        prepareConfigRow({
          workspaceId: "ws",
          textProvider: "gemini",
          textModel: "m",
          textApiKey: "k",
          imageProvider: "gemini",
          imageModel: "img",
          imageApiKey: "",
        }),
      /An image API key is required/,
    );
    // missing models
    expectAIConfigError(
      () =>
        prepareConfigRow({
          workspaceId: "ws",
          textProvider: "gemini",
          textModel: "  ",
          textApiKey: "k",
          imageProvider: "gemini",
          imageModel: "img",
          imageApiKey: "k",
        }),
      /models are required/,
    );
  });

  it("keeps the stored key when a blank key is submitted (no re-encryption churn)", () => {
    const existingEnc = {
      textApiKeyEnc: encryptToken("stored-text-key"),
      imageApiKeyEnc: encryptToken("stored-image-key"),
    };
    const row = prepareConfigRow(
      {
        workspaceId: "ws",
        textProvider: "gemini",
        textModel: "gemini-3.6-flash",
        textApiKey: "   ", // blank → preserve
        imageProvider: "gemini",
        imageModel: "gemini-3.1-flash-image",
        imageApiKey: null, // blank → preserve
      },
      existingEnc,
    );

    // The exact stored ciphertext is reused — nothing re-encrypted.
    expect(row.textApiKeyEnc).toBe(existingEnc.textApiKeyEnc);
    expect(row.imageApiKeyEnc).toBe(existingEnc.imageApiKeyEnc);
    expect(decryptToken(row.textApiKeyEnc!)).toBe("stored-text-key");
    expect(decryptToken(row.imageApiKeyEnc!)).toBe("stored-image-key");
  });

  it("replaces only the keys the user actually entered", () => {
    const existingEnc = {
      textApiKeyEnc: encryptToken("stored-text-key"),
      imageApiKeyEnc: encryptToken("stored-image-key"),
    };
    const row = prepareConfigRow(
      {
        workspaceId: "ws",
        textProvider: "gemini",
        textModel: "gemini-3.6-flash",
        textApiKey: "new-text-key",
        imageProvider: "gemini",
        imageModel: "gemini-3.1-flash-image",
        imageApiKey: "", // blank → preserved
      },
      existingEnc,
    );

    expect(row.textApiKeyEnc).not.toBe(existingEnc.textApiKeyEnc);
    expect(decryptToken(row.textApiKeyEnc!)).toBe("new-text-key");
    expect(row.imageApiKeyEnc).toBe(existingEnc.imageApiKeyEnc);
    expect(decryptToken(row.imageApiKeyEnc!)).toBe("stored-image-key");
  });

  it("still requires a key when the workspace has no stored one", () => {
    expectAIConfigError(
      () =>
        prepareConfigRow(
          {
            workspaceId: "ws",
            textProvider: "gemini",
            textModel: "m",
            textApiKey: "",
            imageProvider: "gemini",
            imageModel: "img",
            imageApiKey: "k",
          },
          { textApiKeyEnc: null, imageApiKeyEnc: null },
        ),
      /A text API key is required/,
    );
  });
});

describe("hasWorkspaceAIConfig / getWorkspaceAIModelLabel (UI honesty gates)", () => {
  it("reports configured when the workspace row exists", async () => {
    dbMock.state.rows = [makeRow({ textModel: "gemini-3.6-flash" })];
    await expect(hasWorkspaceAIConfig("00000000-0000-0000-0000-0000000000a1")).resolves.toBe(true);
    await expect(getWorkspaceAIModelLabel("00000000-0000-0000-0000-0000000000a1")).resolves.toBe(
      "gemini-3.6-flash",
    );
  });

  it("reports unconfigured (no row, no env key) without throwing", async () => {
    delete process.env.GEMINI_API_KEY;
    dbMock.state.rows = [];
    await expect(hasWorkspaceAIConfig("00000000-0000-0000-0000-0000000000c3")).resolves.toBe(false);
  });

  it("treats the dev-only env fallback as configured (matches real call resolution)", async () => {
    dbMock.state.rows = [];
    process.env.GEMINI_API_KEY = "env-key";
    await expect(hasWorkspaceAIConfig("00000000-0000-0000-0000-0000000000c3")).resolves.toBe(true);
  });

  it("falls back to the env default model label when the workspace has no config", async () => {
    dbMock.state.rows = [];
    delete process.env.GEMINI_API_KEY;
    delete process.env.QURTIZ_AI_MODEL;
    await expect(getWorkspaceAIModelLabel("00000000-0000-0000-0000-0000000000c3")).resolves.toBe(
      DEFAULT_MODEL,
    );
  });
});

describe("validateAIConfigShape", () => {
  it("accepts a valid config", () => {
    expect(
      validateAIConfigShape({
        textProvider: "gemini",
        textModel: "gemini-3.6-flash",
        imageProvider: "custom",
        imageModel: "gpt-image-1",
        imageBaseUrl: "https://api.openai.com/v1",
      }),
    ).toBeNull();
  });

  it("accepts a preset with no base URL (catalog default is filled later)", () => {
    expect(
      validateAIConfigShape({
        textProvider: "openrouter",
        textModel: "openrouter/auto",
        imageProvider: "groq",
        imageModel: "llama-3.3-70b-versatile",
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

  it("requires a base URL for custom openai-compatible endpoints", () => {
    expect(
      validateAIConfigShape({
        textProvider: "gemini",
        textModel: "m",
        imageProvider: "custom",
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
        textBaseUrl: "https://legacy-gateway.example/v1",
        textApiKeyEnc: encryptToken("text-key-B"),
        imageProvider: "openai-compatible",
      }),
    ];
    const b = await getWorkspaceTextModel("00000000-0000-0000-0000-0000000000b2");
    expect(b.apiKey).toBe("text-key-B");
    expect(b.modelId).toBe("model-B");
    // Phase-1 rows store the generic "openai-compatible" id — read-side
    // resolution keeps them working via the catalog alias (→ custom), with
    // their own stored base URL.
    expect(b.provider).toBe("openai-compatible");
    expect(b.baseUrl).toBe("https://legacy-gateway.example/v1");
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

describe("AI provider catalog (Phase 3)", () => {
  /** Product-spec-fixed catalog: labels, kinds, defaults and hints. */
  const EXPECTED_CATALOG: Record<
    string,
    { label: string; kind: "gemini" | "openai-compatible"; defaultBaseUrl?: string; modelHint?: string }
  > = {
    gemini: { label: "Google Gemini", kind: "gemini" },
    openai: { label: "OpenAI", kind: "openai-compatible", defaultBaseUrl: "https://api.openai.com/v1" },
    openrouter: {
      label: "OpenRouter",
      kind: "openai-compatible",
      defaultBaseUrl: "https://openrouter.ai/api/v1",
      modelHint: "openrouter/auto",
    },
    nvidia: {
      label: "NVIDIA NIM",
      kind: "openai-compatible",
      defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
      modelHint: "meta/llama-3.1-405b-instruct",
    },
    groq: {
      label: "Groq",
      kind: "openai-compatible",
      defaultBaseUrl: "https://api.groq.com/openai/v1",
      modelHint: "llama-3.3-70b-versatile",
    },
    together: { label: "Together AI", kind: "openai-compatible", defaultBaseUrl: "https://api.together.xyz/v1" },
    fireworks: { label: "Fireworks AI", kind: "openai-compatible", defaultBaseUrl: "https://api.fireworks.ai/inference/v1" },
    deepseek: {
      label: "DeepSeek",
      kind: "openai-compatible",
      defaultBaseUrl: "https://api.deepseek.com/v1",
      modelHint: "deepseek-chat",
    },
    mistral: {
      label: "Mistral AI",
      kind: "openai-compatible",
      defaultBaseUrl: "https://api.mistral.ai/v1",
      modelHint: "mistral-large-latest",
    },
    xai: {
      label: "xAI (Grok)",
      kind: "openai-compatible",
      defaultBaseUrl: "https://api.x.ai/v1",
      modelHint: "grok-2-latest",
    },
    cerebras: { label: "Cerebras", kind: "openai-compatible", defaultBaseUrl: "https://api.cerebras.ai/v1" },
    perplexity: { label: "Perplexity", kind: "openai-compatible", defaultBaseUrl: "https://api.perplexity.ai" },
    "github-models": {
      label: "GitHub Models",
      kind: "openai-compatible",
      defaultBaseUrl: "https://models.inference.ai.azure.com",
    },
    omniroute: {
      label: "Omni Route (self-hosted gateway)",
      kind: "openai-compatible",
      defaultBaseUrl: "http://localhost:20128/v1",
    },
    ollama: { label: "Ollama (local)", kind: "openai-compatible", defaultBaseUrl: "http://localhost:11434/v1" },
    custom: { label: "Custom OpenAI-compatible", kind: "openai-compatible" },
  };

  it("matches the curated spec table exactly (labels, kinds, base URLs, hints)", () => {
    expect(CATALOG_PROVIDER_IDS).toHaveLength(Object.keys(EXPECTED_CATALOG).length);
    for (const [id, expected] of Object.entries(EXPECTED_CATALOG)) {
      const entry = AI_PROVIDER_CATALOG[id as CatalogProviderId];
      expect(entry, `catalog entry "${id}"`).toBeDefined();
      expect(entry.label).toBe(expected.label);
      expect(entry.kind).toBe(expected.kind);
      expect(entry.defaultBaseUrl).toBe(expected.defaultBaseUrl);
      expect(entry.modelHint).toBe(expected.modelHint);
    }
    expect(AI_PROVIDER_CATALOG.omniroute.note).toMatch(/endpoint may differ/);
  });

  it("keeps every entry well-formed and grouped for the picker", () => {
    for (const id of CATALOG_PROVIDER_IDS) {
      const e = AI_PROVIDER_CATALOG[id];
      expect(e.id).toBe(id);
      expect(e.label.trim().length).toBeGreaterThan(0);
      expect(["gemini", "openai-compatible"]).toContain(e.kind);
      expect(PROVIDER_GROUP_ORDER).toContain(e.group);
    }
  });

  it("gemini has no base URL; every openai-compatible preset has one EXCEPT custom", () => {
    expect(AI_PROVIDER_CATALOG.gemini.kind).toBe("gemini");
    expect(AI_PROVIDER_CATALOG.gemini.defaultBaseUrl).toBeUndefined();
    const noDefault = CATALOG_PROVIDER_IDS.filter(
      (id) => AI_PROVIDER_CATALOG[id].kind === "openai-compatible" && !AI_PROVIDER_CATALOG[id].defaultBaseUrl,
    );
    expect(noDefault).toEqual(["custom"]);
  });

  it("resolves the legacy stored id 'openai-compatible' to the custom entry (read side)", () => {
    expect(catalogEntry("openai-compatible")?.id).toBe("custom");
    expect(catalogEntry("openai-compatible")?.label).toBe("Custom OpenAI-compatible");
    expect(isKnownProvider("openai-compatible")).toBe(true);
    // ...but it is NOT a savable catalog id
    expect(isCatalogProviderId("openai-compatible")).toBe(false);
    expect(CATALOG_PROVIDER_IDS).not.toContain("openai-compatible");
    expect(catalogEntry("definitely-not-a-provider")).toBeUndefined();
    expect(isKnownProvider("definitely-not-a-provider")).toBe(false);
  });
});

describe("resolvedBaseUrl (stored ?? catalog default)", () => {
  it("fills the catalog default when the stored URL is empty or blank for presets", () => {
    expect(resolvedBaseUrl("groq", "")).toBe("https://api.groq.com/openai/v1");
    expect(resolvedBaseUrl("groq", "   ")).toBe("https://api.groq.com/openai/v1");
    expect(resolvedBaseUrl("groq", null)).toBe("https://api.groq.com/openai/v1");
    expect(resolvedBaseUrl("groq", undefined)).toBe("https://api.groq.com/openai/v1");
    expect(resolvedBaseUrl("openrouter", "")).toBe("https://openrouter.ai/api/v1");
    expect(resolvedBaseUrl("openai", "")).toBe("https://api.openai.com/v1");
  });

  it("prefers the stored URL over the catalog default", () => {
    expect(resolvedBaseUrl("groq", " https://gateway.example/v1 ")).toBe("https://gateway.example/v1");
  });

  it("returns null for gemini (no base URL concept)", () => {
    expect(resolvedBaseUrl("gemini", "")).toBeNull();
    expect(resolvedBaseUrl("gemini", null)).toBeNull();
    expect(resolvedBaseUrl("gemini", "https://should-not-happen.example/v1")).toBeNull();
  });

  it("fails honestly for custom without a stored URL", () => {
    expect(() => resolvedBaseUrl("custom", "")).toThrow(/Base URL/);
    expect(() => resolvedBaseUrl("custom", null)).toThrow(/Base URL/);
    expect(() => resolvedBaseUrl("custom", undefined)).toThrow(/Base URL/);
  });

  it("returns the stored URL for custom and for the legacy alias", () => {
    expect(resolvedBaseUrl("custom", "https://my-gateway.example/v1")).toBe("https://my-gateway.example/v1");
    expect(resolvedBaseUrl("openai-compatible", "https://legacy.example/v1")).toBe("https://legacy.example/v1");
  });

  it("throws for unknown providers", () => {
    expect(() => resolvedBaseUrl("claude", "https://x.example/v1")).toThrow(/Unknown AI provider/);
  });
});

describe("runtime preset/custom resolution through the workspace row", () => {
  it("fills the catalog default for a preset row with an empty stored base URL", async () => {
    dbMock.state.rows = [
      makeRow({
        textProvider: "groq",
        textModel: "llama-3.3-70b-versatile",
        textBaseUrl: "",
        textApiKeyEnc: encryptToken("groq-key"),
      }),
    ];
    const resolved = await getWorkspaceTextModel("00000000-0000-0000-0000-0000000000a1");
    expect(resolved.provider).toBe("groq");
    expect(resolved.modelId).toBe("llama-3.3-70b-versatile");
    expect(resolved.baseUrl).toBe("https://api.groq.com/openai/v1");
    expect(resolved.apiKey).toBe("groq-key");
  });

  it("honors a stored override for a preset row", async () => {
    dbMock.state.rows = [
      makeRow({
        textProvider: "openrouter",
        textModel: "openrouter/auto",
        textBaseUrl: "https://proxy.example/v1",
        textApiKeyEnc: encryptToken("or-key"),
      }),
    ];
    const resolved = await getWorkspaceTextModel("00000000-0000-0000-0000-0000000000a1");
    expect(resolved.baseUrl).toBe("https://proxy.example/v1");
  });

  it("throws an honest AIConfigError for a custom row without a stored base URL", async () => {
    dbMock.state.rows = [
      makeRow({
        textProvider: "custom",
        textModel: "some-model",
        textBaseUrl: null,
        textApiKeyEnc: encryptToken("custom-key"),
      }),
    ];
    try {
      await getWorkspaceTextModel("00000000-0000-0000-0000-0000000000a1");
      throw new Error("expected AIConfigError");
    } catch (error) {
      if (error instanceof Error && error.message === "expected AIConfigError") throw error;
      expect(error).toBeInstanceOf(AIConfigError);
      expect((error as AIConfigError).message).toBe("INVALID_CONFIG");
      expect((error as AIConfigError).detail).toMatch(/Base URL/);
    }
  });
});

describe("saveAIConfigInputSchema (action-level validation)", () => {
  const base = {
    textProvider: "gemini",
    textModel: "gemini-3.6-flash",
    imageProvider: "gemini",
    imageModel: "gemini-3.1-flash-image",
  };

  /** zod v4 exposes `.error` only on the failure branch — this keeps the
   *  failure assertions below tolerant of the union typing. */
  function firstIssueMessage(result: {
    success: boolean;
    error?: { issues?: { message?: string }[] };
  }): string | undefined {
    return result.error?.issues?.[0]?.message;
  }

  it("accepts a gemini config and catalog presets with or without a stored base URL", () => {
    expect(saveAIConfigInputSchema.safeParse(base).success).toBe(true);
    const groq = saveAIConfigInputSchema.safeParse({
      ...base,
      textProvider: "groq",
      textModel: "llama-3.3-70b-versatile",
    });
    expect(groq.success).toBe(true);
    const openrouterWithOverride = saveAIConfigInputSchema.safeParse({
      ...base,
      textProvider: "openrouter",
      textModel: "openrouter/auto",
      textBaseUrl: "https://proxy.example/v1",
    });
    expect(openrouterWithOverride.success).toBe(true);
  });

  it("accepts custom with a base URL", () => {
    const r = saveAIConfigInputSchema.safeParse({
      ...base,
      textProvider: "custom",
      textModel: "my-model",
      textBaseUrl: "https://my-gateway.example/v1",
    });
    expect(r.success).toBe(true);
  });

  it("rejects custom without a base URL (missing or blank)", () => {
    const missing = saveAIConfigInputSchema.safeParse({
      ...base,
      textProvider: "custom",
      textModel: "my-model",
    });
    expect(missing.success).toBe(false);
    expect(firstIssueMessage(missing)).toMatch(/Base URL/);

    const blank = saveAIConfigInputSchema.safeParse({
      ...base,
      imageProvider: "custom",
      imageModel: "my-image-model",
      imageBaseUrl: "   ",
    });
    expect(blank.success).toBe(false);
    expect(firstIssueMessage(blank)).toMatch(/Base URL/);
  });

  it("rejects unknown and legacy provider ids on save", () => {
    const unknown = saveAIConfigInputSchema.safeParse({ ...base, textProvider: "anthropic" });
    expect(unknown.success).toBe(false);
    expect(firstIssueMessage(unknown)).toMatch(/Unknown text provider/);

    // Legacy rows keep working on READ (alias) but cannot be re-saved.
    const legacy = saveAIConfigInputSchema.safeParse({
      ...base,
      textProvider: "openai-compatible",
      textModel: "model",
      textBaseUrl: "https://api.openai.com/v1",
    });
    expect(legacy.success).toBe(false);
    expect(firstIssueMessage(legacy)).toMatch(/Unknown text provider/);
  });

  it("still requires models and accepts blank-key-preserve inputs", () => {
    expect(saveAIConfigInputSchema.safeParse({ ...base, textModel: "  " }).success).toBe(false);
    const blankKeys = saveAIConfigInputSchema.safeParse({
      ...base,
      textApiKey: "",
      imageApiKey: null,
    });
    expect(blankKeys.success).toBe(true);
  });
});
