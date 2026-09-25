/**
 * Node.js-only instrumentation runner.
 * Isolating Node imports here ensures Webpack Edge runtime doesn't trace or bundle
 * native Node packages (sharp, resvg, pg, pg-boss) into edge/client bundles.
 */
type NodeBootGlobal = typeof globalThis & {
  __qurtizNodeBootStarted?: boolean;
  __qurtizSchedulerReady?: boolean;
  __qurtizSchedulerStarting?: boolean;
  __qurtizSchedulerRetry?: ReturnType<typeof setTimeout>;
};

export function registerNode(): void {
  // Explicit read-only/UI validation mode: no workers or startup migrations.
  if (process.env.DISABLE_BACKGROUND_WORKER === "true") return;
  const g = globalThis as NodeBootGlobal;
  if (g.__qurtizNodeBootStarted) return;
  g.__qurtizNodeBootStarted = true;
  // Instrumentation must return before opening the remote database. Next.js
  // may await register() before serving a page, especially during dev/HMR.
  void startSchedulerWithRetry(g, 0).finally(() => { void runBootMaintenance(); });
}

async function startSchedulerWithRetry(g: NodeBootGlobal, attempt: number): Promise<void> {
  if (g.__qurtizSchedulerReady || g.__qurtizSchedulerStarting) return;
  g.__qurtizSchedulerStarting = true;
  // In dedicated worker environments or local dev, initialize pg-boss and cron schedules.
  // In serverless platforms (Vercel), we do NOT initialize persistent polling daemons in request lambdas
  // to avoid exhausting Supabase session pooler connections across concurrent lambdas.
  const isServerless = Boolean(process.env.VERCEL) && process.env.ENABLE_BACKGROUND_WORKER !== "true";

  if (!isServerless) {
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
      // Media cleanup: hourly. Soft-deletes + abandoned uploads + workspace
      // deletes purge Storage + DB rows on this cadence (or every minute
      // during dev). Lower than every-minute to avoid wasted ticks on
      // empty queues; grace windows are 1h+ for everything except abandoned
      // uploads (which are still acceptable at 1h lag).
      await boss.schedule(QUEUES.mediaCleanup, "0 * * * *");
      g.__qurtizSchedulerReady = true;
      console.log(`[qurtiz] background scheduler started (pid ${process.pid})`);
    } catch (e) {
      // A failure after some handlers were registered must not cause the next
      // attempt to attach duplicate handlers to that same PgBoss instance.
      try {
        const { resetBossAfterStartupFailure } = await import("@/lib/jobs/boss");
        await resetBossAfterStartupFailure();
      } catch { /* Preserve the original startup error below. */ }
      const message = e instanceof Error ? e.message : String(e);
      const code = typeof e === "object" && e !== null && "code" in e ? String(e.code) : "";
      const delay = Math.min(60_000, 5_000 * 2 ** Math.min(attempt, 4));
      console.error(`[qurtiz] scheduler init failed (pid ${process.pid}${code ? `, ${code}` : ""}): ${message}; retrying in ${delay}ms`);
      g.__qurtizSchedulerRetry = setTimeout(() => {
        g.__qurtizSchedulerRetry = undefined;
        void startSchedulerWithRetry(g, attempt + 1);
      }, delay);
      g.__qurtizSchedulerRetry.unref?.();
    }
  } else {
    if (!process.env.CRON_SECRET) {
      console.error("[qurtiz] Scheduled publishing is unavailable: configure CRON_SECRET and deploy vercel.json cron jobs, or run a persistent worker.");
    }
    g.__qurtizSchedulerReady = true;
  }
  g.__qurtizSchedulerStarting = false;
}

async function runBootMaintenance(): Promise<void> {
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
