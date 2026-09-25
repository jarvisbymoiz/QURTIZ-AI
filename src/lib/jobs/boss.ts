import "server-only";

import { PgBoss } from "pg-boss";

/**
 * pg-boss singleton on the same Postgres. Started from instrumentation.ts
 * when the server boots; guarded against HMR double-starts.
 */
type BossGlobal = typeof globalThis & { __qurtizBoss?: PgBoss; __qurtizBossStarting?: Promise<PgBoss> };
const g = globalThis as BossGlobal;

export const QUEUES = {
  publishScan: "publish-due-scan",
  bulkGenerate: "bulk-generate",
  campaignGenerate: "campaign-generate",
  syncInsights: "sync-insights",
  autopilotLoop: "autopilot-loop",
  autopilotRun: "autopilot-run",
  chatRunSweep: "chat-run-sweep",
  mediaCleanup: "media-cleanup",
} as const;

export async function getBoss(): Promise<PgBoss> {
  if (process.env.NEXT_RUNTIME === "edge") throw new Error("pg-boss requires the Node.js runtime.");
  if (g.__qurtizBoss) return g.__qurtizBoss;
  if (!g.__qurtizBossStarting) {
    g.__qurtizBossStarting = startBoss().finally(() => { g.__qurtizBossStarting = undefined; });
  }
  return g.__qurtizBossStarting;
}

/** Discard a partly initialized worker before retrying registration. */
export async function resetBossAfterStartupFailure(): Promise<void> {
  const boss = g.__qurtizBoss;
  g.__qurtizBoss = undefined;
  if (boss) await boss.stop({ graceful: false, timeout: 5_000 }).catch(() => undefined);
}

async function startBoss(): Promise<PgBoss> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured — job queue unavailable.");
  }
  const connectionString = process.env.DATABASE_URL;
  const isLocal = /(?:localhost|127\.0\.0\.1|\[::1\])/.test(new URL(connectionString).hostname);
  const boss = new PgBoss({
    connectionString,
    // Match the application's working pg pool. Supabase's session pooler
    // needs TLS, and its cold connection can exceed pg-boss's 10s default.
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000,
    max: 2,
  });
  boss.on("error", (e: Error) => console.error("[pg-boss]", e.message));
  try {
  await boss.start();
  // Ensure every queue exists before anything sends to it. createQueue is
  // idempotent, and this decouples queue availability from worker startup.
  for (const name of Object.values(QUEUES)) {
    await boss.createQueue(name);
  }
  g.__qurtizBoss = boss;
  console.log(`[pg-boss] instance started (pid ${process.pid})`);
  return boss;
  } catch (error) {
    await boss.stop().catch(() => undefined);
    throw error;
  }
}
