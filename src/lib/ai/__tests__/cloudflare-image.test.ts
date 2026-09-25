import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { generateImage } from "@/lib/ai/image";

const accountId = "0123456789abcdef0123456789abcdef";
const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai`;
const flux = "@cf/black-forest-labs/flux-1-schnell";
const sdxl = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
const token = "test-cloudflare-token-never-log";

async function jpeg() {
  return sharp({ create: { width: 2, height: 2, channels: 3, background: "#123456" } }).jpeg().toBuffer();
}

afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare Workers AI native image adapter", () => {
  it("sends an authenticated native FLUX request and normalizes its JSON JPEG into pipeline PNG", async () => {
    const source = await jpeg();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, result: { image: source.toString("base64") } }),
      { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateImage({ provider: "cloudflare", modelId: flux, baseUrl, apiKey: token, prompt: "A blue lantern" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((await sharp(result.png).metadata()).format).toBe("png");
    expect(result.model).toBe(flux);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${baseUrl}/run/${flux}`);
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${token}` });
    expect(init.redirect).toBe("error");
    expect(JSON.parse(String(init.body))).toEqual({ prompt: "A blue lantern" });
  });

  it("accepts binary SDXL output and passes one reference using its native schema", async () => {
    const source = await jpeg();
    const fetchMock = vi.fn(async () => new Response(new Uint8Array(source), { headers: { "Content-Type": "image/jpeg" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateImage({ provider: "cloudflare", modelId: sdxl, baseUrl, apiKey: token,
      prompt: "An emerald garden", references: [{ mimeType: "image/jpeg", base64: source.toString("base64") }] });
    expect(result.ok).toBe(true);
    if (result.ok) expect((await sharp(result.png).metadata()).format).toBe("png");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    expect((fetchMock.mock.calls as unknown as [string, RequestInit][])[0][0]).toBe(`${baseUrl}/run/${modelId}`);
  });

  it("sends FLUX.2 models as multipart form data", async () => {
    const source = await jpeg();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ result: { image: source.toString("base64") } }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateImage({ provider: "cloudflare", modelId: "@cf/black-forest-labs/flux-2-dev", baseUrl, apiKey: token, prompt: "A mountain" });
    expect(result.ok).toBe(true);
    const init = (fetchMock.mock.calls as unknown as [string, RequestInit][])[0][1];
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("prompt")).toBe("A mountain");
    expect(init.headers).not.toHaveProperty("Content-Type");
  });

  it("does not silently discard Brand Brain references unsupported by FLUX", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateImage({ provider: "cloudflare", modelId: flux, baseUrl, apiKey: token,
      prompt: "Portrait", references: [{ mimeType: "image/png", base64: "AA==" }] });
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("does not accept reference images") });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
