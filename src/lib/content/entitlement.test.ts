import { describe, expect, it } from "vitest";
import { assertContentCreationAllowed, ContentQuotaExceededError, parseContentEntitlement, quotaWindow, readContentQuota } from "./entitlement";

const WORKSPACE_A = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_B = "22222222-2222-4222-8222-222222222222";

function fakeDb(config: unknown, counts: Record<string, number>) {
  let call = 0;
  const execute = async (query: { queryChunks: unknown[] }) => {
    call++;
    if (call % 2 === 1) return { rows: [{ entitlement: config, plan: "free" }] };
    const workspaceId = query.queryChunks.find(chunk => typeof chunk === "string" && chunk in counts) as string;
    return { rows: [{ used: counts[workspaceId] ?? 0 }] };
  };
  return execute as Parameters<typeof readContentQuota>[1];
}

describe("content-creation entitlement", () => {
  it("treats missing optional configuration and explicit null as unlimited, not zero", async () => {
    const missing = await assertContentCreationAllowed(WORKSPACE_A, fakeDb(null, { [WORKSPACE_A]: 99 }));
    expect(missing).toMatchObject({ limit: null, used: 99, remaining: null, source: "default_unlimited", plan: "free" });
    expect(parseContentEntitlement({ limit: null })).toMatchObject({ limit: null });
  });

  it("enforces an explicit limit and returns structured usage for the correct workspace", async () => {
    const execute = fakeDb({ limit: 2, period: "month" }, { [WORKSPACE_A]: 1, [WORKSPACE_B]: 2 });
    const available = await assertContentCreationAllowed(WORKSPACE_A, execute);
    expect(available).toMatchObject({ limit: 2, used: 1, remaining: 1, source: "workspace_settings" });
    await expect(assertContentCreationAllowed(WORKSPACE_B, execute)).rejects.toMatchObject({
      name: "ContentQuotaExceededError",
      quota: { limit: 2, used: 2, remaining: 0, source: "workspace_settings" },
    });
  });

  it("does not consume allowance for failed generation; only persisted posts count", async () => {
    const counts = { [WORKSPACE_A]: 0 };
    const execute = fakeDb({ limit: 2 }, counts);
    expect((await assertContentCreationAllowed(WORKSPACE_A, execute)).remaining).toBe(2);
    // A failed provider call inserts no content_items row.
    expect((await assertContentCreationAllowed(WORKSPACE_A, execute)).remaining).toBe(2);
    counts[WORKSPACE_A]++;
    expect((await assertContentCreationAllowed(WORKSPACE_A, execute)).remaining).toBe(1);
    counts[WORKSPACE_A]++;
    await expect(assertContentCreationAllowed(WORKSPACE_A, execute)).rejects.toBeInstanceOf(ContentQuotaExceededError);
  });

  it("uses UTC day/month boundaries and rejects malformed explicit limits", () => {
    expect(quotaWindow("month", new Date("2026-09-25T23:59:00Z"))).toMatchObject({ resetAt: "2026-10-01T00:00:00.000Z" });
    expect(quotaWindow("day", new Date("2026-09-25T23:59:00Z"))).toMatchObject({ resetAt: "2026-09-26T00:00:00.000Z" });
    expect(() => parseContentEntitlement({ limit: -1 })).toThrow();
  });
});
