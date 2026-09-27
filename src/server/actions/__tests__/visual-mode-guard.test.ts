import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ mode: "local_companion", generated: 0 }));
vi.mock("@/lib/workspace", () => ({ getActiveContext: async () => ({ workspaceId: "workspace", userId: "user" }) }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: () => ({ allowed: true }) }));
vi.mock("@/db", () => ({ getDb: () => ({ select: () => ({ from: () => ({ where: () => ({
  limit: async () => [{ mode: state.mode }],
}) }) }) }) }));
vi.mock("@/lib/visuals/generate", () => ({ generateVisual: async () => {
  state.generated += 1;
  return { ok: true, visualId: "visual", model: "api-model" };
} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { generateVisualAction } from "@/server/actions/visuals";

describe("personal image mode guards the paid server action", () => {
  it("rejects direct API generation while the member selected local mode", async () => {
    state.mode = "local_companion";
    state.generated = 0;
    expect(await generateVisualAction("item", "ai")).toMatchObject({ ok: false });
    expect(state.generated).toBe(0);
  });

  it("preserves the existing API path in API Mode", async () => {
    state.mode = "api";
    state.generated = 0;
    expect(await generateVisualAction("item", "ai")).toMatchObject({ ok: true, model: "api-model" });
    expect(state.generated).toBe(1);
  });
});
