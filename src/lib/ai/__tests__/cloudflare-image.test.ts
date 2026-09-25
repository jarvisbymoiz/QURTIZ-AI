import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { generateImage } from "@/lib/ai/image";

const accountId = "0123456789abcdef0123456789abcdef";
const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai`;
const flux = "@cf/black-forest-labs/flux-1-schnell";
const sdxl = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
const token = "test-cloudflare-token-never-log";
const runCalls = (mock: ReturnType<typeof vi.fn>) => (mock.mock.calls as unknown as [string, RequestInit][]).filter(([url]) => url.includes("/run/"));
const schemaResponse = (properties: Record<string, unknown> = {}, required: string[] = []) =>
  new Response(JSON.stringify({ success: true, result: { input: { properties, required } } }), { headers: { "Content-Type": "application/json" } });

async function jpeg() {
  return sharp({ create: { width: 2, height: 2, channels: 3, background: "#123456" } }).jpeg().toBuffer();
}

afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare Workers AI native image adapter", () => {
  it("sends an authenticated native FLUX request and normalizes its JSON JPEG into pipeline PNG", async () => {
    const source = await jpeg();
    const fetchMock = vi.fn(async (url: string) => url.includes("/models/schema") ? schemaResponse() : new Response(JSON.stringify({ success: true, result: { image: source.toString("base64") } }),
      { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateImage({ provider: "cloudflare", modelId: flux, baseUrl, apiKey: token, prompt: "A blue lantern" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((await sharp(result.png).metadata()).format).toBe("png");
    expect(result.model).toBe(flux);
    const [url, init] = runCalls(fetchMock)[0];
    expect(url).toBe(`${baseUrl}/run/${flux}`);
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${token}` });
    expect(init.redirect).toBe("error");
    expect(JSON.parse(String(init.body))).toEqual({ prompt: "A blue lantern" });
  });

  it("accepts binary SDXL output and passes one reference using its native schema", async () => {
    const source = await jpeg();
    const fetchMock = vi.fn(async (url: string) => url.includes("/models/schema") ? schemaResponse({ image_b64: { type: "string" } }) : new Response(new Uint8Array(source), { headers: { "Content-Type": "image/jpeg" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateImage({ provider: "cloudflare", modelId: sdxl, baseUrl, apiKey: token,
      prompt: "An emerald garden", references: [{ mimeType: "image/jpeg", base64: source.toString("base64") }] });
    expect(result.ok).toBe(true);
    if (result.ok) expect((await sharp(result.png).metadata()).format).toBe("png");
    const [url, init] = runCalls(fetchMock)[0];
    expect(url).toBe(`${baseUrl}/run/${sdxl}`);
    expect(JSON.parse(String(init.body))).toEqual({ prompt: "An emerald garden", image_b64: source.toString("base64") });
  });

  it.each([
    [401, "invalid or revoked", "api_error"],
    [403, "permission", "api_error"],
    [404, "account or image model", "api_error"],
    [429, "rate limit", "quota_or_billing"],
  ] as const)("returns a useful HTTP %i error without revealing the token", async (status, message, reason) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: "Request failed" }] }),
      { status, headers: { "Content-Type": "application/json" } })));
    const result = await generateImage({ provider: "cloudflare", modelId: flux, baseUrl, apiKey: token, prompt: "A leaf" });
    expect(result).toMatchObject({ ok: false, reason });
    if (!result.ok) {
      expect(result.message.toLowerCase()).toContain(message);
      expect(result.message).not.toContain(token);
    }
  });

  it("rejects malformed output and unsafe endpoints before storage", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, result: { image: "not an image!" } }),
      { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const request = { provider: "cloudflare" as const, modelId: flux, baseUrl, apiKey: token, prompt: "A leaf" };
    expect(await generateImage(request)).toMatchObject({ ok: false, message: expect.stringContaining("no valid image") });
    expect(await generateImage({ ...request, modelId: "not-a-workers-ai-model" })).toMatchObject({ ok: false, message: expect.stringContaining("Invalid Workers AI model ID") });
    expect(await generateImage({ ...request, baseUrl: "https://evil.test/ai" })).toMatchObject({ ok: false, message: expect.stringContaining("Invalid Cloudflare") });
    expect(runCalls(fetchMock)).toHaveLength(1);
  });
  it("distinguishes permission and unsupported-model responses from revoked-token and account errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: "Missing Workers AI permission" }] }),
      { status: 401, headers: { "Content-Type": "application/json" } })));
    const request = { provider: "cloudflare" as const, modelId: flux, baseUrl, apiKey: token, prompt: "A leaf" };
    expect(await generateImage(request)).toMatchObject({ ok: false, message: expect.stringContaining("lacks Workers AI permission") });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: "Model not found" }] }),
      { status: 404, headers: { "Content-Type": "application/json" } })));
    expect(await generateImage(request)).toMatchObject({ ok: false, message: expect.stringContaining("Model not found") });
  });

  it.each(["@cf/leonardo/lucid-origin", "@cf/leonardo/phoenix-1.0", "@cf/another-provider/new-image-model"])("passes configurable model %s to Cloudflare", async (modelId) => {
    const source = await jpeg();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, result: { image: source.toString("base64") } }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateImage({ provider: "cloudflare", modelId, baseUrl, apiKey: token, prompt: "A new image" });
    expect(result.ok).toBe(true);
    expect(runCalls(fetchMock)[0][0]).toBe(`${baseUrl}/run/${modelId}`);
  });

  it("sends FLUX.2 models as multipart form data", async () => {
    const source = await jpeg();
    const fetchMock = vi.fn(async (url: string) => url.includes("/models/schema") ? schemaResponse({ multipart: {}, input_image_0: {} }, ["multipart"]) : new Response(JSON.stringify({ result: { image: source.toString("base64") } }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateImage({ provider: "cloudflare", modelId: "@cf/black-forest-labs/flux-2-dev", baseUrl, apiKey: token, prompt: "A mountain" });
    expect(result.ok).toBe(true);
    const init = runCalls(fetchMock)[0][1];
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("prompt")).toBe("A mountain");
    expect(init.headers).not.toHaveProperty("Content-Type");
  });

  it("uses discovered capabilities for arbitrary models and omits unsupported controls", async () => {
    const source = await jpeg();
    const modelId = "@cf/example/future-image-model";
    const fetchMock = vi.fn(async (url: string) => url.includes("/models/schema")
      ? schemaResponse({ width: { type: "integer", minimum: 256, maximum: 1024 }, height: { type: "integer", minimum: 256, maximum: 1024 } })
      : new Response(JSON.stringify({ result: { image: source.toString("base64") } }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateImage({ provider: "cloudflare", modelId, baseUrl, apiKey: token, prompt: "Detailed scene",
      options: { width: 1080, height: 720, negativePrompt: "No clutter", guidance: 7 } });
    expect(result.ok).toBe(true);
    expect(JSON.parse(String(runCalls(fetchMock)[0][1].body))).toEqual({ prompt: "Detailed scene", width: 1024, height: 720 });
  });

  it("passes multiple references only when the discovered multipart fields support them", async () => {
    const source = await jpeg();
    const modelId = "@cf/example/multipart-reference-model";
    const fetchMock = vi.fn(async (url: string) => url.includes("/models/schema")
      ? schemaResponse({ multipart: {}, input_image_0: {}, input_image_1: {} }, ["multipart"])
      : new Response(JSON.stringify({ result: { image: source.toString("base64") } }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const reference = { mimeType: "image/jpeg", base64: source.toString("base64") };
    const result = await generateImage({ provider: "cloudflare", modelId, baseUrl, apiKey: token,
      prompt: "Use both references", references: [reference, reference, reference] });
    expect(result.ok).toBe(true);
    const form = runCalls(fetchMock)[0][1].body as FormData;
    expect(form.get("input_image_0")).toBeInstanceOf(File);
    expect(form.get("input_image_1")).toBeInstanceOf(File);
    expect(form.get("input_image_2")).toBeNull();
  });

  it("normalizes a future model's nested base64 image response", async () => {
    const source = await jpeg();
    const modelId = "@cf/example/nested-response-model";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/models/schema") ? schemaResponse()
      : new Response(JSON.stringify({ success: true, result: { images: [{ b64_json: source.toString("base64") }] } }),
        { headers: { "Content-Type": "application/json" } })));
    const result = await generateImage({ provider: "cloudflare", modelId, baseUrl, apiKey: token, prompt: "A nested image" });
    expect(result.ok).toBe(true);
    if (result.ok) expect((await sharp(result.png).metadata()).format).toBe("png");
  });

  it("continues with textual reference context when a model schema has no image input", async () => {
    const source = await jpeg();
    const fetchMock = vi.fn(async (url: string) => url.includes("/models/schema") ? schemaResponse() : new Response(JSON.stringify({ result: { image: source.toString("base64") } }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateImage({ provider: "cloudflare", modelId: flux, baseUrl, apiKey: token,
      prompt: "Portrait", references: [{ mimeType: "image/png", base64: "AA==" }] });
    expect(result.ok).toBe(true);
    expect(JSON.parse(String(runCalls(fetchMock)[0][1].body))).toEqual({ prompt: "Portrait" });
  });
});
