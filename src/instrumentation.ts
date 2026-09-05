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
    // Autopilot: every-minute scan. Each enabled workspace runs at its own
    // configured local run times — the loop claims occurrences via
    // lastRunKey, so a per-minute firing is a cheap no-op elsewhere.
    // schedule() upserts the cron definition on every restart.
    await boss.schedule(QUEUES.autopilotLoop, "* * * * *");
    g.__qurtizSchedulerReady = true;
    console.log("[qurtiz] background scheduler started");
  } catch (e) {
    // Do not crash the server if the queue is unavailable (e.g. no DATABASE_URL yet).
    console.error("[qurtiz] scheduler init skipped:", e instanceof Error ? e.message : e);
  }

  // Server storage configuration check — visual publishing signs image URLs
  // through it. Exactly ONE status line, whatever the outcome; the key, the
  // URL's querystring and any header are never logged. Wrapped like the
  // scheduler above so a failure can never crash boot.
  try {
    const { getServerStorageConfigStatus } = await import("@/lib/supabase/storage-status");
    const status = await getServerStorageConfigStatus();
    if (!status.configured) {
      console.log("[qurtiz] Supabase server storage: Missing configuration");
    } else if (status.connected) {
      console.log("[qurtiz] Supabase server storage: Connected");
    } else {
      console.log(`[qurtiz] Supabase server storage: Unreachable (${status.error ?? "unknown error"})`);
    }
  } catch (e) {
    console.error("[qurtiz] storage check skipped:", e instanceof Error ? e.message : e);
  }
}
