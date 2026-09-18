import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ begin: vi.fn(), complete: vi.fn(), upload: vi.fn(), client: vi.fn() }));
vi.mock("@/server/actions/media-upload", () => ({ beginMediaUploadAction: mocks.begin, completeMediaUploadAction: mocks.complete }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.client }));
import { uploadStudioMedia } from "../client-upload";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.begin.mockResolvedValue({ ok: true, ticket: "authorized", path: "workspace/video", token: "scoped" });
  mocks.client.mockReturnValue({ storage: { from: () => ({ uploadToSignedUrl: mocks.upload }) } });
  mocks.upload.mockResolvedValue({ error: null });
});
describe("studio signed uploads", () => {
  it("authorizes a mixed-format item's upload against the selected platform variant", async () => {
    const file=new File(["video"],"reel.mov",{type:"video/quicktime"});mocks.complete.mockResolvedValue({ok:true,id:"saved"});
    await uploadStudioMedia("item",file,undefined,"reel-variant");
    expect(mocks.begin).toHaveBeenCalledWith(expect.objectContaining({itemId:"item",variantId:"reel-variant",mime:"video/quicktime"}));
  });
  it("retries finalization on the same stored object rather than uploading a duplicate", async () => {
    const file = new File(["video"], "reel.mov", { type: "video/quicktime" });
    mocks.complete.mockResolvedValueOnce({ ok: false, error: "Database temporarily unavailable" }).mockResolvedValueOnce({ ok: true, id: "visual", mimeType: file.type });
    expect((await uploadStudioMedia("item", file)).ok).toBe(false);
    expect((await uploadStudioMedia("item", file)).ok).toBe(true);
    expect(mocks.begin).toHaveBeenCalledTimes(1);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.complete.mock.calls).toEqual([["authorized"], ["authorized"]]);
    expect(mocks.upload).toHaveBeenCalledWith("workspace/video", "scoped", file, { contentType: "video/quicktime" });
  });
  it("does not attach a failed storage upload", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "Upload rejected" } });
    expect(await uploadStudioMedia("item", new File(["image"], "a.png", { type: "image/png" }))).toEqual({ ok: false, error: "Upload rejected" });
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("keeps finalization retry available when its response is interrupted", async () => {
    const file = new File(["image"], "a.png", { type: "image/png" });
    mocks.complete.mockRejectedValueOnce(new Error("Disconnected")).mockResolvedValueOnce({ ok: true, id: "saved" });
    expect((await uploadStudioMedia("item", file)).ok).toBe(false);
    expect((await uploadStudioMedia("item", file)).ok).toBe(true);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
});
