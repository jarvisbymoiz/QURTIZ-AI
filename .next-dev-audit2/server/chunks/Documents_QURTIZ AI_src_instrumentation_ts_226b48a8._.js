module.exports = [
"[project]/Documents/QURTIZ AI/src/instrumentation.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Runs once when the Next.js server process starts.
 * Boots the pg-boss queue and registers background workers.
 */ __turbopack_context__.s([
    "register",
    ()=>register
]);
async function register() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const g = globalThis;
    if (g.__qurtizSchedulerReady) return;
    try {
        const { getBoss, QUEUES } = await __turbopack_context__.A("[project]/Documents/QURTIZ AI/src/lib/jobs/boss.ts [instrumentation] (ecmascript, async loader)");
        const { registerWorkers } = await __turbopack_context__.A("[project]/Documents/QURTIZ AI/src/lib/jobs/workflows.ts [instrumentation] (ecmascript, async loader)");
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
}),
];

//# sourceMappingURL=Documents_QURTIZ%20AI_src_instrumentation_ts_226b48a8._.js.map