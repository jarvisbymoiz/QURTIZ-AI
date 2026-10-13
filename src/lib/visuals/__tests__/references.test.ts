import { beforeAll, expect, it, vi } from "vitest";
import sharp from "sharp";

const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[][], limits: [] as number[] }));
vi.mock("@/db", () => ({ getDb: () => ({ select: () => ({ from: () => ({ where: () => ({ orderBy: () => {
  const rows = state.rows.shift()!;
  return { then: (resolve: (value: unknown[]) => void) => resolve(rows), limit: async (count: number) => {
    state.limits.push(count); return rows.slice(0, count);
  } };
} }) }) }) }) }));

let fetchGenerationReferences: typeof import("@/lib/visuals/generate").fetchGenerationReferences;
beforeAll(async () => { ({ fetchGenerationReferences } = await import("@/lib/visuals/generate")); }, 15000);

it("downloads the logo, avatar and every design in database order with pixel-verified MIME", async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#123456" } }).png().toBuffer();
  const assets = ["logo", "avatar", "reference", "reference", "reference"].map((kind, index) => ({
    id: `asset-${index}`, kind, storagePath: `workspace/${index}`, mimeType: "image/jpeg", label: null,
  }));
  state.rows = [[assets[0]], [assets[1]], assets.slice(2)]; state.limits = [];
  const downloaded: string[] = [];
  const storage = { storage: { from: () => ({ download: async (path: string) => {
    downloaded.push(path); return { data: new Blob([new Uint8Array(png)]), error: null };
  } }) } };
  const references = await fetchGenerationReferences(storage as never, "workspace");
  expect(references.map(ref => ref.assetId)).toEqual(assets.map(asset => asset.id));
  expect(downloaded).toEqual(assets.map(asset => asset.storagePath));
  expect(references.map(ref => ref.kind)).toEqual(["logo", "avatar", "reference", "reference", "reference"]);
  expect(references.every(ref => ref.mimeType === "image/png" && ref.data.equals(png))).toBe(true);
  expect(state.limits).toEqual([1, 1, 17]);
});

it("retries one transient storage read without retrying permanent permission errors", async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#123456" } }).png().toBuffer();
  const asset = { id: "logo", kind: "logo", storagePath: "workspace/logo", mimeType: "image/png", label: null };
  state.rows = [[asset], [], []];
  const download = vi.fn().mockRejectedValueOnce(new TypeError("terminated", { cause: { code: "UND_ERR_SOCKET" } }))
    .mockResolvedValue({ data: new Blob([new Uint8Array(png)]), error: null });
  const storage = { storage: { from: () => ({ download }) } };
  expect(await fetchGenerationReferences(storage as never, "workspace")).toHaveLength(1);
  expect(download).toHaveBeenCalledTimes(2);
  state.rows = [[asset]];
  download.mockReset().mockResolvedValue({ data: null, error: { statusCode: "403" } });
  await expect(fetchGenerationReferences(storage as never, "workspace")).rejects.toThrow("could not be loaded");
  expect(download).toHaveBeenCalledTimes(1);
});


it("refuses an oversized saved reference set before design downloads instead of truncating", async () => {
  state.rows = [[], [], Array.from({ length: 17 }, (_, index) => ({ id: `reference-${index}`, kind: "reference", storagePath: `workspace/reference/${index}` }))];
  const download = vi.fn();
  const storage = { storage: { from: () => ({ download }) } };
  await expect(fetchGenerationReferences(storage as never, "workspace")).rejects.toThrow("Too many saved design references");
  expect(download).not.toHaveBeenCalled();
});
