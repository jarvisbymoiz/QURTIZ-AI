import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { createHash } from "node:crypto";

const state = vi.hoisted(() => ({ whereSql: "", job: null as Record<string, unknown> | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/companion/device-auth", () => ({ authenticateCompanion: async () => ({
  id: "00000000-0000-4000-8000-000000000001",
  workspaceId: "00000000-0000-4000-8000-000000000002",
  userId: "00000000-0000-4000-8000-000000000003",
}) }));
vi.mock("@/db", () => ({ getDb: () => ({ select: () => ({ from: () => ({
  where: (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => {
    state.whereSql = new PgDialect().sqlToQuery(condition).sql;
    return { limit: async () => state.job ? [state.job] : [] };
  },
}) }) }) }));

import { authenticateJobClaim } from "@/lib/companion/job-claim";

beforeEach(() => {
  state.whereSql = "";
  const secret = "s".repeat(43);
  state.job = { id: "00000000-0000-4000-8000-000000000004", status: "generating",
    claimTokenHash: createHash("sha256").update(`qurtiz-claim-v1:${secret}`).digest("hex") };
});

describe("cloud image claim authorization", () => {
  it("binds a claim to job, workspace, user, device and unexpired lease", async () => {
    const request = new Request("https://qurtiz-ai.vercel.app/api/companion/jobs/x", {
      headers: { "x-qurtiz-claim": "s".repeat(43) },
    });
    expect((await authenticateJobClaim(request, state.job!.id as string))?.job.id).toBe(state.job!.id);
    for (const column of ["id", "workspace_id", "user_id", "device_id", "lease_expires_at"]) {
      expect(state.whereSql).toContain(column);
    }
  });

  it("rejects a replayed or incorrect one-use claim token", async () => {
    const request = new Request("https://qurtiz-ai.vercel.app/api/companion/jobs/x", {
      headers: { "x-qurtiz-claim": "x".repeat(43) },
    });
    expect(await authenticateJobClaim(request, state.job!.id as string)).toBeNull();
    state.job!.claimTokenHash = null;
    expect(await authenticateJobClaim(new Request("https://qurtiz-ai.vercel.app/api/companion/jobs/x", {
      headers: { "x-qurtiz-claim": "s".repeat(43) },
    }), state.job!.id as string)).toBeNull();
  });
});
