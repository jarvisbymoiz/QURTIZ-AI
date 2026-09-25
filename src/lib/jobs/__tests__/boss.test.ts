import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ constructions: 0, starts: 0, options: null as Record<string, unknown> | null }));
vi.mock("pg-boss", () => ({
  PgBoss: class {
    constructor(options: Record<string, unknown>) { state.constructions++; state.options = options; }
    on() { return this; }
    async start() { state.starts++; return this; }
    async createQueue() { return undefined; }
    async stop() { return undefined; }
  },
}));

import { getBoss, resetBossAfterStartupFailure } from "@/lib/jobs/boss";

beforeEach(() => {
  state.constructions = 0;
  state.starts = 0;
  state.options = null;
  vi.stubEnv("DATABASE_URL", "postgresql://user:password@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres");
});
afterEach(async () => { await resetBossAfterStartupFailure(); vi.unstubAllEnvs(); });

describe("pg-boss Node singleton", () => {
  it("shares one startup across concurrent callers and uses the working SSL/timeout settings", async () => {
    const [first, second] = await Promise.all([getBoss(), getBoss()]);
    expect(first).toBe(second);
    expect(state.constructions).toBe(1);
    expect(state.starts).toBe(1);
    expect(state.options).toMatchObject({ connectionTimeoutMillis: 30_000, max: 2, ssl: { rejectUnauthorized: false } });
  });

  it("does not initialize in the Edge runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await expect(getBoss()).rejects.toThrow(/Node.js runtime/);
    expect(state.constructions).toBe(0);
  });
});
