import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { generateImage } from "@/lib/ai/image";

afterEach(() => vi.unstubAllGlobals());

describe("OpenAI-compatible image adapter capability negotiation", () => {
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

  it("falls back to generation when edits are unavailable without losing the visual brief", async () => {
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#abcdef" } }).png().toBuffer();
    const fetchMock = vi.fn(async (url: string) => url.endsWith("/images/edits")
      ? new Response("", { status: 404 })
      : new Response(JSON.stringify({ data: [{ b64_json: image.toString("base64") }] }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateImage({ provider: "openai", apiKey: "test-key", modelId: "new-model",
      baseUrl: null, prompt: "Precise product photograph", references: [{ mimeType: "image/png", base64: image.toString("base64") }] });
    expect(result.ok).toBe(true);
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual(["https://api.openai.com/v1/images/edits", "https://api.openai.com/v1/images/generations"]);
    expect(JSON.parse(String(calls[1][1].body)).prompt).toBe("Precise product photograph");
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
