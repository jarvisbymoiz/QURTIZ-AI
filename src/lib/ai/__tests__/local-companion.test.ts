import { afterEach, describe, expect, it, vi } from "vitest";
import { checkLocalCompanion, generateLocalCompanionImage, pairLocalCompanion } from "@/lib/ai/local-companion";

afterEach(() => vi.unstubAllGlobals());

describe("browser local companion adapter", () => {
  it("contacts loopback with only the local pairing key", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await checkLocalCompanion("local-pairing");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8788/health");
    expect(init.headers).toMatchObject({ "x-qurtiz-pairing": "local-pairing" });
    expect(JSON.stringify(init)).not.toContain("chatgpt");
  });

  it("pairs automatically and keeps the secret in namespaced browser session storage", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ pairingKey: "local-secret-with-at-least-20-characters" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await pairLocalCompanion("user-1", "workspace-1")).toBe("local-secret-with-at-least-20-characters");
    expect(values.get("qurtiz:local-image-pairing:user-1:workspace-1")).toBe("local-secret-with-at-least-20-characters");
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8788/pair");
  });

  it("uses the selected model and normalizes a base64 response", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await generateLocalCompanionImage({ pairingKey: "pair", modelId: "user/model", prompt: "A tree" })).toBe("aGVsbG8=");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "user/model", prompt: "A tree", quality: "high" });
  });

  it("lets the gateway choose an image model when none is configured", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await generateLocalCompanionImage({ pairingKey: "pair", prompt: "A tree" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty("model");
  });

  it("surfaces upstream quota without marking it successful", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "Free quota exhausted" } }), { status: 429 })));
    await expect(generateLocalCompanionImage({ pairingKey: "pair", modelId: "model", prompt: "A tree" }))
      .rejects.toThrow(/Free quota exhausted/);
  });

  it("uses image edits when a brand reference is available", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await generateLocalCompanionImage({ pairingKey: "pair", modelId: "model", prompt: "Use this style",
      references: [{ mimeType: "image/png", base64: "aGVsbG8=" }] });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8788/v1/images/edits");
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "model", quality: "high", images: [
      { image_url: "data:image/png;base64,aGVsbG8=" },
    ] });
  });

  it("rejects a missing image", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
    await expect(generateLocalCompanionImage({ pairingKey: "pair", modelId: "model", prompt: "A tree" }))
      .rejects.toThrow(/malformed/);
  });
});
