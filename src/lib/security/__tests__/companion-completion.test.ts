import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ revoked: false, status: "uploading", duplicate: false, completed: false }));
const identity = { id: "device", workspaceId: "workspace", userId: "user", credentialHash: "hash", revokedAt: null };
const job = { id: "job", workspaceId: "workspace", userId: "user", deviceId: "device", status: "uploading", contentType: "post", contentItemId: "post", uploadPath: "workspace/visuals/post/job-raw", claimTokenHash: "claim", options: { uploadMimeType: "image/png", uploadSizeBytes: 100 }, leaseExpiresAt: new Date(Date.now() + 60000) };
vi.mock("@/lib/companion/job-claim", () => ({ authenticateJobClaim: async () => ({ device: identity, job }) }));
vi.mock("@/lib/security/media-file", () => ({ matchesMediaHeader: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/visuals/generate", () => ({ persistExternalVisual: vi.fn(async () => "visual") }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ storage: { from: () => ({ info: async () => ({ data: { size: 100, contentType: "image/png" } }), download: async () => ({ data: new Blob([new Uint8Array(100)]) }), remove: async () => ({}) }) } }) }));
vi.mock("@/db", () => ({ getDb: () => ({
  update: () => ({ set: () => ({ where: () => Object.assign(Promise.resolve(), { returning: async () => state.duplicate ? [] : [{ id: "job" }] }) }) }),
  transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    let reads = 0;
    const tx = { select: () => ({ from: () => ({ where: () => ({ for: async () => ++reads === 1 ? [{ ...identity, revokedAt: state.revoked ? new Date() : null }] : [{ ...job, status: state.status }] }) }) }),
      update: () => ({ set: (values: { status?: string }) => ({ where: async () => { state.completed = values.status === "completed"; } }) }) };
    return fn(tx);
  },
}) }));
import { POST } from "@/app/api/companion/jobs/[jobId]/complete/route";
import { persistExternalVisual } from "@/lib/visuals/generate";
beforeEach(() => { vi.clearAllMocks(); state.revoked = false; state.status = "uploading"; state.duplicate = false; state.completed = false; });
const complete = () => POST(new Request("https://qurtiz-ai.vercel.app/api/companion/jobs/job/complete", { method: "POST" }), { params: Promise.resolve({ jobId: "job" }) });
describe("completion versus device revocation", () => {
  it("refuses persistence when revocation wins after initial authentication", async () => {
    state.revoked = true;
    expect((await complete()).status).toBe(502); expect(persistExternalVisual).not.toHaveBeenCalled(); expect(state.completed).toBe(false);
  });
  it("refuses a job that was cancelled after initial authentication", async () => {
    state.status = "failed";
    expect((await complete()).status).toBe(502); expect(persistExternalVisual).not.toHaveBeenCalled();
  });
  it("persists a healthy claim using the same locked transaction", async () => {
    expect((await complete()).status).toBe(200); expect(persistExternalVisual).toHaveBeenCalledWith(expect.objectContaining({ db: expect.any(Object) })); expect(state.completed).toBe(true);
  });
  it("does not repeat an already consumed completion", async () => {
    state.duplicate = true;
    expect((await complete()).status).toBe(409); expect(persistExternalVisual).not.toHaveBeenCalled();
  });
});
