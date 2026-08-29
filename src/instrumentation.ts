/**
 * Runs once when the Next.js server process starts.
 * Boots the pg-boss queue and registers background workers.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as typeof globalThis & { __qurtizSchedulerReady?: boolean };
  if (g.__qurtizSchedulerReady) return;
  try {
    const { getBoss, QUEUES } = await import("@/lib/jobs/boss");
    const { registerWorkers } = await import("@/lib/jobs/workflows");
    const boss = await getBoss();
    await registerWorkers(boss);
    // Scan for due publishing jobs every minute.
    await boss.schedule(QUEUES.publishScan, "* * * * *");
    await boss.schedule(QUEUES.syncInsights, "0 */4 * * *"); // every 4 hours
    await boss.schedule(QUEUES.autopilotLoop, "0 9 * * *"); // daily 09:00 UTC
    g.__qurtizSchedulerReady = true;
    console.log("[qurtiz] background scheduler started");
  } catch (e) {
    // Do not crash the server if the queue is unavailable (e.g. no DATABASE_URL yet).
    console.error("[qurtiz] scheduler init skipped:", e instanceof Error ? e.message : e);
  }
}
