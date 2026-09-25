import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { agentRuns, brandAssets, brands, contentItems, contentVariants, visualAssets } from "@/db/schema";

const state = vi.hoisted(() => ({ format: "single_image", visuals: [] as Record<string, unknown>[] }));
vi.mock("@/lib/ai/config", () => ({ getWorkspaceImageTarget: vi.fn(async () => ({
  provider: "cloudflare", modelId: "@cf/black-forest-labs/flux-1-schnell", apiKey: "test-token",
  baseUrl: "https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai",
})) }));
vi.mock("@/db", () => ({ getDb: () => ({
  select: () => ({ from: (table: unknown) => {
    const rows = table === contentItems ? [{ id: "item", workspaceId: "ws", topic: "Autumn launch", format: state.format, status: "approved" }]
      : table === contentVariants ? [{ id: "variant", platform: "instagram", format: state.format,
        slides: [{ index: 0, visualPrompt: "First visual" }, { index: 1, visualPrompt: "Second visual" }] }]
      : table === brands || table === brandAssets ? [] : [];
    return { where: () => ({ then: (resolve: (value: unknown[]) => void) => resolve(rows),
      limit: async () => rows.slice(0, 1), orderBy: () => ({ limit: async () => rows.slice(0, 1) }) }) };
  } }),
  insert: (table: unknown) => ({ values: (values: Record<string, unknown>) => ({ returning: async () => {
    if (table === visualAssets) { state.visuals.push(values); return [{ id: `visual-${state.visuals.length}` }]; }
    if (table === agentRuns) return [{ id: "run" }];
    return [];
  } }) }),
  update: () => ({ set: () => ({ where: async () => [] }) }),
}) }));

import { generateVisual } from "@/lib/visuals/generate";

afterEach(() => { vi.unstubAllGlobals(); state.visuals = []; });

describe("Cloudflare image to Qurtiz media pipeline", () => {
  it("stores a Single Image and an ordered Carousel slide as PNG with their visual prompts", async () => {
    const jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#aabbcc" } }).jpeg().toBuffer();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, result: { image: jpeg.toString("base64") } }),
      { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const uploads: Array<{ bytes: Buffer; options: Record<string, unknown> }> = [];
    const storage = { storage: { from: () => ({ upload: async (_path: string, bytes: Buffer, options: Record<string, unknown>) => {
      uploads.push({ bytes, options }); return { error: null };
    } }) } };
    const common = { workspaceId: "ws", userId: "user", contentItemId: "item", mode: "ai" as const, storage: storage as never };
    const single = await generateVisual(common);
    expect(single.ok, JSON.stringify(single)).toBe(true);
    expect(single).toMatchObject({ ok: true, visualId: "visual-1" });
    state.format = "carousel";
    const slide = await generateVisual({ ...common, slideIndex: 1, variantId: "variant" });
    expect(slide).toMatchObject({ ok: true, visualId: "visual-2" });
    expect(state.visuals.map(v => v.slideIndex)).toEqual([null, 1]);
    expect(uploads).toHaveLength(2);
    for (const upload of uploads) {
      expect(upload.options.contentType).toBe("image/png");
      expect((await sharp(upload.bytes).metadata()).format).toBe("png");
    }
    const runCalls = (fetchMock.mock.calls as unknown as [string, RequestInit][]).filter(([url]) => url.includes("/run/"));
    expect(JSON.parse(String(runCalls[1][1].body)).prompt).toContain("Second visual");
  });
});
