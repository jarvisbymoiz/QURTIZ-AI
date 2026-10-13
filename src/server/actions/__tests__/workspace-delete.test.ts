import { beforeEach, describe, expect, it, vi } from "vitest";
const A = "11111111-1111-4111-8111-111111111111"; const B = "22222222-2222-4222-8222-222222222222";
const state = vi.hoisted(() => ({ role: "owner", passwordOk: true, active: "", remaining: [] as { id: string }[], cookieChanges: [] as string[] }));
vi.mock("@/lib/workspace", () => ({ WORKSPACE_COOKIE: "qurtiz_workspace", getSessionUser: async () => ({ id: "owner", email: "owner@example.test" }), getMembership: async () => ({ role: state.role }), getUserWorkspaces: async () => state.remaining }));
vi.mock("@/lib/supabase/verify-password", () => ({ verifyAccountPassword: vi.fn(async () => state.passwordOk) }));
vi.mock("@/lib/workspace-deletion", () => ({ queueWorkspaceDeletion: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: () => ({ allowed: true }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.active }), set: (key: string, value: string) => { if (key === "qurtiz_workspace") { state.active = value; state.cookieChanges.push(value); } }, delete: (key: string) => { if (key === "qurtiz_workspace") { state.active = ""; state.cookieChanges.push("cleared"); } } }) }));
import { deleteWorkspaceAction } from "../workspace-delete";
import { queueWorkspaceDeletion } from "@/lib/workspace-deletion";
import { verifyAccountPassword } from "@/lib/supabase/verify-password";
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "dummy-key"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.test"); state.role = "owner"; state.passwordOk = true; state.active = A; state.remaining = [{ id: B }]; state.cookieChanges = []; });
describe("password-only selected workspace deletion", () => {
  it("queues only the selected ID and switches to a remaining workspace without sign-out", async () => {
    expect(await deleteWorkspaceAction({ workspaceId: A, password: "test-password" })).toEqual({ ok: true, nextPath: "/dashboard", cleanupQueued: true });
    expect(queueWorkspaceDeletion).toHaveBeenCalledExactlyOnceWith({ workspaceId: A, userId: "owner" }); expect(state.active).toBe(B);
  });
  it("does not switch another active workspace when the selected deletion is from an old tab", async () => {
    state.active = B;
    expect((await deleteWorkspaceAction({ workspaceId: A, password: "test-password" })).ok).toBe(true);
    expect(state.active).toBe(B); expect(state.cookieChanges).toHaveLength(0);
  });
  it("routes the last-workspace owner to onboarding while retaining the account", async () => {
    state.remaining = [];
    expect(await deleteWorkspaceAction({ workspaceId: A, password: "test-password" })).toMatchObject({ ok: true, nextPath: "/onboarding" }); expect(state.active).toBe("");
  });
  it("does not queue anything with a wrong password", async () => {
    state.passwordOk = false;
    expect(await deleteWorkspaceAction({ workspaceId: A, password: "wrong" })).toMatchObject({ ok: false }); expect(queueWorkspaceDeletion).not.toHaveBeenCalled(); expect(state.active).toBe(A);
  });
  it.each(["admin", "editor", "viewer"])("rejects %s before password verification", async role => {
    state.role = role;
    expect((await deleteWorkspaceAction({ workspaceId: A, password: "test-password" })).ok).toBe(false); expect(verifyAccountPassword).not.toHaveBeenCalled(); expect(queueWorkspaceDeletion).not.toHaveBeenCalled();
  });
  it("rejects a malformed workspace ID", async () => {
    expect((await deleteWorkspaceAction({ workspaceId: "../other", password: "test-password" })).ok).toBe(false); expect(queueWorkspaceDeletion).not.toHaveBeenCalled();
  });
});
