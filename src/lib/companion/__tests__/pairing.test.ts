import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ consumed: false, challenge: null as Record<string, unknown> | null,
  device: null as Record<string, unknown> | null, authDevice: null as Record<string, unknown> | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getDb: () => ({
  select: () => ({ from: () => ({ where: () => ({ limit: async () =>
    state.authDevice ? [state.authDevice] : [] }) }) }),
  transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
    select: () => ({ from: () => ({ where: () => ({ for: () => ({ limit: async () =>
      state.challenge && !state.consumed ? [state.challenge] : [] }) }) }) }),
    update: () => ({ set: () => ({ where: async () => { state.consumed = true; } }) }),
    insert: () => ({ values: async (value: Record<string, unknown>) => { state.device = value; } }),
  }),
}) }));

import { POST } from "@/app/api/companion/pair/route";
import { authenticateCompanion, hashCompanionSecret } from "@/lib/companion/device-auth";

beforeEach(() => { state.consumed = false; state.device = null; state.authDevice = null;
  state.challenge = { id: "00000000-0000-4000-8000-000000000001",
    workspaceId: "00000000-0000-4000-8000-000000000002",
    userId: "00000000-0000-4000-8000-000000000003" }; });

describe("one-use cloud companion pairing", () => {
  it("rejects malformed or oversized challenges before database access", async () => {
    const response = await POST(new Request("https://qurtiz-ai.vercel.app/api/companion/pair", {
      method: "POST", body: JSON.stringify({ challenge: "short", displayName: "PC",
        userId: state.challenge?.userId, workspaceId: state.challenge?.workspaceId }),
    }));
    expect(response.status).toBe(400);
    expect(state.device).toBeNull();
  });

  it("redeems only once and stores a credential hash rather than the credential", async () => {
    const request = () => new Request("https://qurtiz-ai.vercel.app/api/companion/pair", {
      method: "POST", body: JSON.stringify({ challenge: "a".repeat(43), displayName: "DESKTOP-IRONMAN",
        userId: state.challenge?.userId, workspaceId: state.challenge?.workspaceId }),
    });
    const first = await POST(request());
    expect(first.status).toBe(200);
    const body = await first.json();
    expect(body.credential).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    expect(state.device).toMatchObject({ workspaceId: state.challenge?.workspaceId,
      userId: state.challenge?.userId, displayName: "DESKTOP-IRONMAN" });
    expect(state.device?.credentialHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(state.device)).not.toContain(body.credential);
    expect((await POST(request())).status).toBe(410);
  });

  it("refuses to bind a challenge to a different workspace owner", async () => {
    const response = await POST(new Request("https://qurtiz-ai.vercel.app/api/companion/pair", {
      method: "POST", body: JSON.stringify({ challenge: "a".repeat(43), displayName: "PC",
        userId: state.challenge?.userId, workspaceId: "00000000-0000-4000-8000-000000000099" }),
    }));
    expect(response.status).toBe(410);
    expect(state.device).toBeNull();
    expect(state.consumed).toBe(false);
  });

  it("rejects a revoked device or a mismatched device secret", async () => {
    const id = "00000000-0000-4000-8000-000000000004";
    const secret = "a".repeat(43);
    state.authDevice = { id, workspaceId: state.challenge?.workspaceId,
      userId: state.challenge?.userId, credentialHash: hashCompanionSecret(secret), revokedAt: null };
    const request = (value: string) => new Request("https://qurtiz-ai.vercel.app/api/companion/self", {
      headers: { Authorization: `Bearer ${id}.${value}` },
    });
    expect((await authenticateCompanion(request(secret)))?.id).toBe(id);
    expect(await authenticateCompanion(request("b".repeat(43)))).toBeNull();
    state.authDevice.revokedAt = new Date();
    expect(await authenticateCompanion(request(secret))).toBeNull();
  });
});
