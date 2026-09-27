import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  preference: { mode: "local_companion", modelId: "legacy-model-is-ignored" },
  jobAvailable: true,
  whereSql: "",
  inserted: null as Record<string, unknown> | null,
  persisted: 0,
}));

vi.mock("@/lib/workspace", () => ({ getActiveContext: async () => ({
  workspaceId: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
}) }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: () => ({ allowed: true }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/visuals/generate", () => ({
  prepareExternalVisual: async () => ({ brief: { prompt: "Saved visual prompt", width: 1080, height: 1350 }, references: [] }),
  persistExternalVisual: async () => { state.persisted += 1; return "visual-1"; },
}));
vi.mock("@/db", () => ({ getDb: () => ({
  select: () => ({ from: () => ({ where: () => ({ limit: async () => [state.preference] }) }) }),
  insert: () => ({ values: (value: Record<string, unknown>) => {
    state.inserted = value;
    return { returning: async () => [{ id: "00000000-0000-4000-8000-000000000003" }] };
  } }),
  update: () => ({ set: () => ({ where: (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => {
    state.whereSql = new PgDialect().sqlToQuery(condition).sql;
    return { returning: async () => {
      if (!state.jobAvailable) return [];
      state.jobAvailable = false;
      return [{ id: "00000000-0000-4000-8000-000000000003",
        input: { contentItemId: "00000000-0000-4000-8000-000000000004", modelId: null } }];
    } };
  } }) }),
}) }));

import { completeLocalVisualAction, prepareLocalVisualAction } from "@/server/actions/local-visual";

beforeEach(() => {
  state.preference = { mode: "local_companion", modelId: "legacy-model-is-ignored" };
  state.jobAvailable = true; state.whereSql = ""; state.inserted = null; state.persisted = 0;
});

describe("local visual one-use job", () => {
  it("does not create a job while API Mode is selected", async () => {
    state.preference.mode = "api";
    const result = await prepareLocalVisualAction({ contentItemId: "00000000-0000-4000-8000-000000000004" });
    expect(result.ok).toBe(false);
    expect(state.inserted).toBeNull();
  });

  it("stores only the scoped item and selected model, not local credentials", async () => {
    const result = await prepareLocalVisualAction({ contentItemId: "00000000-0000-4000-8000-000000000004" });
    expect(result).toMatchObject({ ok: true, modelId: null, prompt: "Saved visual prompt" });
    expect(state.inserted).toMatchObject({ type: "local_image", input: {
      contentItemId: "00000000-0000-4000-8000-000000000004", modelId: null,
    } });
    expect(JSON.stringify(state.inserted)).not.toMatch(/pairing|accessToken|refreshToken/);
  });

  it("claims a job once under user, workspace, status and expiry constraints", async () => {
    const input = { jobId: "00000000-0000-4000-8000-000000000003", imageBase64: "a".repeat(128) };
    expect(await completeLocalVisualAction(input)).toMatchObject({ ok: true, visualId: "visual-1" });
    expect(state.persisted).toBe(1);
    expect(await completeLocalVisualAction(input)).toMatchObject({ ok: false });
    expect(state.persisted).toBe(1);
    expect(state.whereSql).toContain("user_id");
    expect(state.whereSql).toContain("workspace_id");
    expect(state.whereSql).toContain("status");
    expect(state.whereSql).toContain("created_at");
  });
});
