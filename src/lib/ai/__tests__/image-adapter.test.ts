import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { generateImage } from "@/lib/ai/image";

afterEach(() => vi.unstubAllGlobals());

describe("OpenAI-compatible image adapter capability negotiation", () => {
  it("uses OpenRouter's discovered native reference capacity and preserves all five inputs", async () => {
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#123456" } }).png().toBuffer();
    const fetchMock = vi.fn(async (url: string) => url.endsWith("/endpoints")
      ? Response.json({ endpoints: [{ provider_tag: "reference-provider", supported_parameters: { input_references: { type: "range", max: 5 } } }] })
      : Response.json({ data: [{ b64_json: image.toString("base64") }] }));
    vi.stubGlobal("fetch", fetchMock);
    const references = Array.from({ length: 5 }, (_, index) => ({ mimeType: "image/png", base64: Buffer.from(`ref-${index}`).toString("base64") }));
    const args = { provider: "openrouter" as const, apiKey: "test-key", modelId: "arbitrary/image-model", baseUrl: null, prompt: "Brand-aware composition", references };
    expect((await generateImage(args)).ok).toBe(true);
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls[1][0]).toBe("https://openrouter.ai/api/v1/images");
    const body = JSON.parse(String(calls[1][1].body));
    expect(body.input_references.map((ref: { image_url: { url: string } }) => ref.image_url.url)).toEqual(references.map(ref => `data:${ref.mimeType};base64,${ref.base64}`));
    expect(body.provider).toEqual({ only: ["reference-provider"], allow_fallbacks: false });
    fetchMock.mockClear();
    expect(await generateImage({ ...args, references: [...references, references[0]] })).toMatchObject({ ok: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("uses image edits when the selected endpoint accepts a generation reference", async () => {
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#123456" } }).png().toBuffer();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: image.toString("base64") }] }),
      { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateImage({ provider: "openai", apiKey: "test-key", modelId: "future-image-model",
      baseUrl: null, prompt: "Use the reference palette", references: [{ mimeType: "image/png", base64: image.toString("base64") }] });
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/images/edits");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("model")).toBe("future-image-model");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not silently drop references when the configured endpoint rejects edits", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateImage({ provider: "openai", apiKey: "test-key", modelId: "new-model",
      baseUrl: null, prompt: "Precise product photograph", references: [{ mimeType: "image/png", base64: "aGVsbG8=" }] });
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("No references were silently discarded") });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends logo, identity and three designs in attachment order", async () => {
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#abcdef" } }).png().toBuffer();
    const fetchMock = vi.fn(async () => Response.json({ data: [{ b64_json: image.toString("base64") }] }));
    vi.stubGlobal("fetch", fetchMock);
    const roles = ["logo", "profileAvatar", "designReference", "designReference", "designReference"] as const;
    const references = roles.map((role, index) => ({ role, mimeType: "image/png", base64: Buffer.from(`pixels-${index}`).toString("base64") }));
    expect((await generateImage({ provider: "custom", apiKey: "test-key", modelId: "configured-model", baseUrl: "https://images.example.com/v1", prompt: "role-aware brief", references })).ok).toBe(true);
    const form = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    const files = form.getAll("image[]") as File[];
    expect(files).toHaveLength(5);
    expect(await Promise.all(files.map(file => file.text()))).toEqual(roles.map((_, index) => `pixels-${index}`));
    expect(files.every(file => file.type === "image/png")).toBe(true);
  });

  it("redacts provider-reflected API keys from image failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "Rejected test-key" } }),
      { status: 400, headers: { "Content-Type": "application/json" } })));
    const result = await generateImage({ provider: "openai", apiKey: "test-key", modelId: "future-image-model",
      baseUrl: null, prompt: "A scene" });
    expect(result).toMatchObject({ ok: false, reason: "api_error" });
    if (!result.ok) { expect(result.message).not.toContain("test-key"); expect(result.message).toContain("[redacted]"); }
  });

  it("retries a Gemini image model without aspect controls only when it rejects that parameter", async () => {
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#234567" } }).png().toBuffer();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const config = JSON.parse(String(init.body)).generationConfig as { imageConfig?: unknown };
      return config.imageConfig
        ? new Response(JSON.stringify({ error: { message: "imageConfig is not supported" } }), { status: 400 })
        : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: image.toString("base64") } }] } }] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateImage({ provider: "gemini", apiKey: "test-key", modelId: "future-gemini-image",
      baseUrl: null, prompt: "A scene", options: { aspectRatio: "1:1" } });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body)).generationConfig).toEqual({ responseModalities: ["IMAGE"] });
  });
});
