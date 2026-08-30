module.exports = [
"[externals]/node:events [external] (node:events, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:events", () => require("node:events"));

module.exports = mod;
}),
"[externals]/node:assert [external] (node:assert, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:assert", () => require("node:assert"));

module.exports = mod;
}),
"[externals]/node:timers/promises [external] (node:timers/promises, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:timers/promises", () => require("node:timers/promises"));

module.exports = mod;
}),
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[externals]/fs/promises [external] (fs/promises, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs/promises", () => require("fs/promises"));

module.exports = mod;
}),
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/pg [external] (pg, esm_import)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

const mod = await __turbopack_context__.y("pg");

__turbopack_context__.n(mod);
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, true);}),
"[project]/Documents/QURTIZ AI/src/lib/jobs/boss.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "QUEUES",
    ()=>QUEUES,
    "getBoss",
    ()=>getBoss
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/server-only/empty.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/index.js [instrumentation] (ecmascript) <locals>");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
const g = globalThis;
const QUEUES = {
    publishScan: "publish-due-scan",
    bulkGenerate: "bulk-generate",
    campaignGenerate: "campaign-generate",
    syncInsights: "sync-insights",
    autopilotLoop: "autopilot-loop"
};
async function getBoss() {
    if (g.__qurtizBoss) return g.__qurtizBoss;
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not configured — job queue unavailable.");
    }
    const boss = new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__["PgBoss"]({
        connectionString: process.env.DATABASE_URL,
        max: 2
    });
    boss.on("error", (e)=>console.error("[pg-boss]", e.message));
    await boss.start();
    // Ensure every queue exists before anything sends to it. createQueue is
    // idempotent, and this decouples queue availability from worker startup.
    for (const name of Object.values(QUEUES)){
        await boss.createQueue(name);
    }
    g.__qurtizBoss = boss;
    return boss;
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__a6d37eec._.js.map