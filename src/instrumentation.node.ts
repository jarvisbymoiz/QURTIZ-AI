/**
 * Node.js-only instrumentation runner.
 * Isolating Node imports here ensures Webpack Edge runtime doesn't trace or bundle
 * native Node packages (sharp, resvg, pg, pg-boss) into edge/client bundles.
 */
export async function registerNode() {
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
    // Autopilot: every-minute scan.
    await boss.schedule(QUEUES.autopilotLoop, "* * * * *");
    // Chat run sweep: every minute, recover stuck chat-kind runs
    await boss.schedule(QUEUES.chatRunSweep, "* * * * *");
    // Boot sweep: recover interrupted runs
    try {
      const { failInterruptedChatRuns } = await import("@/lib/ai/chat-persistence");
      const recovered = await failInterruptedChatRuns();
      if (recovered > 0) {
        console.log(`[qurtiz] boot sweep recovered ${recovered} interrupted chat run(s)`);
      }
    } catch (e) {
      console.error("[qurtiz] boot sweep skipped:", e instanceof Error ? e.message : e);
    }
    g.__qurtizSchedulerReady = true;
    console.log("[qurtiz] background scheduler started");
  } catch (e) {
    // Do not crash the server if the queue is unavailable (e.g. no DATABASE_URL yet).
    console.error("[qurtiz] scheduler init skipped:", e instanceof Error ? e.message : e);
  }

  // Server storage configuration check
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

  // Legacy credential migration
  try {
    const { migrateLegacyEncryptedCredentials } = await import("@/lib/crypto/key-migration");
    await migrateLegacyEncryptedCredentials();
  } catch (e) {
    console.error(
      "[qurtiz] encryption: legacy migration failed:",
      e instanceof Error ? e.message : e,
    );
  }
}
