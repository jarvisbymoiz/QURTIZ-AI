import { afterEach, expect, it, vi } from "vitest";
const signIn = vi.hoisted(() => vi.fn()); const signOut = vi.hoisted(() => vi.fn(async () => ({})));
const factory = vi.hoisted(() => vi.fn(() => ({ auth: { signInWithPassword: signIn, signOut } })));
vi.mock("@supabase/supabase-js", () => ({ createClient: factory }));
import { verifyAccountPassword } from "../verify-password";
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
function setup() { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.test"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "dummy-publishable-key"); }
it("verifies the existing identity using a disposable session and local-only sign-out", async () => {
  setup(); signIn.mockResolvedValue({ data: { user: { id: "owner" }, session: {} }, error: null });
  expect(await verifyAccountPassword({ id: "owner", email: "owner@example.test" }, "test-password")).toBe(true);
  expect(factory).toHaveBeenCalledWith("https://example.test", "dummy-publishable-key", expect.objectContaining({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }));
  expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
});
it("rejects a different identity even if a provider returned a session", async () => {
  setup(); signIn.mockResolvedValue({ data: { user: { id: "different" }, session: {} }, error: null });
  expect(await verifyAccountPassword({ id: "owner", email: "owner@example.test" }, "test-password")).toBe(false);
});
it("rejects an incorrect password without altering the browser's session", async () => {
  setup(); signIn.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Invalid credentials" } });
  expect(await verifyAccountPassword({ id: "owner", email: "owner@example.test" }, "wrong")).toBe(false);
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
});
