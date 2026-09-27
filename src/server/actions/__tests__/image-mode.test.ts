import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  workspaceId: "00000000-0000-0000-0000-000000000001",
  userId: "00000000-0000-0000-0000-000000000002",
  saved: null as Record<string, unknown> | null,
  row: null as Record<string, unknown> | null,
}));
vi.mock("@/lib/workspace", () => ({ getActiveContext: async () => ({ workspaceId: state.workspaceId, userId: state.userId }) }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: () => ({ allowed: true }) }));
vi.mock("@/db", () => ({ getDb: () => ({
  select: () => ({ from: () => ({ where: () => ({ limit: async () => state.row ? [state.row] : [] }) }) }),
  insert: () => ({ values: (value: Record<string, unknown>) => {
    state.saved = value;
    return { onConflictDoUpdate: async () => undefined };
  } }),
}) }));

import { getImageModePreferenceAction, saveImageModePreferenceAction } from "@/server/actions/image-mode";

beforeEach(() => { state.saved = null; state.row = null; });

describe("personal image mode preference", () => {
  it("defaults an existing member to API Mode", async () => {
    expect(await getImageModePreferenceAction()).toMatchObject({ ok: true, preference: { mode: "api", modelId: null } });
  });

  it("stores only the initiating member's mode and model, with no credentials", async () => {
    expect(await saveImageModePreferenceAction({ mode: "local_companion", modelId: "  image/my-model  " })).toEqual({ ok: true });
    expect(state.saved).toMatchObject({ workspaceId: state.workspaceId, userId: state.userId,
      mode: "local_companion", modelId: "image/my-model" });
    expect(Object.keys(state.saved ?? {})).not.toContain("accessTokenEnc");
  });

  it("allows the local gateway to select its image model automatically", async () => {
    expect(await saveImageModePreferenceAction({ mode: "local_companion", modelId: null })).toEqual({ ok: true });
    expect(state.saved).toMatchObject({ mode: "local_companion", modelId: null });
  });

  it("clears a local model when switching back to API Mode", async () => {
    expect(await saveImageModePreferenceAction({ mode: "api", modelId: "image/my-model" })).toEqual({ ok: true });
    expect(state.saved).toMatchObject({ mode: "api", modelId: null });
  });

  it("rejects invalid local models without a database write", async () => {
    expect((await saveImageModePreferenceAction({ mode: "local_companion", modelId: "\n" })).ok).toBe(false);
    expect(state.saved).toBeNull();
  });
});
