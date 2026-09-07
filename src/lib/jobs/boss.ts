import "server-only";

import { PgBoss } from "pg-boss";

/**
 * pg-boss singleton on the same Postgres. Started from instrumentation.ts
 * when the server boots; guarded against HMR double-starts.
 */
type BossGlobal = typeof globalThis & { __qurtizBoss?: PgBoss };
const g = globalThis as BossGlobal;

export const QUEUES = {
  publishScan: "publish-due-scan",
  bulkGenerate: "bulk-generate",
  campaignGenerate: "campaign-generate",
  syncInsights: "sync-insights",
  autopilotLoop: "autopilot-loop",
  chatRunSweep: "chat-run-sweep",
} as const;

export async function getBoss(): Promise<PgBoss> {
  if (g.__qurtizBoss) return g.__qurtizBoss;
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured — job queue unavailable.");
  }
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    max: 2,
  });
  boss.on("error", (e: Error) => console.error("[pg-boss]", e.message));
  await boss.start();
  // Ensure every queue exists before anything sends to it. createQueue is
  // idempotent, and this decouples queue availability from worker startup.
  for (const name of Object.values(QUEUES)) {
    await boss.createQueue(name);
  }
  g.__qurtizBoss = boss;
  return boss;
}



