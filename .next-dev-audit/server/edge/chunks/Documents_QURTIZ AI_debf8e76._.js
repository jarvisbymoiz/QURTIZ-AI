(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["chunks/Documents_QURTIZ AI_debf8e76._.js",
"[project]/Documents/QURTIZ AI/src/instrumentation.ts [instrumentation-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Runs once when the Next.js server process starts.
 * Boots the pg-boss queue and registers background workers.
 */ __turbopack_context__.s([
    "register",
    ()=>register
]);
async function register() {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
    const g = undefined;
}
}),
"[project]/Documents/QURTIZ AI/edge-wrapper.js { MODULE => \"[project]/Documents/QURTIZ AI/src/instrumentation.ts [instrumentation-edge] (ecmascript)\" } [instrumentation-edge] (ecmascript)", ((__turbopack_context__, module, exports) => {

self._ENTRIES ||= {};
const modProm = Promise.resolve().then(()=>__turbopack_context__.i("[project]/Documents/QURTIZ AI/src/instrumentation.ts [instrumentation-edge] (ecmascript)"));
modProm.catch(()=>{});
self._ENTRIES["middleware_instrumentation"] = new Proxy(modProm, {
    get (modProm, name) {
        if (name === "then") {
            return (res, rej)=>modProm.then(res, rej);
        }
        let result = (...args)=>modProm.then((mod)=>(0, mod[name])(...args));
        result.then = (res, rej)=>modProm.then((mod)=>mod[name]).then(res, rej);
        return result;
    }
});
}),
]);

//# sourceMappingURL=Documents_QURTIZ%20AI_debf8e76._.js.map