module.exports = [
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/tools.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "delay",
    ()=>delay,
    "normalizeSchemaName",
    ()=>normalizeSchemaName,
    "resolveSchemaName",
    ()=>resolveSchemaName,
    "resolveWithinSeconds",
    ()=>resolveWithinSeconds,
    "unwrapSQLResult",
    ()=>unwrapSQLResult
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$timers$2f$promises__$5b$external$5d$__$28$node$3a$timers$2f$promises$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:timers/promises [external] (node:timers/promises, cjs)");
;
/**
 * When sql contains multiple queries, result is an array of objects with rows property
 * This function unwraps the result into a single object with rows property
 *
 * Some drivers (postgres.js, and therefore drizzle-orm/postgres-js) instead return the rows
 * themselves as a flat array. Those elements have no `rows` property, so treat the array
 * as the row set rather than flat-mapping undefined into it.
*/ function unwrapSQLResult(result) {
    if (Array.isArray(result)) {
        return result.every((i)=>Array.isArray(i?.rows)) ? {
            rows: result.flatMap((i)=>i.rows)
        } : {
            rows: result
        };
    }
    return result;
}
function delay(ms, error, abortController) {
    const ac = abortController || new AbortController();
    const promise = new Promise((resolve, reject)=>{
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$timers$2f$promises__$5b$external$5d$__$28$node$3a$timers$2f$promises$2c$__cjs$29$__["setTimeout"])(ms, null, {
            signal: ac.signal
        }).then(()=>{
            if (error) {
                reject(new Error(error));
            } else {
                resolve();
            }
        }).catch(resolve);
    });
    promise.abort = ()=>{
        if (!ac.signal.aborted) {
            ac.abort();
        }
    };
    return promise;
}
async function resolveWithinSeconds(promise, seconds, message, abortController) {
    const timeout = Math.max(1, seconds) * 1000;
    const reject = delay(timeout, message, abortController);
    let result;
    try {
        result = await Promise.race([
            promise,
            reject
        ]);
    } finally{
        reject.abort();
    }
    return result;
}
// a quoted name whose contents are already a legal bare identifier *and* already lower case, so
// postgres would resolve the two spellings to the same schema.
const REDUNDANTLY_QUOTED_SCHEMA_REGEX = /^"[a-z_][a-z0-9_]*"$/;
const isQuoted = (schema)=>schema.startsWith('"') && schema.endsWith('"') && schema.length > 1;
/**
 * Resolves a configured schema string to the name postgres actually stores in the catalog.
 *
 * the `schema` option is interpolated verbatim into identifier positions, so a caller may quote it
 * to reach names that are not legal bare identifiers, e.g. `'"My-Schema"'`. The catalog holds the
 * *resolved* name, so any comparison against `pg_namespace.nspname` (and anything else reading a
 * name back out of postgres) needs this rather than the raw config value.
 *
 * A quoted name resolves to its contents verbatim; a bare one is folded to lower case, as postgres
 * does on the way in. So `"MySchema"` and `MySchema` are different schemas, the latter stored as
 * `myschema`.
 *
 * Do NOT use this to derive the notify channel or the advisory lock - see normalizeSchemaName.
 */ function resolveSchemaName(schema) {
    return isQuoted(schema) ? schema.slice(1, -1) : schema.toLowerCase();
}
/**
 * Canonicalizes a configured schema string for the values pg-boss *derives* from it rather than
 * looks up: the notify channel name and the advisory lock key.
 *
 * Those are hashes of a string, never compared against the catalog - the channel literal is
 * generated from the same expression for both LISTEN and NOTIFY, and the advisory key is opaque to
 * postgres. So the only requirement is that every instance pointed at the same physical schema
 * agrees, which means the *sole* transform needed is collapsing quoting that carries no meaning:
 * `'"pgboss"'` and `'pgboss'` are one schema and must not end up on separate channels.
 *
 * Deliberately NOT resolveSchemaName. Folding a bare `MySchema` to `myschema` would also be
 * "correct", but it changes the channel and lock key for a name that has always been legal, so a
 * rolling upgrade would leave old and new instances failing to coordinate. Leaving bare names
 * untouched keeps the derived values byte-identical to every prior release.
 */ function normalizeSchemaName(schema) {
    return REDUNDANTLY_QUOTED_SCHEMA_REGEX.test(schema) ? schema.slice(1, -1) : schema;
}
;
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/drifter.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "computeColumnDrift",
    ()=>computeColumnDrift,
    "computeConstraintDrift",
    ()=>computeConstraintDrift,
    "computeSchemaDrift",
    ()=>computeSchemaDrift,
    "displayIndexDefinition",
    ()=>displayIndexDefinition,
    "extractFunctionBody",
    ()=>extractFunctionBody,
    "functionName",
    ()=>functionName,
    "getEnumDefinition",
    ()=>getEnumDefinition,
    "getSchemaColumns",
    ()=>getSchemaColumns,
    "getSchemaConstraints",
    ()=>getSchemaConstraints,
    "getSchemaFunctions",
    ()=>getSchemaFunctions,
    "getSchemaIndexes",
    ()=>getSchemaIndexes,
    "getSchemaTables",
    ()=>getSchemaTables,
    "indexInclude",
    ()=>indexInclude,
    "indexIncludeRaw",
    ()=>indexIncludeRaw,
    "indexKeys",
    ()=>indexKeys,
    "indexKeysRaw",
    ()=>indexKeysRaw,
    "indexPredicate",
    ()=>indexPredicate,
    "indexPredicateRaw",
    ()=>indexPredicateRaw,
    "normalizeConstraintDef",
    ()=>normalizeConstraintDef,
    "normalizeDefault",
    ()=>normalizeDefault,
    "normalizeFunctionBody",
    ()=>normalizeFunctionBody
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/tools.js [instrumentation] (ecmascript)");
;
const SINGLE_QUOTE_REGEX = /'/g;
// Extracts the first balanced parenthesised group from a CREATE INDEX statement — the key-column
// list. Stops at the matching close paren, so a trailing INCLUDE(...) or WHERE(...) is excluded and
// an inner COALESCE(...) is kept. Works on both hand-written DDL and pg_get_indexdef output (whose
// leading `USING btree (` opens the same first group). The INCLUDE payload is not ignored, just
// compared separately — see extractIndexIncludeList.
function extractIndexKeyList(ddl) {
    const open = ddl.indexOf('(');
    if (open === -1) return null;
    let depth = 0;
    for(let i = open; i < ddl.length; i++){
        if (ddl[i] === '(') depth++;
        else if (ddl[i] === ')' && --depth === 0) return ddl.slice(open + 1, i);
    }
    return null;
}
// Strips SQL type casts, including schema-qualified enum casts (Postgres renders a job_state literal
// as `'active'::pgboss.job_state` and a text literal as `''::text`). Run before whitespace removal is
// fine — casts never contain spaces.
const CAST_REGEX = /::(?:[a-z_][a-z0-9_$]*\.)?[a-z_][a-z0-9_$]*(?:\[\])?/g;
// Normalises a key-column list so an expected list and a pg_get_indexdef list compare equal when they
// mean the same thing: lower-cased, quotes and whitespace stripped, and type casts removed. Column
// ORDER is preserved — an index on (a, b) must not normalise equal to (b, a), which is exactly the
// index-ordinal significance the drift check needs. Parens are kept so COALESCE(...) survives.
function normalizeKeyList(keyList) {
    return keyList.toLowerCase().replace(/"/g, '').replace(/\s+/g, '').replace(CAST_REGEX, '');
}
function indexKeys(ddl) {
    const list = extractIndexKeyList(ddl);
    return list === null ? '' : normalizeKeyList(list);
}
// Extracts the INCLUDE(...) payload column list, or null when the index has none. Both hand-written
// DDL and pg_get_indexdef spell it the same way, and it always sits between the key list and the
// WHERE clause, so scanning from the end of the key list keeps an inner `INCLUDE` inside a quoted
// column name or a predicate literal out of reach.
function extractIndexIncludeList(ddl) {
    const keyList = extractIndexKeyList(ddl);
    if (keyList === null) return null;
    const afterKeys = ddl.indexOf('(') + keyList.length + 2;
    const tail = ddl.slice(afterKeys);
    const m = tail.match(/^\s*INCLUDE\s*\(/i);
    if (!m) return null;
    const open = afterKeys + m[0].length - 1;
    let depth = 0;
    for(let i = open; i < ddl.length; i++){
        if (ddl[i] === '(') depth++;
        else if (ddl[i] === ')' && --depth === 0) return ddl.slice(open + 1, i);
    }
    return null;
}
// Normalises an INCLUDE list. Unlike the key list this is order-INSENSITIVE, and deliberately so:
// INCLUDE columns are payload, not part of the btree ordering, so `INCLUDE (a, b)` and
// `INCLUDE (b, a)` are the same index. Sorting them means a rebuild that lists them differently is
// not reported as drift, while a genuinely added or dropped payload column still is.
function normalizeIncludeList(includeList) {
    return normalizeKeyList(includeList).split(',').filter(Boolean).sort().join(',');
}
function indexInclude(ddl) {
    const list = extractIndexIncludeList(ddl);
    return list === null ? '' : normalizeIncludeList(list);
}
function indexIncludeRaw(ddl) {
    const list = extractIndexIncludeList(ddl);
    return list === null ? '' : list.replace(CAST_REGEX, '').replace(/\s+/g, ' ').trim();
}
// Everything after the top-level WHERE — the partial-index predicate — or '' for a non-partial index.
function extractPredicate(ddl) {
    const m = ddl.match(/\bWHERE\b/i);
    return m ? ddl.slice(m.index + m[0].length) : '';
}
// Normalises a predicate for comparison. Both sides originate from pg_get_indexdef — expected from the
// manifest, live from the catalog — so both carry pg's canonical form; this only undoes the cosmetic
// differences pg can vary between two equal predicates:
//   - casts added to every literal (`'active'::pgboss.job_state`, `'x'::text`) → stripped
//   - `IN (a, b)` rendered as `= ANY (ARRAY[a, b])` → folded back to `IN (a, b)`
//   - the redundant OUTER paren pair pg wraps the whole predicate in → removed
//   - case/whitespace differences → normalised away
// INNER grouping parens are deliberately KEPT: pg parenthesises each sub-expression identically for two
// equal predicates, so keeping them is symmetric, and it lets a real regrouping (`(a OR b) AND c` vs
// `a OR (b AND c)`) be detected as drift instead of both collapsing to the same token soup. This is why
// the whole-predicate paren strip must be OUTER-only (stripOuterParens), not a blanket paren removal.
function normalizePredicate(predicate) {
    const folded = predicate.toLowerCase().replace(/"/g, '').replace(CAST_REGEX, '').replace(/=\s*any\s*\(\s*array\s*\[([^\]]*)\]\s*\)/g, 'in ($1)');
    return stripOuterParens(folded).replace(/\s+/g, '');
}
function indexPredicate(ddl) {
    return normalizePredicate(extractPredicate(ddl));
}
function indexKeysRaw(ddl) {
    const list = extractIndexKeyList(ddl);
    return list === null ? '' : list.replace(CAST_REGEX, '').replace(/\s+/g, ' ').trim();
}
function indexPredicateRaw(ddl) {
    return stripOuterParens(extractPredicate(ddl).replace(CAST_REGEX, '').replace(/\s+/g, ' ').trim());
}
// True when the whole string is wrapped in a single outer parenthesis pair (the opening `(` matches
// the final `)`), e.g. "(a AND (b))" but not "(a) AND (b)".
function outerParensWrapWhole(s) {
    if (s[0] !== '(') return false;
    let depth = 0;
    for(let i = 0; i < s.length; i++){
        if (s[i] === '(') depth++;
        else if (s[i] === ')' && --depth === 0) return i === s.length - 1;
    }
    return false;
}
// Removes the redundant outer parentheses pg_get_indexdef wraps a whole predicate in. Only the
// outermost pair is stripped — inner grouping (which may be meaningful) is left intact.
function stripOuterParens(s) {
    let out = s.trim();
    while(outerParensWrapWhole(out)){
        out = out.slice(1, -1).trim();
    }
    return out;
}
function displayIndexDefinition(def) {
    const cleaned = def.replace(/\s+USING\s+btree\s+/i, ' ').replace(CAST_REGEX, '').replace(/\s+/g, ' ').trim();
    const m = cleaned.match(/\bWHERE\b/i);
    if (!m) return cleaned;
    const head = cleaned.slice(0, m.index + m[0].length);
    const predicate = stripOuterParens(cleaned.slice(m.index + m[0].length).trim());
    return `${head} ${predicate}`;
}
function extractFunctionBody(def) {
    const open = def.match(/\$[A-Za-z0-9_]*\$/);
    if (!open) return '';
    const tag = open[0];
    const start = open.index + tag.length;
    const end = def.indexOf(tag, start);
    return end === -1 ? '' : def.slice(start, end);
}
function normalizeFunctionBody(body) {
    return body.replace(/\s+/g, ' ').trim();
}
function normalizeDefault(expr) {
    return stripOuterParens(expr.toLowerCase().replace(CAST_REGEX, '').replace(/\s+/g, ' ').trim());
}
function normalizeConstraintDef(def) {
    return def.toLowerCase().replace(/"/g, '').replace(CAST_REGEX, '').replace(/\s+/g, ' ').trim();
}
function getSchemaIndexes(schema) {
    return `
    SELECT c.relname AS name, t.relname AS "table", i.indisvalid AS valid, pg_get_indexdef(i.indexrelid) AS def,
           EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conindid = i.indexrelid) AS "constraintBacked"
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = '${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveSchemaName"])(schema).replace(SINGLE_QUOTE_REGEX, "''")}'
  `;
}
function getSchemaFunctions(schema) {
    return `
    SELECT p.proname AS name, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = '${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveSchemaName"])(schema).replace(SINGLE_QUOTE_REGEX, "''")}'
  `;
}
function getEnumDefinition(schema, typeName = 'job_state') {
    return `
    SELECT e.enumlabel AS label
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = '${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveSchemaName"])(schema).replace(SINGLE_QUOTE_REGEX, "''")}' AND t.typname = '${typeName}'
    ORDER BY e.enumsortorder
  `;
}
function getSchemaColumns(schema) {
    return `
    SELECT c.relname AS "table", a.attname AS "column",
           format_type(a.atttypid, a.atttypmod) AS "type",
           a.attnotnull AS "notNull",
           pg_get_expr(ad.adbin, ad.adrelid) AS "default"
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE n.nspname = '${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveSchemaName"])(schema).replace(SINGLE_QUOTE_REGEX, "''")}'
      AND a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r', 'p')
  `;
}
function getSchemaTables(schema) {
    return `
    SELECT c.relname AS "table"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = '${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveSchemaName"])(schema).replace(SINGLE_QUOTE_REGEX, "''")}'
      AND c.relkind IN ('r', 'p')
  `;
}
function getSchemaConstraints(schema) {
    return `
    SELECT rel.relname AS "table", pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = '${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveSchemaName"])(schema).replace(SINGLE_QUOTE_REGEX, "''")}' AND con.contype <> 'n'
  `;
}
function functionName(def) {
    const m = def.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:[a-z_][\w$]*\.)?"?([\w$]+)"?/i);
    return m ? m[1] : '';
}
// Function-body diff: an expected function with no catalog entry is missing; a present one whose stored
// body (from pg_get_functiondef) differs from the code's emitted body is mismatched. A function whose
// body cannot be extracted (no dollar-quoted body found) is skipped, not flagged.
function computeFunctionDrift(expected, live) {
    const liveByName = new Map(live.map((f)=>[
            f.name,
            f
        ]));
    const missingFunctions = [];
    const mismatchedFunctions = [];
    for (const fn of expected){
        const found = liveByName.get(fn.name);
        if (!found?.def) {
            missingFunctions.push(fn);
            continue;
        }
        const actualBody = normalizeFunctionBody(extractFunctionBody(found.def));
        if (actualBody && actualBody !== fn.expectedBody) {
            mismatchedFunctions.push({
                ...fn,
                actualBody,
                actualDefinition: found.def.replace(/\s+/g, ' ').trim()
            });
        }
    }
    return {
        missingFunctions,
        mismatchedFunctions
    };
}
function computeColumnDrift(expected, live) {
    const liveByTable = new Map();
    for (const col of live){
        let cols = liveByTable.get(col.table);
        if (!cols) liveByTable.set(col.table, cols = new Map());
        cols.set(col.column.toLowerCase(), col);
    }
    const drift = [];
    for (const { table, columns, defaults, types } of expected){
        const liveCols = liveByTable.get(table);
        if (!liveCols || liveCols.size === 0) continue;
        const expectedSet = new Set(columns);
        const missingColumns = columns.filter((c)=>!liveCols.has(c));
        const unexpectedColumns = [
            ...liveCols.keys()
        ].filter((c)=>!expectedSet.has(c));
        const defaultMismatches = [];
        const typeMismatches = [];
        const nullabilityMismatches = [];
        for (const col of columns){
            const liveCol = liveCols.get(col);
            if (!liveCol) continue;
            if (defaults && defaults[col] !== undefined) {
                const actual = liveCol.default ?? '';
                if (normalizeDefault(defaults[col]) !== normalizeDefault(actual)) {
                    defaultMismatches.push({
                        column: col,
                        expected: defaults[col],
                        actual
                    });
                }
            }
            if (types && types[col]) {
                // Both sides are the canonical format_type() form (expected from the manifest, actual from the
                // live catalog), so a direct comparison suffices — no alias folding needed.
                const actualType = liveCol.type ?? '';
                if (types[col].type !== actualType) {
                    typeMismatches.push({
                        column: col,
                        expected: types[col].type,
                        actual: actualType
                    });
                }
                if (types[col].notNull !== !!liveCol.notNull) {
                    nullabilityMismatches.push({
                        column: col,
                        expected: types[col].notNull,
                        actual: !!liveCol.notNull
                    });
                }
            }
        }
        if (missingColumns.length || unexpectedColumns.length || defaultMismatches.length || typeMismatches.length || nullabilityMismatches.length) {
            drift.push({
                table,
                missingColumns,
                unexpectedColumns,
                defaultMismatches,
                typeMismatches,
                nullabilityMismatches
            });
        }
    }
    return drift;
}
function computeConstraintDrift(expected, live) {
    const liveByTable = new Map();
    for (const { table, def } of live){
        let defs = liveByTable.get(table);
        if (!defs) liveByTable.set(table, defs = []);
        defs.push(def);
    }
    const drift = [];
    for (const { table, constraints } of expected){
        const liveDefs = liveByTable.get(table);
        if (!liveDefs || liveDefs.length === 0) continue;
        const liveNormSet = new Set(liveDefs.map(normalizeConstraintDef));
        const expectedNormSet = new Set(constraints.map(normalizeConstraintDef));
        const missingConstraints = constraints.filter((c)=>!liveNormSet.has(normalizeConstraintDef(c)));
        const unexpectedConstraints = liveDefs.filter((d)=>!expectedNormSet.has(normalizeConstraintDef(d)));
        if (missingConstraints.length || unexpectedConstraints.length) {
            drift.push({
                table,
                missingConstraints,
                unexpectedConstraints
            });
        }
    }
    return drift;
}
// Enum diff: ordered value-set comparison. An absent enum (empty actual — pre-enum schema or a backend
// without enums) is not treated as drift. Order is significant; the numeric base type relies on it.
function computeEnumDrift(name, expected, actual) {
    if (actual.length === 0) return null;
    const same = expected.length === actual.length && expected.every((v, i)=>v === actual[i]);
    return same ? null : {
        name,
        expectedValues: [
            ...expected
        ],
        actualValues: actual
    };
}
function computeSchemaDrift(opts = {}) {
    const expectedIndexes = opts.indexes?.expected ?? [];
    const liveIndexes = opts.indexes?.live ?? [];
    const building = opts.indexes?.building ?? new Set();
    const liveByName = new Map(liveIndexes.map((i)=>[
            i.name,
            i
        ]));
    const expectedNames = new Set(expectedIndexes.map((i)=>i.name));
    const missing = [];
    const stillBuilding = [];
    const invalid = [];
    const mismatched = [];
    for (const idx of expectedIndexes){
        const found = liveByName.get(idx.name);
        if (!found) {
            (building.has(idx.name) ? stillBuilding : missing).push(idx);
        } else if (!found.valid) {
            invalid.push({
                ...idx,
                building: building.has(idx.name)
            });
        } else if (idx.keys && found.def) {
            // Definition-diff: a present, valid index whose key columns/order or predicate differ from the
            // expected shape. Comparison is on the normalised forms (order-significant, format-insensitive),
            // but the report carries the readable raw text. Only when the key list parses — an unparseable
            // def is skipped, not falsely flagged. (An empty normalised key list means we could not parse the
            // def; '' is never a real key list, whereas an empty predicate is legitimate for a non-partial
            // index.)
            const actualKeys = indexKeysRaw(found.def);
            if (normalizeKeyList(actualKeys)) {
                const expectedPredicate = idx.predicate ?? '';
                const actualPredicate = indexPredicateRaw(found.def);
                const expectedInclude = idx.include ?? '';
                const actualInclude = indexIncludeRaw(found.def);
                const differs = [];
                if (normalizeKeyList(idx.keys) !== normalizeKeyList(actualKeys)) differs.push('keys');
                if (normalizeIncludeList(expectedInclude) !== normalizeIncludeList(actualInclude)) differs.push('include');
                if (normalizePredicate(expectedPredicate) !== normalizePredicate(actualPredicate)) differs.push('predicate');
                if (differs.length) {
                    mismatched.push({
                        ...idx,
                        expectedKeys: idx.keys,
                        actualKeys,
                        expectedInclude,
                        actualInclude,
                        expectedPredicate,
                        actualPredicate,
                        actualDefinition: displayIndexDefinition(found.def),
                        differs
                    });
                }
            }
        }
    }
    // Extra indexes: standalone (non-constraint-backing) indexes on a managed table that the expected set
    // does not account for — a stale pg-boss index or one a user added. These are informational (an extra
    // index is harmless), so they are surfaced as a warning and do NOT flip `ok`. Scoped to managed tables
    // so a user's indexes on their own tables in the schema are never reported.
    const managedTables = new Set(opts.tables?.expected ?? expectedIndexes.map((i)=>i.table));
    const extraIndexes = liveIndexes.filter((i)=>managedTables.has(i.table) && !expectedNames.has(i.name) && !i.constraintBacked).map((i)=>({
            name: i.name,
            table: i.table
        }));
    const liveTables = new Set(opts.tables?.live ?? []);
    const missingTables = (opts.tables?.expected ?? []).filter((t)=>!liveTables.has(t));
    const { missingFunctions, mismatchedFunctions } = computeFunctionDrift(opts.functions?.expected ?? [], opts.functions?.live ?? []);
    const columnDrift = opts.columns ? computeColumnDrift(opts.columns.expected, opts.columns.live) : [];
    const constraintDrift = opts.constraints ? computeConstraintDrift(opts.constraints.expected, opts.constraints.live) : [];
    const enumDrift = opts.enum ? computeEnumDrift(opts.enum.name, opts.enum.expected, opts.enum.actual) : null;
    return {
        ok: missingTables.length === 0 && missing.length === 0 && invalid.length === 0 && mismatched.length === 0 && missingFunctions.length === 0 && mismatchedFunctions.length === 0 && columnDrift.length === 0 && constraintDrift.length === 0 && enumDrift === null,
        missingTables,
        missing,
        building: stillBuilding,
        invalid,
        extraIndexes,
        mismatched,
        missingFunctions,
        mismatchedFunctions,
        columnDrift,
        constraintDrift,
        enumDrift
    };
}
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/schema.json (json)", ((__turbopack_context__) => {

__turbopack_context__.v(JSON.parse("{\"_generated\":\"Generated by scripts/gen-manifest.ts — do not edit by hand. Run `npm run gen:manifest`.\",\"version\":38,\"schemaToken\":\"{{schema}}\",\"partitioned\":{\"tables\":[\"bam\",\"job\",\"job_common\",\"job_dependency\",\"queue\",\"queue_stats\",\"schedule\",\"subscription\",\"version\",\"warning\"],\"columns\":[{\"table\":\"bam\",\"column\":\"command\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"bam\",\"column\":\"completed_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"bam\",\"column\":\"created_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"clock_timestamp()\"},{\"table\":\"bam\",\"column\":\"error\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"bam\",\"column\":\"id\",\"type\":\"uuid\",\"notNull\":true,\"default\":\"gen_random_uuid()\"},{\"table\":\"bam\",\"column\":\"name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"bam\",\"column\":\"queue\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"bam\",\"column\":\"started_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"bam\",\"column\":\"status\",\"type\":\"text\",\"notNull\":true,\"default\":\"'pending'::text\"},{\"table\":\"bam\",\"column\":\"table_name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"bam\",\"column\":\"version\",\"type\":\"integer\",\"notNull\":true,\"default\":null},{\"table\":\"job_common\",\"column\":\"blocked\",\"type\":\"boolean\",\"notNull\":true,\"default\":\"false\"},{\"table\":\"job_common\",\"column\":\"blocking\",\"type\":\"boolean\",\"notNull\":true,\"default\":\"false\"},{\"table\":\"job_common\",\"column\":\"completed_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"created_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"job_common\",\"column\":\"data\",\"type\":\"jsonb\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"dead_letter\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"deletion_seconds\",\"type\":\"integer\",\"notNull\":true,\"default\":\"604800\"},{\"table\":\"job_common\",\"column\":\"expire_seconds\",\"type\":\"integer\",\"notNull\":true,\"default\":\"900\"},{\"table\":\"job_common\",\"column\":\"group_id\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"group_tier\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"heartbeat_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"heartbeat_seconds\",\"type\":\"integer\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"id\",\"type\":\"uuid\",\"notNull\":true,\"default\":\"gen_random_uuid()\"},{\"table\":\"job_common\",\"column\":\"keep_until\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"(now() + '336:00:00'::interval)\"},{\"table\":\"job_common\",\"column\":\"name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"job_common\",\"column\":\"output\",\"type\":\"jsonb\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"pending_dependencies\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"job_common\",\"column\":\"policy\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"priority\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"job_common\",\"column\":\"retry_backoff\",\"type\":\"boolean\",\"notNull\":true,\"default\":\"false\"},{\"table\":\"job_common\",\"column\":\"retry_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"job_common\",\"column\":\"retry_delay\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"job_common\",\"column\":\"retry_delay_max\",\"type\":\"integer\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"retry_limit\",\"type\":\"integer\",\"notNull\":true,\"default\":\"2\"},{\"table\":\"job_common\",\"column\":\"singleton_key\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"singleton_on\",\"type\":\"timestamp without time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"source_created_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"source_id\",\"type\":\"uuid\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"source_name\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"source_retry_count\",\"type\":\"integer\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"start_after\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"job_common\",\"column\":\"started_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job_common\",\"column\":\"state\",\"type\":\"{{schema}}.job_state\",\"notNull\":true,\"default\":\"'created'::{{schema}}.job_state\"},{\"table\":\"job_dependency\",\"column\":\"child_id\",\"type\":\"uuid\",\"notNull\":true,\"default\":null},{\"table\":\"job_dependency\",\"column\":\"child_name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"job_dependency\",\"column\":\"parent_id\",\"type\":\"uuid\",\"notNull\":true,\"default\":null},{\"table\":\"job_dependency\",\"column\":\"parent_name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"job\",\"column\":\"blocked\",\"type\":\"boolean\",\"notNull\":true,\"default\":\"false\"},{\"table\":\"job\",\"column\":\"blocking\",\"type\":\"boolean\",\"notNull\":true,\"default\":\"false\"},{\"table\":\"job\",\"column\":\"completed_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"created_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"job\",\"column\":\"data\",\"type\":\"jsonb\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"dead_letter\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"deletion_seconds\",\"type\":\"integer\",\"notNull\":true,\"default\":\"604800\"},{\"table\":\"job\",\"column\":\"expire_seconds\",\"type\":\"integer\",\"notNull\":true,\"default\":\"900\"},{\"table\":\"job\",\"column\":\"group_id\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"group_tier\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"heartbeat_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"heartbeat_seconds\",\"type\":\"integer\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"id\",\"type\":\"uuid\",\"notNull\":true,\"default\":\"gen_random_uuid()\"},{\"table\":\"job\",\"column\":\"keep_until\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"(now() + '336:00:00'::interval)\"},{\"table\":\"job\",\"column\":\"name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"job\",\"column\":\"output\",\"type\":\"jsonb\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"pending_dependencies\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"job\",\"column\":\"policy\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"priority\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"job\",\"column\":\"retry_backoff\",\"type\":\"boolean\",\"notNull\":true,\"default\":\"false\"},{\"table\":\"job\",\"column\":\"retry_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"job\",\"column\":\"retry_delay\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"job\",\"column\":\"retry_delay_max\",\"type\":\"integer\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"retry_limit\",\"type\":\"integer\",\"notNull\":true,\"default\":\"2\"},{\"table\":\"job\",\"column\":\"singleton_key\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"singleton_on\",\"type\":\"timestamp without time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"source_created_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"source_id\",\"type\":\"uuid\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"source_name\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"source_retry_count\",\"type\":\"integer\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"start_after\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"job\",\"column\":\"started_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"state\",\"type\":\"{{schema}}.job_state\",\"notNull\":true,\"default\":\"'created'::{{schema}}.job_state\"},{\"table\":\"queue_stats\",\"column\":\"active_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue_stats\",\"column\":\"captured_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"queue_stats\",\"column\":\"deferred_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue_stats\",\"column\":\"failed_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue_stats\",\"column\":\"id\",\"type\":\"uuid\",\"notNull\":true,\"default\":\"gen_random_uuid()\"},{\"table\":\"queue_stats\",\"column\":\"name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"queue_stats\",\"column\":\"queued_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue_stats\",\"column\":\"ready_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue_stats\",\"column\":\"total_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue\",\"column\":\"active_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue\",\"column\":\"created_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"queue\",\"column\":\"dead_letter\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"queue\",\"column\":\"deferred_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue\",\"column\":\"deletion_seconds\",\"type\":\"integer\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"expire_seconds\",\"type\":\"integer\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"failed_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue\",\"column\":\"heartbeat_seconds\",\"type\":\"integer\",\"notNull\":false,\"default\":null},{\"table\":\"queue\",\"column\":\"maintain_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"queue\",\"column\":\"monitor_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"queue\",\"column\":\"name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"notify\",\"type\":\"boolean\",\"notNull\":true,\"default\":\"false\"},{\"table\":\"queue\",\"column\":\"partition\",\"type\":\"boolean\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"policy\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"queued_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue\",\"column\":\"ready_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue\",\"column\":\"ready_history\",\"type\":\"integer[]\",\"notNull\":true,\"default\":\"'{}'::integer[]\"},{\"table\":\"queue\",\"column\":\"retention_seconds\",\"type\":\"integer\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"retry_backoff\",\"type\":\"boolean\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"retry_delay\",\"type\":\"integer\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"retry_delay_max\",\"type\":\"integer\",\"notNull\":false,\"default\":null},{\"table\":\"queue\",\"column\":\"retry_limit\",\"type\":\"integer\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"singletons_active\",\"type\":\"text[]\",\"notNull\":false,\"default\":null},{\"table\":\"queue\",\"column\":\"table_name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"total_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue\",\"column\":\"updated_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"queue\",\"column\":\"warning_queued\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"schedule\",\"column\":\"created_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"schedule\",\"column\":\"cron\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"schedule\",\"column\":\"data\",\"type\":\"jsonb\",\"notNull\":false,\"default\":null},{\"table\":\"schedule\",\"column\":\"key\",\"type\":\"text\",\"notNull\":true,\"default\":\"''::text\"},{\"table\":\"schedule\",\"column\":\"name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"schedule\",\"column\":\"options\",\"type\":\"jsonb\",\"notNull\":false,\"default\":null},{\"table\":\"schedule\",\"column\":\"timezone\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"schedule\",\"column\":\"updated_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"subscription\",\"column\":\"created_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"subscription\",\"column\":\"event\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"subscription\",\"column\":\"name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"subscription\",\"column\":\"updated_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"version\",\"column\":\"bam_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"version\",\"column\":\"cron_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"version\",\"column\":\"flow_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"version\",\"column\":\"version\",\"type\":\"integer\",\"notNull\":true,\"default\":null},{\"table\":\"warning\",\"column\":\"created_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"warning\",\"column\":\"data\",\"type\":\"jsonb\",\"notNull\":false,\"default\":null},{\"table\":\"warning\",\"column\":\"id\",\"type\":\"uuid\",\"notNull\":true,\"default\":\"gen_random_uuid()\"},{\"table\":\"warning\",\"column\":\"message\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"warning\",\"column\":\"type\",\"type\":\"text\",\"notNull\":true,\"default\":null}],\"constraints\":[{\"table\":\"bam\",\"def\":\"PRIMARY KEY (id)\"},{\"table\":\"job_common\",\"def\":\"CHECK ((NOT ((policy = 'key_strict_fifo'::text) AND (singleton_key IS NULL))))\"},{\"table\":\"job_common\",\"def\":\"FOREIGN KEY (dead_letter) REFERENCES {{schema}}.queue(name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED\"},{\"table\":\"job_common\",\"def\":\"FOREIGN KEY (name) REFERENCES {{schema}}.queue(name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED\"},{\"table\":\"job_common\",\"def\":\"PRIMARY KEY (name, id)\"},{\"table\":\"job_dependency\",\"def\":\"PRIMARY KEY (child_name, child_id, parent_name, parent_id)\"},{\"table\":\"job\",\"def\":\"PRIMARY KEY (name, id)\"},{\"table\":\"queue_stats\",\"def\":\"PRIMARY KEY (id, captured_on)\"},{\"table\":\"queue\",\"def\":\"CHECK ((dead_letter IS DISTINCT FROM name))\"},{\"table\":\"queue\",\"def\":\"FOREIGN KEY (dead_letter) REFERENCES {{schema}}.queue(name)\"},{\"table\":\"queue\",\"def\":\"PRIMARY KEY (name)\"},{\"table\":\"schedule\",\"def\":\"FOREIGN KEY (name) REFERENCES {{schema}}.queue(name) ON DELETE CASCADE\"},{\"table\":\"schedule\",\"def\":\"PRIMARY KEY (name, key)\"},{\"table\":\"subscription\",\"def\":\"FOREIGN KEY (name) REFERENCES {{schema}}.queue(name) ON DELETE CASCADE\"},{\"table\":\"subscription\",\"def\":\"PRIMARY KEY (event, name)\"},{\"table\":\"version\",\"def\":\"PRIMARY KEY (version)\"},{\"table\":\"warning\",\"def\":\"PRIMARY KEY (id)\"}],\"indexes\":[{\"name\":\"job_common_i1\",\"table\":\"job_common\",\"valid\":true,\"def\":\"CREATE UNIQUE INDEX job_common_i1 ON {{schema}}.job_common USING btree (name, COALESCE(singleton_key, ''::text)) WHERE ((state = 'created'::{{schema}}.job_state) AND (policy = 'short'::text))\"},{\"name\":\"job_common_i10\",\"table\":\"job_common\",\"valid\":true,\"def\":\"CREATE INDEX job_common_i10 ON {{schema}}.job_common USING btree (name, singleton_key, state DESC, created_on, id) INCLUDE (start_after) WHERE ((state < 'active'::{{schema}}.job_state) AND (NOT blocked) AND (policy = 'key_strict_fifo'::text))\"},{\"name\":\"job_common_i2\",\"table\":\"job_common\",\"valid\":true,\"def\":\"CREATE UNIQUE INDEX job_common_i2 ON {{schema}}.job_common USING btree (name, COALESCE(singleton_key, ''::text)) WHERE ((state = 'active'::{{schema}}.job_state) AND (policy = 'singleton'::text))\"},{\"name\":\"job_common_i3\",\"table\":\"job_common\",\"valid\":true,\"def\":\"CREATE UNIQUE INDEX job_common_i3 ON {{schema}}.job_common USING btree (name, state, COALESCE(singleton_key, ''::text)) WHERE ((state <= 'active'::{{schema}}.job_state) AND (policy = 'stately'::text))\"},{\"name\":\"job_common_i4\",\"table\":\"job_common\",\"valid\":true,\"def\":\"CREATE UNIQUE INDEX job_common_i4 ON {{schema}}.job_common USING btree (name, singleton_on, COALESCE(singleton_key, ''::text)) WHERE ((state <> 'cancelled'::{{schema}}.job_state) AND (singleton_on IS NOT NULL))\"},{\"name\":\"job_common_i5\",\"table\":\"job_common\",\"valid\":true,\"def\":\"CREATE INDEX job_common_i5 ON {{schema}}.job_common USING btree (name, start_after) WHERE ((state < 'active'::{{schema}}.job_state) AND (NOT blocked))\"},{\"name\":\"job_common_i6\",\"table\":\"job_common\",\"valid\":true,\"def\":\"CREATE UNIQUE INDEX job_common_i6 ON {{schema}}.job_common USING btree (name, COALESCE(singleton_key, ''::text)) WHERE ((state <= 'active'::{{schema}}.job_state) AND (policy = 'exclusive'::text))\"},{\"name\":\"job_common_i7\",\"table\":\"job_common\",\"valid\":true,\"def\":\"CREATE INDEX job_common_i7 ON {{schema}}.job_common USING btree (name, group_id) WHERE ((state = 'active'::{{schema}}.job_state) AND (group_id IS NOT NULL))\"},{\"name\":\"job_common_i8\",\"table\":\"job_common\",\"valid\":true,\"def\":\"CREATE UNIQUE INDEX job_common_i8 ON {{schema}}.job_common USING btree (name, singleton_key) WHERE ((state = ANY (ARRAY['active'::{{schema}}.job_state, 'retry'::{{schema}}.job_state, 'failed'::{{schema}}.job_state])) AND (policy = 'key_strict_fifo'::text))\"},{\"name\":\"job_common_i9\",\"table\":\"job_common\",\"valid\":true,\"def\":\"CREATE INDEX job_common_i9 ON {{schema}}.job_common USING btree (name, id) WHERE (blocking AND (state = 'completed'::{{schema}}.job_state))\"},{\"name\":\"job_dep_parent_idx\",\"table\":\"job_dependency\",\"valid\":true,\"def\":\"CREATE INDEX job_dep_parent_idx ON {{schema}}.job_dependency USING btree (parent_name, parent_id)\"},{\"name\":\"queue_stats_i1\",\"table\":\"queue_stats\",\"valid\":true,\"def\":\"CREATE INDEX queue_stats_i1 ON ONLY {{schema}}.queue_stats USING btree (name, captured_on DESC) INCLUDE (deferred_count, queued_count, ready_count, active_count, failed_count, total_count)\"},{\"name\":\"warning_i1\",\"table\":\"warning\",\"valid\":true,\"def\":\"CREATE INDEX warning_i1 ON {{schema}}.warning USING btree (created_on DESC)\"}],\"functions\":[{\"name\":\"create_queue\",\"def\":\"CREATE OR REPLACE FUNCTION {{schema}}.create_queue(queue_name text, options jsonb)\\n RETURNS void\\n LANGUAGE plpgsql\\nAS $function$\\n    DECLARE\\n      tablename varchar := CASE WHEN options->>'partition' = 'true'\\n                            THEN 'j' || encode(sha224(queue_name::bytea), 'hex')\\n                            ELSE 'job_common'\\n                            END;\\n      queue_created_on timestamptz;\\n    BEGIN\\n\\n      WITH q as (\\n        INSERT INTO {{schema}}.queue (\\n          name,\\n          policy,\\n          retry_limit,\\n          retry_delay,\\n          retry_backoff,\\n          retry_delay_max,\\n          expire_seconds,\\n          retention_seconds,\\n          deletion_seconds,\\n          warning_queued,\\n          dead_letter,\\n          partition,\\n          table_name,\\n          heartbeat_seconds,\\n          notify\\n        )\\n        VALUES (\\n          queue_name,\\n          options->>'policy',\\n          COALESCE((options->>'retryLimit')::int, 2),\\n          COALESCE((options->>'retryDelay')::int, 0),\\n          COALESCE((options->>'retryBackoff')::bool, false),\\n          (options->>'retryDelayMax')::int,\\n          COALESCE((options->>'expireInSeconds')::int, 900),\\n          COALESCE((options->>'retentionSeconds')::int, 1209600),\\n          COALESCE((options->>'deleteAfterSeconds')::int, 604800),\\n          COALESCE((options->>'warningQueueSize')::int, 0),\\n          options->>'deadLetter',\\n          COALESCE((options->>'partition')::bool, false),\\n          tablename,\\n          (options->>'heartbeatSeconds')::int,\\n          COALESCE((options->>'notify')::bool, false)\\n        )\\n        ON CONFLICT DO NOTHING\\n        RETURNING created_on\\n      )\\n      SELECT created_on into queue_created_on from q;\\n\\n      IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN\\n        RETURN;\\n      END IF;\\n\\n      EXECUTE format('CREATE TABLE {{schema}}.%I (LIKE {{schema}}.job INCLUDING DEFAULTS)', tablename);\\n\\n      EXECUTE {{schema}}.job_table_format($cmd$ALTER TABLE {{schema}}.job ADD PRIMARY KEY (name, id)$cmd$, tablename);\\n      EXECUTE {{schema}}.job_table_format($cmd$ALTER TABLE {{schema}}.job ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES {{schema}}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);\\n      EXECUTE {{schema}}.job_table_format($cmd$ALTER TABLE {{schema}}.job ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES {{schema}}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);\\n\\n      EXECUTE {{schema}}.job_table_format($cmd$CREATE INDEX job_i5 ON {{schema}}.job (name, start_after) WHERE state < 'active' AND NOT blocked$cmd$, tablename);\\n      EXECUTE {{schema}}.job_table_format($cmd$CREATE UNIQUE INDEX job_i4 ON {{schema}}.job (name, singleton_on, COALESCE(singleton_key, '')) WHERE state <> 'cancelled' AND singleton_on IS NOT NULL$cmd$, tablename);\\n      EXECUTE {{schema}}.job_table_format($cmd$CREATE INDEX job_i7 ON {{schema}}.job (name, group_id) WHERE state = 'active' AND group_id IS NOT NULL$cmd$, tablename);\\n      EXECUTE {{schema}}.job_table_format($cmd$CREATE INDEX job_i9 ON {{schema}}.job (name, id) WHERE blocking AND state = 'completed'$cmd$, tablename);\\n\\n      IF options->>'policy' = 'short' THEN\\n        EXECUTE {{schema}}.job_table_format($cmd$CREATE UNIQUE INDEX job_i1 ON {{schema}}.job (name, COALESCE(singleton_key, '')) WHERE state = 'created' AND policy = 'short'$cmd$, tablename);\\n      ELSIF options->>'policy' = 'singleton' THEN\\n        EXECUTE {{schema}}.job_table_format($cmd$CREATE UNIQUE INDEX job_i2 ON {{schema}}.job (name, COALESCE(singleton_key, '')) WHERE state = 'active' AND policy = 'singleton'$cmd$, tablename);\\n      ELSIF options->>'policy' = 'stately' THEN\\n        EXECUTE {{schema}}.job_table_format($cmd$CREATE UNIQUE INDEX job_i3 ON {{schema}}.job (name, state, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'stately'$cmd$, tablename);\\n      ELSIF options->>'policy' = 'exclusive' THEN\\n        EXECUTE {{schema}}.job_table_format($cmd$CREATE UNIQUE INDEX job_i6 ON {{schema}}.job (name, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'exclusive'$cmd$, tablename);\\n      ELSIF options->>'policy' = 'key_strict_fifo' THEN\\n        EXECUTE {{schema}}.job_table_format($cmd$CREATE UNIQUE INDEX job_i8 ON {{schema}}.job (name, singleton_key) WHERE state IN ('active', 'retry', 'failed') AND policy = 'key_strict_fifo'$cmd$, tablename);\\n        EXECUTE {{schema}}.job_table_format($cmd$CREATE INDEX job_i10 ON {{schema}}.job (name, singleton_key, state DESC, created_on, id) INCLUDE (start_after) WHERE state < 'active' AND NOT blocked AND policy = 'key_strict_fifo'$cmd$, tablename);\\n        EXECUTE {{schema}}.job_table_format($cmd$ALTER TABLE {{schema}}.job ADD CONSTRAINT job_key_strict_fifo_singleton_key_check CHECK (NOT (policy = 'key_strict_fifo' AND singleton_key IS NULL))$cmd$, tablename);\\n      END IF;\\n\\n      EXECUTE format('ALTER TABLE {{schema}}.%I ADD CONSTRAINT cjc CHECK (name=%L)', tablename, queue_name);\\n      EXECUTE format('ALTER TABLE {{schema}}.job ATTACH PARTITION {{schema}}.%I FOR VALUES IN (%L)', tablename, queue_name);\\n    END;\\n    $function$\\n\"},{\"name\":\"delete_queue\",\"def\":\"CREATE OR REPLACE FUNCTION {{schema}}.delete_queue(queue_name text)\\n RETURNS void\\n LANGUAGE plpgsql\\nAS $function$\\n    DECLARE\\n      v_table varchar;\\n      v_partition bool;\\n    BEGIN\\n      \\n      SELECT table_name, partition\\n      FROM {{schema}}.queue\\n      WHERE name = queue_name\\n      INTO v_table, v_partition;\\n\\n      IF v_partition THEN\\n        EXECUTE format('DROP TABLE IF EXISTS {{schema}}.%I', v_table);\\n      ELSE\\n        EXECUTE format('DELETE FROM {{schema}}.%I WHERE name = %L', v_table, queue_name);\\n      END IF;\\n    \\n      DELETE FROM {{schema}}.queue WHERE name = queue_name;\\n    END;\\n    $function$\\n\"},{\"name\":\"job_table_format\",\"def\":\"CREATE OR REPLACE FUNCTION {{schema}}.job_table_format(command text, table_name text)\\n RETURNS text\\n LANGUAGE sql\\n IMMUTABLE\\nAS $function$\\n      SELECT format(\\n        regexp_replace(\\n          regexp_replace(command, '\\\\.job\\\\y', '.%1$I', 'g'),\\n          '\\\\yjob_i(\\\\d+)', '%1$s_i\\\\1', 'g'\\n        ),\\n        table_name\\n      );\\n    $function$\\n\"},{\"name\":\"job_table_run\",\"def\":\"CREATE OR REPLACE FUNCTION {{schema}}.job_table_run(command text, tbl_name text DEFAULT NULL::text, queue_name text DEFAULT NULL::text)\\n RETURNS void\\n LANGUAGE plpgsql\\nAS $function$\\n    DECLARE\\n      tbl RECORD;\\n    BEGIN\\n      IF queue_name IS NOT NULL THEN\\n        SELECT table_name INTO tbl_name FROM {{schema}}.queue WHERE name = queue_name;\\n      END IF;\\n\\n      IF tbl_name IS NOT NULL THEN\\n        EXECUTE {{schema}}.job_table_format(command, tbl_name);\\n        RETURN;\\n      END IF;\\n\\n      EXECUTE {{schema}}.job_table_format(command, 'job_common');\\n\\n      FOR tbl IN SELECT table_name FROM {{schema}}.queue WHERE partition = true\\n      LOOP\\n        EXECUTE {{schema}}.job_table_format(command, tbl.table_name);\\n      END LOOP;\\n    END;\\n    $function$\\n\"},{\"name\":\"job_table_run_async\",\"def\":\"CREATE OR REPLACE FUNCTION {{schema}}.job_table_run_async(command_name text, version integer, command text, tbl_name text DEFAULT NULL::text, queue_name text DEFAULT NULL::text)\\n RETURNS void\\n LANGUAGE plpgsql\\nAS $function$\\n    BEGIN\\n      IF queue_name IS NOT NULL THEN\\n        SELECT table_name INTO tbl_name FROM {{schema}}.queue WHERE name = queue_name;\\n      END IF;\\n\\n      IF tbl_name IS NOT NULL THEN\\n        INSERT INTO {{schema}}.bam (name, version, status, queue, table_name, command)\\n        VALUES (\\n          command_name,\\n          version,\\n          'pending',\\n          queue_name,\\n          tbl_name,\\n          {{schema}}.job_table_format(command, tbl_name)\\n        );\\n        RETURN;\\n      END IF;\\n\\n      INSERT INTO {{schema}}.bam (name, version, status, queue, table_name, command)\\n      SELECT\\n        command_name,\\n        version,\\n        'pending',\\n        NULL,\\n        'job_common',\\n        {{schema}}.job_table_format(command, 'job_common')\\n      UNION ALL\\n      SELECT\\n        command_name,\\n        version,\\n        'pending',\\n        queue.name,\\n        queue.table_name,\\n        {{schema}}.job_table_format(command, queue.table_name)\\n      FROM {{schema}}.queue\\n      WHERE partition = true;\\n    END;\\n    $function$\\n\"}],\"enum\":[\"created\",\"retry\",\"active\",\"completed\",\"cancelled\",\"failed\"]},\"nonPartitioned\":{\"tables\":[\"bam\",\"job\",\"job_dependency\",\"queue\",\"queue_stats\",\"schedule\",\"subscription\",\"version\",\"warning\"],\"columns\":[{\"table\":\"bam\",\"column\":\"command\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"bam\",\"column\":\"completed_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"bam\",\"column\":\"created_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"clock_timestamp()\"},{\"table\":\"bam\",\"column\":\"error\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"bam\",\"column\":\"id\",\"type\":\"uuid\",\"notNull\":true,\"default\":\"gen_random_uuid()\"},{\"table\":\"bam\",\"column\":\"name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"bam\",\"column\":\"queue\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"bam\",\"column\":\"started_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"bam\",\"column\":\"status\",\"type\":\"text\",\"notNull\":true,\"default\":\"'pending'::text\"},{\"table\":\"bam\",\"column\":\"table_name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"bam\",\"column\":\"version\",\"type\":\"integer\",\"notNull\":true,\"default\":null},{\"table\":\"job_dependency\",\"column\":\"child_id\",\"type\":\"uuid\",\"notNull\":true,\"default\":null},{\"table\":\"job_dependency\",\"column\":\"child_name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"job_dependency\",\"column\":\"parent_id\",\"type\":\"uuid\",\"notNull\":true,\"default\":null},{\"table\":\"job_dependency\",\"column\":\"parent_name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"job\",\"column\":\"blocked\",\"type\":\"boolean\",\"notNull\":true,\"default\":\"false\"},{\"table\":\"job\",\"column\":\"blocking\",\"type\":\"boolean\",\"notNull\":true,\"default\":\"false\"},{\"table\":\"job\",\"column\":\"completed_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"created_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"job\",\"column\":\"data\",\"type\":\"jsonb\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"dead_letter\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"deletion_seconds\",\"type\":\"integer\",\"notNull\":true,\"default\":\"604800\"},{\"table\":\"job\",\"column\":\"expire_seconds\",\"type\":\"integer\",\"notNull\":true,\"default\":\"900\"},{\"table\":\"job\",\"column\":\"group_id\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"group_tier\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"heartbeat_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"heartbeat_seconds\",\"type\":\"integer\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"id\",\"type\":\"uuid\",\"notNull\":true,\"default\":\"gen_random_uuid()\"},{\"table\":\"job\",\"column\":\"keep_until\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"(now() + '336:00:00'::interval)\"},{\"table\":\"job\",\"column\":\"name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"job\",\"column\":\"output\",\"type\":\"jsonb\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"pending_dependencies\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"job\",\"column\":\"policy\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"priority\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"job\",\"column\":\"retry_backoff\",\"type\":\"boolean\",\"notNull\":true,\"default\":\"false\"},{\"table\":\"job\",\"column\":\"retry_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"job\",\"column\":\"retry_delay\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"job\",\"column\":\"retry_delay_max\",\"type\":\"integer\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"retry_limit\",\"type\":\"integer\",\"notNull\":true,\"default\":\"2\"},{\"table\":\"job\",\"column\":\"singleton_key\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"singleton_on\",\"type\":\"timestamp without time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"source_created_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"source_id\",\"type\":\"uuid\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"source_name\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"source_retry_count\",\"type\":\"integer\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"start_after\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"job\",\"column\":\"started_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"job\",\"column\":\"state\",\"type\":\"{{schema}}.job_state\",\"notNull\":true,\"default\":\"'created'::{{schema}}.job_state\"},{\"table\":\"queue_stats\",\"column\":\"active_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue_stats\",\"column\":\"captured_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"queue_stats\",\"column\":\"deferred_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue_stats\",\"column\":\"failed_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue_stats\",\"column\":\"id\",\"type\":\"uuid\",\"notNull\":true,\"default\":\"gen_random_uuid()\"},{\"table\":\"queue_stats\",\"column\":\"name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"queue_stats\",\"column\":\"queued_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue_stats\",\"column\":\"ready_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue_stats\",\"column\":\"total_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue\",\"column\":\"active_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue\",\"column\":\"created_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"queue\",\"column\":\"dead_letter\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"queue\",\"column\":\"deferred_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue\",\"column\":\"deletion_seconds\",\"type\":\"integer\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"expire_seconds\",\"type\":\"integer\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"failed_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue\",\"column\":\"heartbeat_seconds\",\"type\":\"integer\",\"notNull\":false,\"default\":null},{\"table\":\"queue\",\"column\":\"maintain_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"queue\",\"column\":\"monitor_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"queue\",\"column\":\"name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"notify\",\"type\":\"boolean\",\"notNull\":true,\"default\":\"false\"},{\"table\":\"queue\",\"column\":\"partition\",\"type\":\"boolean\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"policy\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"queued_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue\",\"column\":\"ready_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue\",\"column\":\"ready_history\",\"type\":\"integer[]\",\"notNull\":true,\"default\":\"'{}'::integer[]\"},{\"table\":\"queue\",\"column\":\"retention_seconds\",\"type\":\"integer\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"retry_backoff\",\"type\":\"boolean\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"retry_delay\",\"type\":\"integer\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"retry_delay_max\",\"type\":\"integer\",\"notNull\":false,\"default\":null},{\"table\":\"queue\",\"column\":\"retry_limit\",\"type\":\"integer\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"singletons_active\",\"type\":\"text[]\",\"notNull\":false,\"default\":null},{\"table\":\"queue\",\"column\":\"table_name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"queue\",\"column\":\"total_count\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"queue\",\"column\":\"updated_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"queue\",\"column\":\"warning_queued\",\"type\":\"integer\",\"notNull\":true,\"default\":\"0\"},{\"table\":\"schedule\",\"column\":\"created_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"schedule\",\"column\":\"cron\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"schedule\",\"column\":\"data\",\"type\":\"jsonb\",\"notNull\":false,\"default\":null},{\"table\":\"schedule\",\"column\":\"key\",\"type\":\"text\",\"notNull\":true,\"default\":\"''::text\"},{\"table\":\"schedule\",\"column\":\"name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"schedule\",\"column\":\"options\",\"type\":\"jsonb\",\"notNull\":false,\"default\":null},{\"table\":\"schedule\",\"column\":\"timezone\",\"type\":\"text\",\"notNull\":false,\"default\":null},{\"table\":\"schedule\",\"column\":\"updated_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"subscription\",\"column\":\"created_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"subscription\",\"column\":\"event\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"subscription\",\"column\":\"name\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"subscription\",\"column\":\"updated_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"version\",\"column\":\"bam_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"version\",\"column\":\"cron_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"version\",\"column\":\"flow_on\",\"type\":\"timestamp with time zone\",\"notNull\":false,\"default\":null},{\"table\":\"version\",\"column\":\"version\",\"type\":\"integer\",\"notNull\":true,\"default\":null},{\"table\":\"warning\",\"column\":\"created_on\",\"type\":\"timestamp with time zone\",\"notNull\":true,\"default\":\"now()\"},{\"table\":\"warning\",\"column\":\"data\",\"type\":\"jsonb\",\"notNull\":false,\"default\":null},{\"table\":\"warning\",\"column\":\"id\",\"type\":\"uuid\",\"notNull\":true,\"default\":\"gen_random_uuid()\"},{\"table\":\"warning\",\"column\":\"message\",\"type\":\"text\",\"notNull\":true,\"default\":null},{\"table\":\"warning\",\"column\":\"type\",\"type\":\"text\",\"notNull\":true,\"default\":null}],\"constraints\":[{\"table\":\"bam\",\"def\":\"PRIMARY KEY (id)\"},{\"table\":\"job_dependency\",\"def\":\"PRIMARY KEY (child_name, child_id, parent_name, parent_id)\"},{\"table\":\"job\",\"def\":\"CHECK ((NOT ((policy = 'key_strict_fifo'::text) AND (singleton_key IS NULL))))\"},{\"table\":\"job\",\"def\":\"FOREIGN KEY (dead_letter) REFERENCES {{schema}}.queue(name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED\"},{\"table\":\"job\",\"def\":\"FOREIGN KEY (name) REFERENCES {{schema}}.queue(name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED\"},{\"table\":\"job\",\"def\":\"PRIMARY KEY (name, id)\"},{\"table\":\"queue_stats\",\"def\":\"PRIMARY KEY (id)\"},{\"table\":\"queue\",\"def\":\"CHECK ((dead_letter IS DISTINCT FROM name))\"},{\"table\":\"queue\",\"def\":\"FOREIGN KEY (dead_letter) REFERENCES {{schema}}.queue(name)\"},{\"table\":\"queue\",\"def\":\"PRIMARY KEY (name)\"},{\"table\":\"schedule\",\"def\":\"FOREIGN KEY (name) REFERENCES {{schema}}.queue(name) ON DELETE CASCADE\"},{\"table\":\"schedule\",\"def\":\"PRIMARY KEY (name, key)\"},{\"table\":\"subscription\",\"def\":\"FOREIGN KEY (name) REFERENCES {{schema}}.queue(name) ON DELETE CASCADE\"},{\"table\":\"subscription\",\"def\":\"PRIMARY KEY (event, name)\"},{\"table\":\"version\",\"def\":\"PRIMARY KEY (version)\"},{\"table\":\"warning\",\"def\":\"PRIMARY KEY (id)\"}],\"indexes\":[{\"name\":\"job_dep_parent_idx\",\"table\":\"job_dependency\",\"valid\":true,\"def\":\"CREATE INDEX job_dep_parent_idx ON {{schema}}.job_dependency USING btree (parent_name, parent_id)\"},{\"name\":\"job_i1\",\"table\":\"job\",\"valid\":true,\"def\":\"CREATE UNIQUE INDEX job_i1 ON {{schema}}.job USING btree (name, COALESCE(singleton_key, ''::text)) WHERE ((state = 'created'::{{schema}}.job_state) AND (policy = 'short'::text))\"},{\"name\":\"job_i10\",\"table\":\"job\",\"valid\":true,\"def\":\"CREATE INDEX job_i10 ON {{schema}}.job USING btree (name, singleton_key, state DESC, created_on, id) INCLUDE (start_after) WHERE ((state < 'active'::{{schema}}.job_state) AND (NOT blocked) AND (policy = 'key_strict_fifo'::text))\"},{\"name\":\"job_i2\",\"table\":\"job\",\"valid\":true,\"def\":\"CREATE UNIQUE INDEX job_i2 ON {{schema}}.job USING btree (name, COALESCE(singleton_key, ''::text)) WHERE ((state = 'active'::{{schema}}.job_state) AND (policy = 'singleton'::text))\"},{\"name\":\"job_i3\",\"table\":\"job\",\"valid\":true,\"def\":\"CREATE UNIQUE INDEX job_i3 ON {{schema}}.job USING btree (name, state, COALESCE(singleton_key, ''::text)) WHERE ((state <= 'active'::{{schema}}.job_state) AND (policy = 'stately'::text))\"},{\"name\":\"job_i4\",\"table\":\"job\",\"valid\":true,\"def\":\"CREATE UNIQUE INDEX job_i4 ON {{schema}}.job USING btree (name, singleton_on, COALESCE(singleton_key, ''::text)) WHERE ((state <> 'cancelled'::{{schema}}.job_state) AND (singleton_on IS NOT NULL))\"},{\"name\":\"job_i5\",\"table\":\"job\",\"valid\":true,\"def\":\"CREATE INDEX job_i5 ON {{schema}}.job USING btree (name, start_after) WHERE ((state < 'active'::{{schema}}.job_state) AND (NOT blocked))\"},{\"name\":\"job_i6\",\"table\":\"job\",\"valid\":true,\"def\":\"CREATE UNIQUE INDEX job_i6 ON {{schema}}.job USING btree (name, COALESCE(singleton_key, ''::text)) WHERE ((state <= 'active'::{{schema}}.job_state) AND (policy = 'exclusive'::text))\"},{\"name\":\"job_i7\",\"table\":\"job\",\"valid\":true,\"def\":\"CREATE INDEX job_i7 ON {{schema}}.job USING btree (name, group_id) WHERE ((state = 'active'::{{schema}}.job_state) AND (group_id IS NOT NULL))\"},{\"name\":\"job_i8\",\"table\":\"job\",\"valid\":true,\"def\":\"CREATE UNIQUE INDEX job_i8 ON {{schema}}.job USING btree (name, singleton_key) WHERE ((state = ANY (ARRAY['active'::{{schema}}.job_state, 'retry'::{{schema}}.job_state, 'failed'::{{schema}}.job_state])) AND (policy = 'key_strict_fifo'::text))\"},{\"name\":\"job_i9\",\"table\":\"job\",\"valid\":true,\"def\":\"CREATE INDEX job_i9 ON {{schema}}.job USING btree (name, id) WHERE (blocking AND (state = 'completed'::{{schema}}.job_state))\"},{\"name\":\"queue_stats_i1\",\"table\":\"queue_stats\",\"valid\":true,\"def\":\"CREATE INDEX queue_stats_i1 ON {{schema}}.queue_stats USING btree (name, captured_on DESC) INCLUDE (deferred_count, queued_count, ready_count, active_count, failed_count, total_count)\"},{\"name\":\"warning_i1\",\"table\":\"warning\",\"valid\":true,\"def\":\"CREATE INDEX warning_i1 ON {{schema}}.warning USING btree (created_on DESC)\"}],\"functions\":[{\"name\":\"create_queue\",\"def\":\"CREATE OR REPLACE FUNCTION {{schema}}.create_queue(queue_name text, options jsonb)\\n RETURNS void\\n LANGUAGE plpgsql\\nAS $function$\\n      BEGIN\\n        INSERT INTO {{schema}}.queue (\\n          name,\\n          policy,\\n          retry_limit,\\n          retry_delay,\\n          retry_backoff,\\n          retry_delay_max,\\n          expire_seconds,\\n          retention_seconds,\\n          deletion_seconds,\\n          warning_queued,\\n          dead_letter,\\n          partition,\\n          table_name,\\n          heartbeat_seconds\\n        )\\n        VALUES (\\n          queue_name,\\n          options->>'policy',\\n          COALESCE((options->>'retryLimit')::int, 2),\\n          COALESCE((options->>'retryDelay')::int, 0),\\n          COALESCE((options->>'retryBackoff')::bool, false),\\n          (options->>'retryDelayMax')::int,\\n          COALESCE((options->>'expireInSeconds')::int, 900),\\n          COALESCE((options->>'retentionSeconds')::int, 1209600),\\n          COALESCE((options->>'deleteAfterSeconds')::int, 604800),\\n          COALESCE((options->>'warningQueueSize')::int, 0),\\n          options->>'deadLetter',\\n          false,\\n          'job',\\n          (options->>'heartbeatSeconds')::int\\n        )\\n        ON CONFLICT DO NOTHING;\\n      END;\\n      $function$\\n\"},{\"name\":\"delete_queue\",\"def\":\"CREATE OR REPLACE FUNCTION {{schema}}.delete_queue(queue_name text)\\n RETURNS void\\n LANGUAGE plpgsql\\nAS $function$\\n    BEGIN\\n      DELETE FROM {{schema}}.job WHERE name = queue_name;\\n      DELETE FROM {{schema}}.queue WHERE name = queue_name;\\n    END;\\n    $function$\\n\"}],\"enum\":[\"created\",\"retry\",\"active\",\"completed\",\"cancelled\",\"failed\"]}}"));}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/plans.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "COMMON_JOB_TABLE",
    ()=>COMMON_JOB_TABLE,
    "CREATE_RACE_MESSAGE",
    ()=>CREATE_RACE_MESSAGE,
    "DEFAULT_SCHEMA",
    ()=>DEFAULT_SCHEMA,
    "EXPECTED_JOB_STATES",
    ()=>EXPECTED_JOB_STATES,
    "FLOW_BATCH_SIZE",
    ()=>FLOW_BATCH_SIZE,
    "JOB_STATES",
    ()=>JOB_STATES,
    "MIGRATE_RACE_MESSAGE",
    ()=>MIGRATE_RACE_MESSAGE,
    "PG_ERROR",
    ()=>PG_ERROR,
    "QUEUE_POLICIES",
    ()=>QUEUE_POLICIES,
    "READY_HISTORY_SIZE",
    ()=>READY_HISTORY_SIZE,
    "SINGLE_QUOTE_REGEX",
    ()=>SINGLE_QUOTE_REGEX,
    "assertMigration",
    ()=>assertMigration,
    "bamCommandIndexName",
    ()=>bamCommandIndexName,
    "bamHealDrop",
    ()=>bamHealDrop,
    "bamHealProbe",
    ()=>bamHealProbe,
    "cacheQueueStats",
    ()=>cacheQueueStats,
    "cancelJobs",
    ()=>cancelJobs,
    "cleanupDependencies",
    ()=>cleanupDependencies,
    "clearBlocking",
    ()=>clearBlocking,
    "completeJobs",
    ()=>completeJobs,
    "completeJobsDistributed",
    ()=>completeJobsDistributed,
    "completeJobsWithOutputs",
    ()=>completeJobsWithOutputs,
    "completeJobsWithOutputsDistributed",
    ()=>completeJobsWithOutputsDistributed,
    "create",
    ()=>create,
    "createIndexJobDependencyParent",
    ()=>createIndexJobDependencyParent,
    "createIndexQueueStats",
    ()=>createIndexQueueStats,
    "createIndexWarning",
    ()=>createIndexWarning,
    "createQueue",
    ()=>createQueue,
    "createTableJobDependency",
    ()=>createTableJobDependency,
    "createTableQueueStats",
    ()=>createTableQueueStats,
    "createTableWarning",
    ()=>createTableWarning,
    "deadLetterJobsByIdWithOutputs",
    ()=>deadLetterJobsByIdWithOutputs,
    "decrementDependents",
    ()=>decrementDependents,
    "deleteAllJobs",
    ()=>deleteAllJobs,
    "deleteJobsById",
    ()=>deleteJobsById,
    "deleteJobsByIds",
    ()=>deleteJobsByIds,
    "deleteJobsToFail",
    ()=>deleteJobsToFail,
    "deleteOldQueueStats",
    ()=>deleteOldQueueStats,
    "deleteOldWarnings",
    ()=>deleteOldWarnings,
    "deleteQueue",
    ()=>deleteQueue,
    "deleteQueuedJobs",
    ()=>deleteQueuedJobs,
    "deleteStoredJobs",
    ()=>deleteStoredJobs,
    "deletion",
    ()=>deletion,
    "dropOldQueueStatsPartitions",
    ()=>dropOldQueueStatsPartitions,
    "ensureQueueStatsPartitions",
    ()=>ensureQueueStatsPartitions,
    "expectedManagedColumns",
    ()=>expectedManagedColumns,
    "expectedManagedConstraints",
    ()=>expectedManagedConstraints,
    "expectedManagedFunctions",
    ()=>expectedManagedFunctions,
    "expectedManagedIndexes",
    ()=>expectedManagedIndexes,
    "expectedManagedTables",
    ()=>expectedManagedTables,
    "failJobsByHeartbeat",
    ()=>failJobsByHeartbeat,
    "failJobsById",
    ()=>failJobsById,
    "failJobsByIdWithOutputs",
    ()=>failJobsByIdWithOutputs,
    "failJobsByTimeout",
    ()=>failJobsByTimeout,
    "fetchNextJob",
    ()=>fetchNextJob,
    "findJobs",
    ()=>findJobs,
    "getBamEntries",
    ()=>getBamEntries,
    "getBamStatus",
    ()=>getBamStatus,
    "getBlockedKeys",
    ()=>getBlockedKeys,
    "getDependencies",
    ()=>getDependencies,
    "getDependents",
    ()=>getDependents,
    "getIncompleteBamCommands",
    ()=>getIncompleteBamCommands,
    "getJobById",
    ()=>getJobById,
    "getManagedQueuePartitions",
    ()=>getManagedQueuePartitions,
    "getNextBamCommand",
    ()=>getNextBamCommand,
    "getPartitionedQueueTables",
    ()=>getPartitionedQueueTables,
    "getQueueStats",
    ()=>getQueueStats,
    "getQueueStatsCache",
    ()=>getQueueStatsCache,
    "getQueueStatsHistory",
    ()=>getQueueStatsHistory,
    "getQueueStatsHistoryBucketed",
    ()=>getQueueStatsHistoryBucketed,
    "getQueues",
    ()=>getQueues,
    "getQueuesForEvent",
    ()=>getQueuesForEvent,
    "getSchedules",
    ()=>getSchedules,
    "getSchedulesByQueue",
    ()=>getSchedulesByQueue,
    "getSchedulesByQueueAndKey",
    ()=>getSchedulesByQueueAndKey,
    "getSchemaCaseVariants",
    ()=>getSchemaCaseVariants,
    "getTime",
    ()=>getTime,
    "getVersion",
    ()=>getVersion,
    "getWarnings",
    ()=>getWarnings,
    "getWarningsCount",
    ()=>getWarningsCount,
    "insertDeadLetterJob",
    ()=>insertDeadLetterJob,
    "insertDependencies",
    ()=>insertDependencies,
    "insertFlowJobs",
    ()=>insertFlowJobs,
    "insertJobs",
    ()=>insertJobs,
    "insertQueueStats",
    ()=>insertQueueStats,
    "insertRetryJob",
    ()=>insertRetryJob,
    "insertVersion",
    ()=>insertVersion,
    "insertWarning",
    ()=>insertWarning,
    "jobCommonExists",
    ()=>jobCommonExists,
    "jobTableFormatFunction",
    ()=>jobTableFormatFunction,
    "locked",
    ()=>locked,
    "notifyChannelSql",
    ()=>notifyChannelSql,
    "notifyQueue",
    ()=>notifyQueue,
    "redriveJobs",
    ()=>redriveJobs,
    "refreshQueueStats",
    ()=>refreshQueueStats,
    "resolveFlowJobs",
    ()=>resolveFlowJobs,
    "restoreJobs",
    ()=>restoreJobs,
    "resumeJobs",
    ()=>resumeJobs,
    "retryJobs",
    ()=>retryJobs,
    "schedule",
    ()=>schedule,
    "selectBlockingParents",
    ()=>selectBlockingParents,
    "selectJobsToFailByHeartbeat",
    ()=>selectJobsToFailByHeartbeat,
    "selectJobsToFailById",
    ()=>selectJobsToFailById,
    "selectJobsToFailByTimeout",
    ()=>selectJobsToFailByTimeout,
    "serializeArrayParam",
    ()=>serializeArrayParam,
    "serializeJsonParam",
    ()=>serializeJsonParam,
    "setBamCompleted",
    ()=>setBamCompleted,
    "setBamFailed",
    ()=>setBamFailed,
    "setVersion",
    ()=>setVersion,
    "subscribe",
    ()=>subscribe,
    "touchJobs",
    ()=>touchJobs,
    "transaction",
    ()=>transaction,
    "truncateTable",
    ()=>truncateTable,
    "trySetBamTime",
    ()=>trySetBamTime,
    "trySetCronTime",
    ()=>trySetCronTime,
    "trySetFlowTime",
    ()=>trySetFlowTime,
    "trySetQueueDeletionTime",
    ()=>trySetQueueDeletionTime,
    "trySetQueueMonitorTime",
    ()=>trySetQueueMonitorTime,
    "unschedule",
    ()=>unschedule,
    "unsubscribe",
    ()=>unsubscribe,
    "updateJob",
    ()=>updateJob,
    "updateQueue",
    ()=>updateQueue,
    "versionTableExists",
    ()=>versionTableExists
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/drifter.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$schema$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/schema.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/tools.js [instrumentation] (ecmascript)");
;
;
;
const PG_ERROR = {
    divisionByZero: '22012'
};
const DEFAULT_SCHEMA = 'pgboss';
const MIGRATE_RACE_MESSAGE = 'division by zero';
const CREATE_RACE_MESSAGE = 'already exists';
const SINGLE_QUOTE_REGEX = /'/g;
const FIFTEEN_MINUTES = 60 * 15;
const FORTEEN_DAYS = 60 * 60 * 24 * 14;
const SEVEN_DAYS = 60 * 60 * 24 * 7;
// A bam row stuck at 'in_progress' past this means the process that claimed it died or was
// stopped mid-command (bam.ts #processCommands returns without marking the row on #stopped or a
// crash), and getNextBamCommand needs to reclaim it or every future async migration wedges forever.
// This is the *fallback* backstop only — deliberately long (24h) because false-reclaim is the worse
// failure: reclaiming a still-running CREATE INDEX CONCURRENTLY runs two builds on the same index at
// once, and an interrupted CONCURRENTLY leaves an INVALID index needing manual cleanup. The intended
// *primary* trigger is a liveness check against pg_stat_progress_create_index (reclaim as soon as no
// backend is actually building), which recovers in minutes instead of a day; the 24h timeout only
// covers cases liveness can't classify (non-index commands, or a build that never registered).
const BAM_STALE_SECONDS = 60 * 60 * 24;
// Liveness grace window: on the native-Postgres path we don't trust a "no build running" reading
// until a claimed command has had time to actually start and register in pg_stat_progress_create_index
// (pool latency between claiming the row and issuing the build). Below this age, an in_progress row is
// only reclaimed via the 24h fallback, never via liveness — so a genuinely-running build is never
// yanked out from under itself.
const BAM_LIVENESS_GRACE_SECONDS = 60 * 5;
const JOB_STATES = Object.freeze({
    created: 'created',
    retry: 'retry',
    active: 'active',
    completed: 'completed',
    cancelled: 'cancelled',
    failed: 'failed'
});
const QUEUE_POLICIES = Object.freeze({
    standard: 'standard',
    short: 'short',
    singleton: 'singleton',
    stately: 'stately',
    exclusive: 'exclusive',
    key_strict_fifo: 'key_strict_fifo'
});
const QUEUE_DEFAULTS = {
    expire_seconds: FIFTEEN_MINUTES,
    retention_seconds: FORTEEN_DAYS,
    deletion_seconds: SEVEN_DAYS,
    retry_limit: 2,
    retry_delay: 0,
    warning_queued: 0,
    retry_backoff: false,
    partition: false
};
const COMMON_JOB_TABLE = 'job_common';
function create(schema, version, options) {
    const noPartitioning = options?.noTablePartitioning ?? false;
    const noDeferrable = options?.noDeferrableConstraints ?? false;
    const noLocks = options?.noAdvisoryLocks ?? false;
    const noCovering = options?.noCoveringIndexes ?? false;
    const commands = [
        options?.createSchema ? createSchema(schema) : '',
        createEnumJobState(schema),
        createTableVersion(schema),
        createTableQueue(schema),
        createTableSchedule(schema),
        createTableSubscription(schema),
        createTableBam(schema),
        // Partition-helper functions are only used by the partitioned architecture.
        // They are unused when partitioning is disabled, and job_table_format's
        // IMMUTABLE + format() body is rejected at create time by databases like
        // CockroachDB, so skip them entirely in noTablePartitioning mode.
        noPartitioning ? '' : jobTableFormatFunction(schema),
        noPartitioning ? '' : jobTableRunFunction(schema),
        noPartitioning ? '' : jobTableRunAsyncFunction(schema),
        createTableJob(schema, noPartitioning),
        createPrimaryKeyJob(schema),
        noPartitioning ? createTableJobIndexes(schema, noDeferrable, noCovering) : createTableJobCommon(schema),
        createTableWarning(schema),
        createIndexWarning(schema),
        createTableQueueStats(schema, noPartitioning),
        createIndexQueueStats(schema, noCovering),
        noPartitioning ? '' : ensureQueueStatsPartitions(schema),
        createTableJobDependency(schema),
        createIndexJobDependencyParent(schema),
        createQueueFunction(schema, noPartitioning),
        deleteQueueFunction(schema, noPartitioning),
        insertVersion(schema, version)
    ];
    return locked(schema, commands, undefined, noLocks);
}
function createSchema(schema) {
    return `CREATE SCHEMA IF NOT EXISTS ${schema}`;
}
function createEnumJobState(schema) {
    // ENUM definition order is important
    // base type is numeric and first values are less than last values
    return `
    CREATE TYPE ${schema}.job_state AS ENUM (
      '${JOB_STATES.created}',
      '${JOB_STATES.retry}',
      '${JOB_STATES.active}',
      '${JOB_STATES.completed}',
      '${JOB_STATES.cancelled}',
      '${JOB_STATES.failed}'
    )
  `;
}
function createTableVersion(schema) {
    return `
    CREATE TABLE ${schema}.version (
      version int primary key,
      cron_on timestamp with time zone,
      bam_on timestamp with time zone,
      flow_on timestamp with time zone
    )
  `;
}
function createTableQueue(schema) {
    return `
    CREATE TABLE ${schema}.queue (
      name text NOT NULL,
      policy text NOT NULL,
      retry_limit int NOT NULL,
      retry_delay int NOT NULL,
      retry_backoff bool NOT NULL,
      retry_delay_max int,
      expire_seconds int NOT NULL,
      retention_seconds int NOT NULL,
      deletion_seconds int NOT NULL,
      dead_letter text REFERENCES ${schema}.queue (name) CHECK (dead_letter IS DISTINCT FROM name),
      partition bool NOT NULL,
      table_name text NOT NULL,
      deferred_count int NOT NULL default 0,
      queued_count int NOT NULL default 0,
      ready_count int NOT NULL default 0,
      warning_queued int NOT NULL default 0,
      active_count int NOT NULL default 0,
      failed_count int NOT NULL default 0,
      total_count int NOT NULL default 0,
      ready_history int[] NOT NULL default '{}',
      heartbeat_seconds int,
      notify bool NOT NULL DEFAULT false,
      singletons_active text[],
      monitor_on timestamp with time zone,
      maintain_on timestamp with time zone,
      created_on timestamp with time zone not null default now(),
      updated_on timestamp with time zone not null default now(),
      PRIMARY KEY (name)
    )
  `;
}
function createTableSchedule(schema) {
    return `
    CREATE TABLE ${schema}.schedule (
      name text REFERENCES ${schema}.queue ON DELETE CASCADE,
      key text not null DEFAULT '',
      cron text not null,
      timezone text,
      data jsonb,
      options jsonb,
      created_on timestamp with time zone not null default now(),
      updated_on timestamp with time zone not null default now(),
      PRIMARY KEY (name, key)
    )
  `;
}
function createTableSubscription(schema) {
    return `
    CREATE TABLE ${schema}.subscription (
      event text not null,
      name text not null REFERENCES ${schema}.queue ON DELETE CASCADE,
      created_on timestamp with time zone not null default now(),
      updated_on timestamp with time zone not null default now(),
      PRIMARY KEY(event, name)
    )
  `;
}
function createTableBam(schema) {
    return `
    CREATE TABLE ${schema}.bam (
      id uuid PRIMARY KEY default gen_random_uuid(),
      name text NOT NULL,
      version int NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      queue text,
      table_name text NOT NULL,
      command text NOT NULL,
      error text,
      -- clock_timestamp() (not now()) so multiple job_table_run_async() enqueues within a single
      -- migration transaction keep their insertion order — BAM applies queued commands in created_on
      -- order, and some migrations enqueue an ordered drop-then-rebuild pair (see migration v33).
      created_on timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
      started_on timestamp with time zone,
      completed_on timestamp with time zone
    )
  `;
}
function createTableWarning(schema) {
    return `
    CREATE TABLE ${schema}.warning (
      id uuid PRIMARY KEY default gen_random_uuid(),
      type text NOT NULL,
      message text NOT NULL,
      data jsonb,
      created_on timestamp with time zone NOT NULL DEFAULT now()
    )
  `;
}
function createIndexWarning(schema) {
    return `CREATE INDEX warning_i1 ON ${schema}.warning (created_on DESC)`;
}
function createTableJobDependency(schema) {
    return `
    CREATE TABLE ${schema}.job_dependency (
      child_name text NOT NULL,
      child_id uuid NOT NULL,
      parent_name text NOT NULL,
      parent_id uuid NOT NULL,
      PRIMARY KEY (child_name, child_id, parent_name, parent_id)
    )
  `;
}
function createIndexJobDependencyParent(schema) {
    return `CREATE INDEX IF NOT EXISTS job_dep_parent_idx ON ${schema}.job_dependency (parent_name, parent_id)`;
}
function jobTableFormatFunction(schema) {
    return `
    CREATE FUNCTION ${schema}.job_table_format(command text, table_name text)
    RETURNS text AS
    $$
      SELECT format(
        regexp_replace(
          regexp_replace(command, '\\.job\\y', '.%1$I', 'g'),
          '\\yjob_i(\\d+)', '%1$s_i\\1', 'g'
        ),
        table_name
      );
    $$
    LANGUAGE sql IMMUTABLE;
  `;
}
function jobTableRunFunction(schema) {
    return `
    CREATE FUNCTION ${schema}.job_table_run(command text, tbl_name text DEFAULT NULL, queue_name text DEFAULT NULL)
    RETURNS VOID AS
    $$
    DECLARE
      tbl RECORD;
    BEGIN
      IF queue_name IS NOT NULL THEN
        SELECT table_name INTO tbl_name FROM ${schema}.queue WHERE name = queue_name;
      END IF;

      IF tbl_name IS NOT NULL THEN
        EXECUTE ${schema}.job_table_format(command, tbl_name);
        RETURN;
      END IF;

      EXECUTE ${schema}.job_table_format(command, '${COMMON_JOB_TABLE}');

      FOR tbl IN SELECT table_name FROM ${schema}.queue WHERE partition = true
      LOOP
        EXECUTE ${schema}.job_table_format(command, tbl.table_name);
      END LOOP;
    END;
    $$
    LANGUAGE plpgsql;
  `;
}
function jobTableRunAsyncFunction(schema) {
    return `
    CREATE FUNCTION ${schema}.job_table_run_async(command_name text, version int, command text, tbl_name text DEFAULT NULL, queue_name text DEFAULT NULL)
    RETURNS VOID AS
    $$
    BEGIN
      IF queue_name IS NOT NULL THEN
        SELECT table_name INTO tbl_name FROM ${schema}.queue WHERE name = queue_name;
      END IF;

      IF tbl_name IS NOT NULL THEN
        INSERT INTO ${schema}.bam (name, version, status, queue, table_name, command)
        VALUES (
          command_name,
          version,
          'pending',
          queue_name,
          tbl_name,
          ${schema}.job_table_format(command, tbl_name)
        );
        RETURN;
      END IF;

      INSERT INTO ${schema}.bam (name, version, status, queue, table_name, command)
      SELECT
        command_name,
        version,
        'pending',
        NULL,
        '${COMMON_JOB_TABLE}',
        ${schema}.job_table_format(command, '${COMMON_JOB_TABLE}')
      UNION ALL
      SELECT
        command_name,
        version,
        'pending',
        queue.name,
        queue.table_name,
        ${schema}.job_table_format(command, queue.table_name)
      FROM ${schema}.queue
      WHERE partition = true;
    END;
    $$
    LANGUAGE plpgsql;
  `;
}
function createTableJob(schema, noPartitioning = false) {
    const partitionClause = noPartitioning ? '' : 'PARTITION BY LIST (name)';
    return `
    CREATE TABLE ${schema}.job (
      id uuid not null default gen_random_uuid(),
      name text not null,
      priority integer not null default(0),
      data jsonb,
      state ${schema}.job_state not null default '${JOB_STATES.created}',
      retry_limit integer not null default ${QUEUE_DEFAULTS.retry_limit},
      retry_count integer not null default 0,
      retry_delay integer not null default ${QUEUE_DEFAULTS.retry_delay},
      retry_backoff boolean not null default ${QUEUE_DEFAULTS.retry_backoff},
      retry_delay_max integer,
      expire_seconds int not null default ${QUEUE_DEFAULTS.expire_seconds},
      deletion_seconds int not null default ${QUEUE_DEFAULTS.deletion_seconds},
      singleton_key text,
      singleton_on timestamp without time zone,
      group_id text,
      group_tier text,
      start_after timestamp with time zone not null default now(),
      created_on timestamp with time zone not null default now(),
      started_on timestamp with time zone,
      completed_on timestamp with time zone,
      keep_until timestamp with time zone NOT NULL default now() + interval '${QUEUE_DEFAULTS.retention_seconds}',
      output jsonb,
      dead_letter text,
      policy text,
      heartbeat_on timestamp with time zone,
      heartbeat_seconds int,
      blocked boolean not null default false,
      blocking boolean not null default false,
      pending_dependencies int not null default 0,
      source_name text,
      source_id uuid,
      source_created_on timestamp with time zone,
      source_retry_count int
    ) ${partitionClause}
  `;
}
const JOB_COLUMNS_MIN = 'id, name, data, expire_seconds as "expireInSeconds", heartbeat_seconds as "heartbeatSeconds", group_id as "groupId", group_tier as "groupTier"';
const JOB_COLUMNS_ALL = `${JOB_COLUMNS_MIN},
  policy,
  state,
  priority,
  retry_limit as "retryLimit",
  retry_count as "retryCount",
  retry_delay as "retryDelay",
  retry_backoff as "retryBackoff",
  retry_delay_max as "retryDelayMax",
  start_after as "startAfter",
  started_on as "startedOn",
  singleton_key as "singletonKey",
  singleton_on as "singletonOn",
  deletion_seconds as "deleteAfterSeconds",
  heartbeat_on as "heartbeatOn",
  created_on as "createdOn",
  completed_on as "completedOn",
  keep_until as "keepUntil",
  dead_letter as "deadLetter",
  blocked,
  blocking,
  pending_dependencies as "pendingDependencies",
  output,
  source_name as "sourceName",
  source_id as "sourceId",
  source_created_on as "sourceCreatedOn",
  source_retry_count as "sourceRetryCount"
`;
function createTableJobCommon(schema) {
    return `
    CREATE TABLE ${schema}.${COMMON_JOB_TABLE} (LIKE ${schema}.job INCLUDING GENERATED INCLUDING DEFAULTS);

    SELECT ${schema}.job_table_run($cmd$${createPrimaryKeyJob(schema)}$cmd$, '${COMMON_JOB_TABLE}');
    SELECT ${schema}.job_table_run($cmd$${createQueueForeignKeyJob(schema)}$cmd$, '${COMMON_JOB_TABLE}');
    SELECT ${schema}.job_table_run($cmd$${createQueueForeignKeyJobDeadLetter(schema)}$cmd$, '${COMMON_JOB_TABLE}');
    SELECT ${schema}.job_table_run($cmd$${createIndexJobPolicyShort(schema)}$cmd$, '${COMMON_JOB_TABLE}');
    SELECT ${schema}.job_table_run($cmd$${createIndexJobPolicySingleton(schema)}$cmd$, '${COMMON_JOB_TABLE}');
    SELECT ${schema}.job_table_run($cmd$${createIndexJobPolicyStately(schema)}$cmd$, '${COMMON_JOB_TABLE}');
    SELECT ${schema}.job_table_run($cmd$${createIndexJobPolicyExclusive(schema)}$cmd$, '${COMMON_JOB_TABLE}');
    SELECT ${schema}.job_table_run($cmd$${createIndexJobPolicyKeyStrictFifo(schema)}$cmd$, '${COMMON_JOB_TABLE}');
    SELECT ${schema}.job_table_run($cmd$${createIndexJobPolicyKeyStrictFifoHeads(schema)}$cmd$, '${COMMON_JOB_TABLE}');
    SELECT ${schema}.job_table_run($cmd$${createCheckConstraintKeyStrictFifo(schema)}$cmd$, '${COMMON_JOB_TABLE}');
    SELECT ${schema}.job_table_run($cmd$${createIndexJobThrottle(schema)}$cmd$, '${COMMON_JOB_TABLE}');
    SELECT ${schema}.job_table_run($cmd$${createIndexJobFetch(schema)}$cmd$, '${COMMON_JOB_TABLE}');
    SELECT ${schema}.job_table_run($cmd$${createIndexJobGroupConcurrency(schema)}$cmd$, '${COMMON_JOB_TABLE}');
    SELECT ${schema}.job_table_run($cmd$${createIndexJobBlocking(schema)}$cmd$, '${COMMON_JOB_TABLE}');

    ALTER TABLE ${schema}.job ATTACH PARTITION ${schema}.${COMMON_JOB_TABLE} DEFAULT;
  `;
}
// Creates indexes directly on job table when partitioning is disabled
function createTableJobIndexes(schema, noDeferrableConstraints = false, noCoveringIndex = false) {
    return `
    ${createQueueForeignKeyJob(schema, noDeferrableConstraints)};
    ${createQueueForeignKeyJobDeadLetter(schema, noDeferrableConstraints)};
    ${createIndexJobPolicyShort(schema)};
    ${createIndexJobPolicySingleton(schema)};
    ${createIndexJobPolicyStately(schema)};
    ${createIndexJobPolicyExclusive(schema)};
    ${createIndexJobPolicyKeyStrictFifo(schema)};
    ${createIndexJobPolicyKeyStrictFifoHeads(schema, noCoveringIndex)};
    ${createCheckConstraintKeyStrictFifo(schema)};
    ${createIndexJobThrottle(schema)};
    ${createIndexJobFetch(schema, noCoveringIndex)};
    ${createIndexJobGroupConcurrency(schema)};
    ${createIndexJobBlocking(schema)};
  `;
}
function createQueueFunction(schema, noPartitioning = false) {
    if (noPartitioning) {
        // Simplified version without table partitioning support
        return `
      CREATE FUNCTION ${schema}.create_queue(queue_name text, options jsonb)
      RETURNS VOID AS
      $$
      BEGIN
        INSERT INTO ${schema}.queue (
          name,
          policy,
          retry_limit,
          retry_delay,
          retry_backoff,
          retry_delay_max,
          expire_seconds,
          retention_seconds,
          deletion_seconds,
          warning_queued,
          dead_letter,
          partition,
          table_name,
          heartbeat_seconds
        )
        VALUES (
          queue_name,
          options->>'policy',
          COALESCE((options->>'retryLimit')::int, ${QUEUE_DEFAULTS.retry_limit}),
          COALESCE((options->>'retryDelay')::int, ${QUEUE_DEFAULTS.retry_delay}),
          COALESCE((options->>'retryBackoff')::bool, ${QUEUE_DEFAULTS.retry_backoff}),
          (options->>'retryDelayMax')::int,
          COALESCE((options->>'expireInSeconds')::int, ${QUEUE_DEFAULTS.expire_seconds}),
          COALESCE((options->>'retentionSeconds')::int, ${QUEUE_DEFAULTS.retention_seconds}),
          COALESCE((options->>'deleteAfterSeconds')::int, ${QUEUE_DEFAULTS.deletion_seconds}),
          COALESCE((options->>'warningQueueSize')::int, ${QUEUE_DEFAULTS.warning_queued}),
          options->>'deadLetter',
          false,
          'job',
          (options->>'heartbeatSeconds')::int
        )
        ON CONFLICT DO NOTHING;
      END;
      $$
      LANGUAGE plpgsql;
    `;
    }
    return `
    CREATE FUNCTION ${schema}.create_queue(queue_name text, options jsonb)
    RETURNS VOID AS
    $$
    DECLARE
      tablename varchar := CASE WHEN options->>'partition' = 'true'
                            THEN 'j' || encode(sha224(queue_name::bytea), 'hex')
                            ELSE '${COMMON_JOB_TABLE}'
                            END;
      queue_created_on timestamptz;
    BEGIN

      WITH q as (
        INSERT INTO ${schema}.queue (
          name,
          policy,
          retry_limit,
          retry_delay,
          retry_backoff,
          retry_delay_max,
          expire_seconds,
          retention_seconds,
          deletion_seconds,
          warning_queued,
          dead_letter,
          partition,
          table_name,
          heartbeat_seconds,
          notify
        )
        VALUES (
          queue_name,
          options->>'policy',
          COALESCE((options->>'retryLimit')::int, ${QUEUE_DEFAULTS.retry_limit}),
          COALESCE((options->>'retryDelay')::int, ${QUEUE_DEFAULTS.retry_delay}),
          COALESCE((options->>'retryBackoff')::bool, ${QUEUE_DEFAULTS.retry_backoff}),
          (options->>'retryDelayMax')::int,
          COALESCE((options->>'expireInSeconds')::int, ${QUEUE_DEFAULTS.expire_seconds}),
          COALESCE((options->>'retentionSeconds')::int, ${QUEUE_DEFAULTS.retention_seconds}),
          COALESCE((options->>'deleteAfterSeconds')::int, ${QUEUE_DEFAULTS.deletion_seconds}),
          COALESCE((options->>'warningQueueSize')::int, ${QUEUE_DEFAULTS.warning_queued}),
          options->>'deadLetter',
          COALESCE((options->>'partition')::bool, ${QUEUE_DEFAULTS.partition}),
          tablename,
          (options->>'heartbeatSeconds')::int,
          COALESCE((options->>'notify')::bool, false)
        )
        ON CONFLICT DO NOTHING
        RETURNING created_on
      )
      SELECT created_on into queue_created_on from q;

      IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN
        RETURN;
      END IF;

      EXECUTE format('CREATE TABLE ${schema}.%I (LIKE ${schema}.job INCLUDING DEFAULTS)', tablename);

      EXECUTE ${schema}.job_table_format($cmd$${createPrimaryKeyJob(schema)}$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$${createQueueForeignKeyJob(schema)}$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$${createQueueForeignKeyJobDeadLetter(schema)}$cmd$, tablename);

      EXECUTE ${schema}.job_table_format($cmd$${createIndexJobFetch(schema)}$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$${createIndexJobThrottle(schema)}$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$${createIndexJobGroupConcurrency(schema)}$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$${createIndexJobBlocking(schema)}$cmd$, tablename);

      IF options->>'policy' = 'short' THEN
        EXECUTE ${schema}.job_table_format($cmd$${createIndexJobPolicyShort(schema)}$cmd$, tablename);
      ELSIF options->>'policy' = 'singleton' THEN
        EXECUTE ${schema}.job_table_format($cmd$${createIndexJobPolicySingleton(schema)}$cmd$, tablename);
      ELSIF options->>'policy' = 'stately' THEN
        EXECUTE ${schema}.job_table_format($cmd$${createIndexJobPolicyStately(schema)}$cmd$, tablename);
      ELSIF options->>'policy' = 'exclusive' THEN
        EXECUTE ${schema}.job_table_format($cmd$${createIndexJobPolicyExclusive(schema)}$cmd$, tablename);
      ELSIF options->>'policy' = '${QUEUE_POLICIES.key_strict_fifo}' THEN
        EXECUTE ${schema}.job_table_format($cmd$${createIndexJobPolicyKeyStrictFifo(schema)}$cmd$, tablename);
        EXECUTE ${schema}.job_table_format($cmd$${createIndexJobPolicyKeyStrictFifoHeads(schema)}$cmd$, tablename);
        EXECUTE ${schema}.job_table_format($cmd$${createCheckConstraintKeyStrictFifo(schema)}$cmd$, tablename);
      END IF;

      EXECUTE format('ALTER TABLE ${schema}.%I ADD CONSTRAINT cjc CHECK (name=%L)', tablename, queue_name);
      EXECUTE format('ALTER TABLE ${schema}.job ATTACH PARTITION ${schema}.%I FOR VALUES IN (%L)', tablename, queue_name);
    END;
    $$
    LANGUAGE plpgsql;
  `;
}
function deleteQueueFunction(schema, noPartitioning = false) {
    const deleteJobsSql = noPartitioning ? `DELETE FROM ${schema}.job WHERE name = queue_name;` : `
      SELECT table_name, partition
      FROM ${schema}.queue
      WHERE name = queue_name
      INTO v_table, v_partition;

      IF v_partition THEN
        EXECUTE format('DROP TABLE IF EXISTS ${schema}.%I', v_table);
      ELSE
        EXECUTE format('DELETE FROM ${schema}.%I WHERE name = %L', v_table, queue_name);
      END IF;
    `;
    const declareBlock = noPartitioning ? '' : `
    DECLARE
      v_table varchar;
      v_partition bool;`;
    return `
    CREATE FUNCTION ${schema}.delete_queue(queue_name text)
    RETURNS VOID AS
    $$${declareBlock}
    BEGIN
      ${deleteJobsSql}
      DELETE FROM ${schema}.queue WHERE name = queue_name;
    END;
    $$
    LANGUAGE plpgsql;
  `;
}
function createQueue(schema, name, options, noAdvisoryLocks) {
    const sql = `SELECT ${schema}.create_queue('${name}', '${JSON.stringify(options)}'::jsonb)`;
    return locked(schema, sql, 'create-queue', noAdvisoryLocks);
}
function notifyChannelSql(schema) {
    return `('pgboss_' || left(encode(sha224('${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["normalizeSchemaName"])(schema)}'::bytea), 'hex'), 24))`;
}
function notifyQueue(schema, name) {
    return `SELECT pg_notify(${notifyChannelSql(schema)}, '${name}')`;
}
function deleteQueue(schema, name, noAdvisoryLocks) {
    const sql = `SELECT ${schema}.delete_queue('${name}')`;
    return locked(schema, sql, 'delete-queue', noAdvisoryLocks);
}
function createPrimaryKeyJob(schema) {
    return `ALTER TABLE ${schema}.job ADD PRIMARY KEY (name, id)`;
}
function createQueueForeignKeyJob(schema, noPartitioning = false) {
    const deferrable = noPartitioning ? '' : ' DEFERRABLE INITIALLY DEFERRED';
    return `ALTER TABLE ${schema}.job ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT${deferrable}`;
}
function createQueueForeignKeyJobDeadLetter(schema, noPartitioning = false) {
    const deferrable = noPartitioning ? '' : ' DEFERRABLE INITIALLY DEFERRED';
    return `ALTER TABLE ${schema}.job ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT${deferrable}`;
}
function createIndexJobPolicyShort(schema) {
    return `CREATE UNIQUE INDEX job_i1 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = '${JOB_STATES.created}' AND policy = '${QUEUE_POLICIES.short}'`;
}
function createIndexJobPolicySingleton(schema) {
    return `CREATE UNIQUE INDEX job_i2 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = '${JOB_STATES.active}' AND policy = '${QUEUE_POLICIES.singleton}'`;
}
function createIndexJobPolicyStately(schema) {
    return `CREATE UNIQUE INDEX job_i3 ON ${schema}.job (name, state, COALESCE(singleton_key, '')) WHERE state <= '${JOB_STATES.active}' AND policy = '${QUEUE_POLICIES.stately}'`;
}
function createIndexJobThrottle(schema) {
    return `CREATE UNIQUE INDEX job_i4 ON ${schema}.job (name, singleton_on, COALESCE(singleton_key, '')) WHERE state <> '${JOB_STATES.cancelled}' AND singleton_on IS NOT NULL`;
}
function createIndexJobFetch(schema, noCoveringIndex = false) {
    // No covering INCLUDE: the fetch locks candidate rows with FOR UPDATE ... SKIP LOCKED, which
    // forces heap access, so an index-only scan is impossible and a covering payload would never be
    // read from the index. Confirmed dead weight via EXPLAIN ANALYZE (see examples/index-perf);
    // dropping it shrinks job_i5 on the hot insert path at no read-side cost.
    // noCoveringIndex (the CockroachDB profile flag that stripped the old INCLUDE) is now moot here.
    return `CREATE INDEX job_i5 ON ${schema}.job (name, start_after) WHERE state < '${JOB_STATES.active}' AND NOT blocked`;
}
function createIndexJobPolicyExclusive(schema) {
    return `CREATE UNIQUE INDEX job_i6 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state <= '${JOB_STATES.active}' AND policy = '${QUEUE_POLICIES.exclusive}'`;
}
function createIndexJobPolicyKeyStrictFifo(schema) {
    return `CREATE UNIQUE INDEX job_i8 ON ${schema}.job (name, singleton_key) WHERE state IN ('${JOB_STATES.active}', '${JOB_STATES.retry}', '${JOB_STATES.failed}') AND policy = '${QUEUE_POLICIES.key_strict_fifo}'`;
}
function createIndexJobPolicyKeyStrictFifoHeads(schema, noCoveringIndex = false) {
    // Column order mirrors the strict_fifo_heads ORDER BY (state DESC puts a retry job ahead
    // of created siblings) so the DISTINCT ON head-per-key scan stays an ordered index scan.
    //
    // INCLUDE (start_after) is load-bearing, not a covering-index habit: `policy` and `blocked`
    // are satisfied by the partial predicate, so start_after is the only remaining filter in the
    // heads CTE. Without it every index entry needs a heap fetch and the scan degrades from an
    // Index Only Scan to an Index Scan (measured at 200k queued rows / 2,000 keys: 47ms -> 111ms,
    // ~400k extra buffer hits). It costs no HOT updates that job_i5 doesn't already cost, since
    // job_i5 indexes start_after too, and it only widens a partial index that key_strict_fifo
    // rows enter. Backends without covering indexes (the CockroachDB profile) fall back to the
    // narrow form and pay the heap fetches; they take a different fetch path anyway (noSkipLocked).
    const include = noCoveringIndex ? '' : ' INCLUDE (start_after)';
    return `CREATE INDEX job_i10 ON ${schema}.job (name, singleton_key, state DESC, created_on, id)${include} WHERE state < '${JOB_STATES.active}' AND NOT blocked AND policy = '${QUEUE_POLICIES.key_strict_fifo}'`;
}
function createCheckConstraintKeyStrictFifo(schema) {
    return `ALTER TABLE ${schema}.job ADD CONSTRAINT job_key_strict_fifo_singleton_key_check CHECK (NOT (policy = '${QUEUE_POLICIES.key_strict_fifo}' AND singleton_key IS NULL))`;
}
function createIndexJobGroupConcurrency(schema) {
    return `CREATE INDEX job_i7 ON ${schema}.job (name, group_id) WHERE state = '${JOB_STATES.active}' AND group_id IS NOT NULL`;
}
// Partial index supporting the background flow resolver (Navigator): lets it find completed
// blocking parents with an index scan instead of a partition-wide scan. The `state = completed`
// predicate keeps still-running and permanently-failed blocking parents out of the index, so
// non-flow queues (and high-partition-count deployments) carry an empty index that costs nothing.
function createIndexJobBlocking(schema) {
    return `CREATE INDEX job_i9 ON ${schema}.job (name, id) WHERE blocking AND state = '${JOB_STATES.completed}'`;
}
function trySetQueueMonitorTime(schema, queues, seconds) {
    return trySetQueueTimestamp(schema, queues, 'monitor_on', seconds);
}
function trySetQueueDeletionTime(schema, queues, seconds) {
    return trySetQueueTimestamp(schema, queues, 'maintain_on', seconds);
}
function trySetCronTime(schema, seconds) {
    return trySetTimestamp(schema, 'cron_on', seconds);
}
function trySetBamTime(schema, seconds) {
    return trySetTimestamp(schema, 'bam_on', seconds);
}
function trySetFlowTime(schema, seconds) {
    return trySetTimestamp(schema, 'flow_on', seconds);
}
function trySetTimestamp(schema, column, seconds) {
    return `
    UPDATE ${schema}.version
    SET ${column} = now()
    WHERE EXTRACT( EPOCH FROM (now() - COALESCE(${column}, now() - interval '1 week') ) ) > ${seconds}
    RETURNING true
  `;
}
function trySetQueueTimestamp(schema, queues, column, seconds) {
    return {
        text: `
    UPDATE ${schema}.queue
    SET ${column} = now()
    WHERE name = ANY($1::text[])
      AND EXTRACT( EPOCH FROM (now() - COALESCE(${column}, now() - interval '1 week') ) ) > ${seconds}
    RETURNING name
  `,
        values: [
            queues
        ]
    };
}
function updateQueue(schema) {
    return `
    WITH options as (SELECT $2::jsonb as data)
    UPDATE ${schema}.queue SET
      retry_limit = COALESCE((o.data->>'retryLimit')::int, retry_limit),
      retry_delay = COALESCE((o.data->>'retryDelay')::int, retry_delay),
      retry_backoff = COALESCE((o.data->>'retryBackoff')::bool, retry_backoff),
      retry_delay_max = CASE WHEN jsonb_exists(o.data, 'retryDelayMax')
        THEN (o.data->>'retryDelayMax')::int
        ELSE retry_delay_max END,
      expire_seconds = COALESCE((o.data->>'expireInSeconds')::int, expire_seconds),
      retention_seconds = COALESCE((o.data->>'retentionSeconds')::int, retention_seconds),
      deletion_seconds = COALESCE((o.data->>'deleteAfterSeconds')::int, deletion_seconds),
      warning_queued = COALESCE((o.data->>'warningQueueSize')::int, warning_queued),
      heartbeat_seconds = CASE WHEN jsonb_exists(o.data, 'heartbeatSeconds')
        THEN (o.data->>'heartbeatSeconds')::int
        ELSE heartbeat_seconds END,
      notify = COALESCE((o.data->>'notify')::bool, notify),
      dead_letter = CASE WHEN jsonb_exists(o.data, 'deadLetter')
        THEN o.data->>'deadLetter'
        ELSE dead_letter END,
      updated_on = now()
    FROM options o
    WHERE name = $1
  `;
}
function getQueues(schema, names) {
    const hasNames = names && names.length > 0;
    return {
        text: `
    SELECT
      q.name,
      q.policy,
      q.retry_limit as "retryLimit",
      q.retry_delay as "retryDelay",
      q.retry_backoff as "retryBackoff",
      q.retry_delay_max as "retryDelayMax",
      q.expire_seconds as "expireInSeconds",
      q.retention_seconds as "retentionSeconds",
      q.deletion_seconds as "deleteAfterSeconds",
      q.partition,
      q.heartbeat_seconds as "heartbeatSeconds",
      q.notify,
      q.dead_letter as "deadLetter",
      q.deferred_count as "deferredCount",
      q.warning_queued as "warningQueueSize",
      q.queued_count as "queuedCount",
      q.ready_count as "readyCount",
      q.active_count as "activeCount",
      q.failed_count as "failedCount",
      q.total_count as "totalCount",
      q.singletons_active as "singletonsActive",
      q.table_name as "table",
      q.created_on as "createdOn",
      q.updated_on as "updatedOn"
    FROM ${schema}.queue q
    ${hasNames ? 'WHERE q.name = ANY($1::text[])' : ''}
   `,
        values: hasNames ? [
            names
        ] : []
    };
}
function deleteJobsById(schema, table) {
    return `
    WITH results as (
      DELETE FROM ${schema}.${table}
      WHERE name = $1
        AND id = ANY($2::uuid[])
      RETURNING 1
    )
    SELECT COUNT(*) from results
  `;
}
function deleteQueuedJobs(schema, table) {
    return `DELETE from ${schema}.${table} WHERE name = $1 and state < '${JOB_STATES.active}'`;
}
function deleteStoredJobs(schema, table) {
    return `DELETE from ${schema}.${table} WHERE name = $1 and state > '${JOB_STATES.active}'`;
}
function truncateTable(schema, table) {
    return `TRUNCATE ${schema}.${table}`;
}
function deleteAllJobs(schema, table) {
    return `DELETE from ${schema}.${table} WHERE name = $1`;
}
function getSchedules(schema) {
    return `SELECT * FROM ${schema}.schedule ORDER BY name, key`;
}
function getSchedulesByQueue(schema) {
    return `SELECT * FROM ${schema}.schedule WHERE name = $1 ORDER BY key`;
}
function getSchedulesByQueueAndKey(schema) {
    return `SELECT * FROM ${schema}.schedule WHERE name = $1 AND COALESCE(key, '') = $2`;
}
function schedule(schema) {
    return `
    INSERT INTO ${schema}.schedule (name, key, cron, timezone, data, options)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (name, key) DO UPDATE SET
      cron = EXCLUDED.cron,
      timezone = EXCLUDED.timezone,
      data = EXCLUDED.data,
      options = EXCLUDED.options,
      updated_on = now()
  `;
}
function unschedule(schema) {
    return `
    DELETE FROM ${schema}.schedule
    WHERE name = $1
      AND COALESCE(key, '') = $2
  `;
}
function subscribe(schema) {
    return `
    INSERT INTO ${schema}.subscription (event, name)
    VALUES ($1, $2)
    ON CONFLICT (event, name) DO UPDATE SET
      event = EXCLUDED.event,
      name = EXCLUDED.name,
      updated_on = now()
  `;
}
function unsubscribe(schema) {
    return `
    DELETE FROM ${schema}.subscription
    WHERE event = $1 and name = $2
  `;
}
function getQueuesForEvent(schema) {
    return `
    SELECT name FROM ${schema}.subscription
    WHERE event = $1
  `;
}
function getTime() {
    return "SELECT round(date_part('epoch', now()) * 1000) as time";
}
function insertWarning(schema) {
    return `
    INSERT INTO ${schema}.warning (type, message, data)
    VALUES ($1, $2, $3)
  `;
}
function getWarnings(schema) {
    return `
    SELECT
      id,
      type,
      message,
      data,
      created_on as "createdOn"
    FROM ${schema}.warning
    WHERE ($1::text IS NULL OR type = $1)
    ORDER BY created_on DESC
    LIMIT $2 OFFSET $3
  `;
}
function getWarningsCount(schema) {
    return `
    SELECT COUNT(*)::int as count
    FROM ${schema}.warning
    WHERE ($1::text IS NULL OR type = $1)
  `;
}
function deleteOldWarnings(schema, days) {
    return `
    DELETE FROM ${schema}.warning
    WHERE created_on < now() - interval '${days} days'
  `;
}
function createTableQueueStats(schema, noPartitioning = false) {
    return `
    CREATE TABLE ${schema}.queue_stats (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      name text NOT NULL,
      deferred_count int NOT NULL DEFAULT 0,
      queued_count   int NOT NULL DEFAULT 0,
      ready_count    int NOT NULL DEFAULT 0,
      active_count   int NOT NULL DEFAULT 0,
      failed_count   int NOT NULL DEFAULT 0,
      total_count    int NOT NULL DEFAULT 0,
      captured_on timestamptz NOT NULL DEFAULT now(),
      ${noPartitioning ? 'PRIMARY KEY (id)' : 'PRIMARY KEY (id, captured_on)'}
    ) ${noPartitioning ? '' : 'PARTITION BY RANGE (captured_on)'}
  `;
}
function createIndexQueueStats(schema, noCoveringIndex = false) {
    const include = noCoveringIndex ? '' : 'INCLUDE (deferred_count, queued_count, ready_count, active_count, failed_count, total_count)';
    return `CREATE INDEX queue_stats_i1 ON ${schema}.queue_stats (name, captured_on DESC) ${include}`;
}
function ensureQueueStatsPartitions(schema) {
    return `
    DO $$
    DECLARE
      d date;
      i int;
      part_name text;
    BEGIN
      FOR i IN 0..1 LOOP
        d := (now() AT TIME ZONE 'UTC')::date + i;
        part_name := 'queue_stats_' || to_char(d, 'YYYYMMDD');
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = '${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveSchemaName"])(schema)}' AND c.relname = part_name
        ) THEN
          EXECUTE format(
            'CREATE TABLE ${schema}.%I PARTITION OF ${schema}.queue_stats FOR VALUES FROM (%L) TO (%L)',
            part_name,
            to_char(d, 'YYYY-MM-DD') || ' 00:00:00+00',
            to_char(d + 1, 'YYYY-MM-DD') || ' 00:00:00+00'
          );
        END IF;
      END LOOP;
    END;
    $$
  `;
}
function dropOldQueueStatsPartitions(schema, days) {
    return `
    DO $$
    DECLARE
      r record;
      cutoff date := (now() AT TIME ZONE 'UTC')::date - ${days};
      suffix text;
      part_date date;
    BEGIN
      FOR r IN
        SELECT c.relname
        FROM pg_inherits i
        JOIN pg_class p ON p.oid = i.inhparent
        JOIN pg_class c ON c.oid = i.inhrelid
        JOIN pg_namespace n ON n.oid = p.relnamespace
        WHERE n.nspname = '${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveSchemaName"])(schema)}' AND p.relname = 'queue_stats'
      LOOP
        suffix := substring(r.relname FROM 'queue_stats_(.*)$');
        IF suffix ~ '^[0-9]{8}$' THEN
          part_date := to_date(suffix, 'YYYYMMDD');
          IF part_date < cutoff THEN
            EXECUTE 'DROP TABLE IF EXISTS ${schema}.' || quote_ident(r.relname);
          END IF;
        END IF;
      END LOOP;
    END;
    $$
  `;
}
function deleteOldQueueStats(schema, days) {
    return `
    DELETE FROM ${schema}.queue_stats
    WHERE captured_on < now() - interval '${days} days'
  `;
}
function insertQueueStats(schema, queues, noAdvisoryLocks) {
    const sql = `
    INSERT INTO ${schema}.queue_stats
      (name, deferred_count, queued_count, ready_count, active_count, failed_count, total_count)
    SELECT name, deferred_count, queued_count, ready_count, active_count, failed_count, total_count
    FROM ${schema}.queue
    WHERE name = ANY(${serializeArrayParam(queues)})
  `;
    return locked(schema, sql, 'queue-stats-insert', noAdvisoryLocks);
}
function getQueueStatsCache(schema) {
    return `
    SELECT
      name,
      deferred_count as "deferredCount",
      queued_count   as "queuedCount",
      ready_count    as "readyCount",
      active_count   as "activeCount",
      failed_count   as "failedCount",
      total_count    as "totalCount",
      table_name     as "table",
      monitor_on     as "capturedOn"
    FROM ${schema}.queue
    WHERE name = $1
  `;
}
function getQueueStatsHistory(schema) {
    return `
    SELECT
      name,
      deferred_count as "deferredCount",
      queued_count   as "queuedCount",
      ready_count    as "readyCount",
      active_count   as "activeCount",
      failed_count   as "failedCount",
      total_count    as "totalCount",
      captured_on    as "capturedOn"
    FROM ${schema}.queue_stats
    WHERE name = $1
      AND ($2::timestamptz IS NULL OR captured_on >= $2)
      AND ($3::timestamptz IS NULL OR captured_on <= $3)
    ORDER BY captured_on DESC
    LIMIT $4
  `;
}
// Per-bucket aggregate over a count column. The function name can't be a bind parameter, so it's
// interpolated — safe because the manager validates `aggregate` against this whitelist first. Every
// result is cast back to int: it honors the int count contract (avg rounds) and keeps Postgres
// returning the value as a JS number rather than a numeric string.
const STATS_AGG = {
    max: (c)=>`max(${c})::int`,
    min: (c)=>`min(${c})::int`,
    avg: (c)=>`round(avg(${c}))::int`
};
function getQueueStatsHistoryBucketed(schema, aggregate, mode) {
    const agg = STATS_AGG[aggregate];
    const widthCte = mode === 'auto' ? `WITH extent AS (
         SELECT min(captured_on) AS lo, max(captured_on) AS hi
         FROM ${schema}.queue_stats
         WHERE name = $1
       ),
       bounds AS (
         SELECT
           greatest(coalesce($2::timestamptz, lo), lo) AS lo,
           least(coalesce($3::timestamptz, hi), hi)    AS hi
         FROM extent
       ),
       w AS (
         SELECT greatest(1, ceil(extract(epoch from (hi - lo)) / greatest($5, 1))::bigint)::bigint AS secs
         FROM bounds
       )` : 'WITH w AS (SELECT greatest($5, 1)::bigint AS secs)';
    // Hard-cap auto-mode at maxDataPoints. Epoch-aligned bucketing can straddle a boundary and emit
    // one bucket more than the target, so cap the row count at the smaller of the user's limit and
    // maxDataPoints. ORDER BY DESC means the cap drops the oldest (straddle) bucket and keeps the
    // newest N. Explicit bucketSeconds has no target to overshoot, so it keeps the raw limit.
    const limit = mode === 'auto' ? 'least($4, $5)' : '$4';
    return `
    ${widthCte}
    SELECT
      to_timestamp(floor(extract(epoch from captured_on) / w.secs) * w.secs) as "capturedOn",
      ${agg('deferred_count')} as "deferredCount",
      ${agg('queued_count')}   as "queuedCount",
      ${agg('ready_count')}    as "readyCount",
      ${agg('active_count')}   as "activeCount",
      ${agg('failed_count')}   as "failedCount",
      ${agg('total_count')}    as "totalCount"
    FROM ${schema}.queue_stats, w
    WHERE name = $1
      AND ($2::timestamptz IS NULL OR captured_on >= $2)
      AND ($3::timestamptz IS NULL OR captured_on <= $3)
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT ${limit}
  `;
}
function getVersion(schema) {
    return `SELECT version from ${schema}.version`;
}
function setVersion(schema, version) {
    return `UPDATE ${schema}.version SET version = '${version}'`;
}
function versionTableExists(schema) {
    return `SELECT to_regclass('${schema}.version') as name`;
}
function getSchemaCaseVariants(schema) {
    const resolved = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveSchemaName"])(schema).replace(SINGLE_QUOTE_REGEX, "''");
    return `
    SELECT n.nspname as name
    FROM pg_namespace n
    JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = 'version' AND c.relkind IN ('r', 'p')
    WHERE lower(n.nspname) = lower('${resolved}') AND n.nspname <> '${resolved}'
    ORDER BY n.nspname
  `;
}
function getPartitionedQueueTables(schema) {
    return `SELECT table_name, policy FROM ${schema}.queue WHERE partition = true`;
}
function insertVersion(schema, version) {
    return `INSERT INTO ${schema}.version(version) VALUES ('${version}')`;
}
function buildFetchParams(options) {
    const { ignoreSingletons, ignoreGroups, groupConcurrency, minPriority, maxPriority } = options;
    const hasIgnoreSingletons = ignoreSingletons != null && ignoreSingletons.length > 0;
    const hasIgnoreGroups = ignoreGroups != null && ignoreGroups.length > 0;
    const hasGroupConcurrency = groupConcurrency != null;
    const hasMinPriority = minPriority != null;
    const hasMaxPriority = maxPriority != null;
    const groupConcurrencyConfig = hasGroupConcurrency ? typeof groupConcurrency === 'number' ? {
        default: groupConcurrency
    } : groupConcurrency : null;
    const hasTiers = groupConcurrencyConfig?.tiers && Object.keys(groupConcurrencyConfig.tiers).length > 0;
    const values = [];
    let paramIndex = 0;
    let ignoreSingletonsParam = '';
    let ignoreGroupsParam = '';
    let defaultGroupLimitParam = '';
    let tiersParam = '';
    let minPriorityParam = '';
    let maxPriorityParam = '';
    if (hasIgnoreSingletons) {
        paramIndex++;
        ignoreSingletonsParam = `$${paramIndex}::text[]`;
        // job_i2/job_i3 key singleton/stately jobs on the empty key (COALESCE(singleton_key, ''))
        // as one slot, so a keyless active job must block keyless pending jobs the same way a keyed
        // one blocks its key. Map null -> '' here so the WHERE clause's COALESCE comparison (below)
        // never has to compare against a literal NULL array element, which would make `<> ALL(...)`
        // evaluate to NULL (excluding every row) instead of the intended per-key filter.
        values.push(ignoreSingletons.map((key)=>key ?? ''));
    }
    if (hasIgnoreGroups) {
        paramIndex++;
        ignoreGroupsParam = `$${paramIndex}::text[]`;
        values.push(ignoreGroups);
    }
    if (hasGroupConcurrency && groupConcurrencyConfig) {
        paramIndex++;
        defaultGroupLimitParam = `$${paramIndex}::int`;
        values.push(groupConcurrencyConfig.default);
        if (hasTiers) {
            paramIndex++;
            tiersParam = `$${paramIndex}::jsonb`;
            values.push(JSON.stringify(groupConcurrencyConfig.tiers));
        }
    }
    if (hasMinPriority) {
        paramIndex++;
        minPriorityParam = `$${paramIndex}::int`;
        values.push(minPriority);
    }
    if (hasMaxPriority) {
        paramIndex++;
        maxPriorityParam = `$${paramIndex}::int`;
        values.push(maxPriority);
    }
    return {
        values,
        ignoreSingletonsParam,
        ignoreGroupsParam,
        defaultGroupLimitParam,
        tiersParam,
        minPriorityParam,
        maxPriorityParam
    };
}
function fetchNextJob(options, noSkipLocked = false) {
    const { schema, table, name, policy, limit, includeMetadata, priority = true, orderByCreatedOn = true, ignoreStartAfter = false, groupConcurrency, minPriority, maxPriority } = options;
    const keyStrictFifo = policy === QUEUE_POLICIES.key_strict_fifo;
    const singletonFetch = limit > 1 && (policy === QUEUE_POLICIES.singleton || policy === QUEUE_POLICIES.stately);
    const hasIgnoreSingletons = options.ignoreSingletons != null && options.ignoreSingletons.length > 0;
    const hasIgnoreGroups = options.ignoreGroups != null && options.ignoreGroups.length > 0;
    const hasGroupConcurrency = groupConcurrency != null;
    const hasMinPriority = minPriority != null;
    const hasMaxPriority = maxPriority != null;
    const groupConcurrencyConfig = hasGroupConcurrency ? typeof groupConcurrency === 'number' ? {
        default: groupConcurrency
    } : groupConcurrency : null;
    const hasTiers = hasGroupConcurrency && groupConcurrencyConfig?.tiers && Object.keys(groupConcurrencyConfig.tiers).length > 0;
    const hasSingleGroupConcurrency = hasGroupConcurrency && !hasTiers && groupConcurrencyConfig?.default === 1;
    const hasActiveGroupCounts = hasGroupConcurrency && !hasSingleGroupConcurrency;
    const params = buildFetchParams(options);
    const groupLimit = hasTiers ? `COALESCE((${params.tiersParam} ->> group_tier)::int, ${params.defaultGroupLimitParam})` : params.defaultGroupLimitParam;
    const activeGroupCountExpression = hasActiveGroupCounts ? 'COALESCE(((SELECT counts FROM active_group_count_map) ->> j.group_id)::int, 0)' : '';
    const selectCols = [
        'j.id',
        singletonFetch ? 'j.singleton_key' : '',
        hasGroupConcurrency ? 'j.group_id, j.group_tier' : '',
        hasActiveGroupCounts ? `${activeGroupCountExpression} as active_cnt` : ''
    ].filter(Boolean).join(', ');
    // For limits above 1, aggregate active counts into a single JSONB value. Each
    // candidate uses a keyed lookup through an uncorrelated InitPlan, so the planner
    // cannot turn stale active-group estimates into a per-candidate relation scan.
    const activeGroupCountMapCte = hasActiveGroupCounts ? `active_group_count_map AS MATERIALIZED (
        SELECT COALESCE(jsonb_object_agg(group_id, active_cnt), '{}'::jsonb) as counts
        FROM (
          SELECT group_id, COUNT(*)::int as active_cnt
          FROM ${schema}.${table}
          WHERE name = '${name}' AND state = '${JOB_STATES.active}' AND group_id IS NOT NULL
          GROUP BY group_id
        ) active_groups
      ), ` : '';
    // With noSkipLocked, omit FOR UPDATE SKIP LOCKED as it performs poorly
    // in distributed databases like CockroachDB
    const lockClause = noSkipLocked ? '' : 'FOR UPDATE OF j SKIP LOCKED';
    // Column references are qualified with j. throughout so both the base case and
    // the groupConcurrency branches share one set of expressions.
    const groupConcurrencyFilter = hasGroupConcurrency ? hasSingleGroupConcurrency ? `(j.group_id IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM ${schema}.${table} active_group_probe
              WHERE active_group_probe.name = '${name}'
                AND active_group_probe.state = '${JOB_STATES.active}'
                AND active_group_probe.group_id IS NOT NULL
                AND active_group_probe.group_id = j.group_id
            ))` : `(j.group_id IS NULL
            OR ${activeGroupCountExpression} < ${groupLimit})` : '';
    // state DESC (retry > created in the enum) makes a retry job its key's head. job_i8
    // guarantees at most one job per key in active/retry/failed, and the NOT EXISTS blocker
    // below rejects every sibling of a retry job — so if created_on picked the head, an older
    // deferred job whose start_after has since arrived would claim the head slot while being
    // unfetchable, and the retry job (fetchable but not the head) would deadlock the key.
    const strictFifoHeadsCte = keyStrictFifo ? `strict_fifo_heads AS MATERIALIZED (
        SELECT DISTINCT ON (h.singleton_key) h.id
        FROM ${schema}.${table} h
        WHERE h.name = '${name}'
          AND h.state < '${JOB_STATES.active}'
          AND NOT h.blocked
          AND h.policy = '${QUEUE_POLICIES.key_strict_fifo}'
          ${!ignoreStartAfter ? 'AND h.start_after <= now()' : ''}
        ORDER BY h.singleton_key, h.state DESC, h.created_on, h.id
      ), ` : '';
    const whereConditions = [
        `j.name = '${name}'`,
        `j.state < '${JOB_STATES.active}'`,
        'NOT j.blocked',
        // `<=` (not `<`) so a job inserted with the default start_after = now() is immediately
        // fetchable in the next statement. `now()` is transaction-scoped; on backends with coarse
        // clock resolution (notably PGlite) consecutive autocommit statements often share the same
        // timestamp, so `<` would leave freshly-inserted jobs invisible until the clock ticks.
        // NOTIFY gating already uses `start_after <= now()` for the same reason.
        !ignoreStartAfter ? 'j.start_after <= now()' : '',
        keyStrictFifo ? 'j.id IN (SELECT id FROM strict_fifo_heads)' : '',
        keyStrictFifo ? `NOT EXISTS (
            SELECT 1
            FROM ${schema}.${table} b
            WHERE b.name = j.name
              AND b.singleton_key = j.singleton_key
              AND b.state IN ('${JOB_STATES.active}', '${JOB_STATES.retry}', '${JOB_STATES.failed}')
              AND b.policy = '${QUEUE_POLICIES.key_strict_fifo}'
              AND b.id <> j.id
          )` : '',
        hasIgnoreSingletons ? `COALESCE(j.singleton_key, '') <> ALL(${params.ignoreSingletonsParam})` : '',
        hasIgnoreGroups ? `(j.group_id IS NULL OR j.group_id <> ALL(${params.ignoreGroupsParam}))` : '',
        hasMinPriority ? `j.priority >= ${params.minPriorityParam}` : '',
        hasMaxPriority ? `j.priority <= ${params.maxPriorityParam}` : '',
        groupConcurrencyFilter
    ].filter(Boolean).join('\n          AND ');
    const nextCte = `
      next AS (
        SELECT ${selectCols}
        FROM ${schema}.${table} j
        WHERE ${whereConditions}
        ORDER BY ${priority ? 'j.priority desc, ' : ''}${orderByCreatedOn ? 'j.created_on, ' : ''}j.id
        LIMIT ${limit}
        ${lockClause}
      )`;
    const singletonCte = singletonFetch ? `, singleton_ranking AS (
        SELECT id, ${hasGroupConcurrency ? 'group_id, group_tier, ' : ''}${hasActiveGroupCounts ? 'active_cnt, ' : ''}
          row_number() OVER (PARTITION BY singleton_key) as singleton_rn
        FROM next
      )` : '';
    const groupConcurrencyCtes = hasGroupConcurrency ? `,
      group_ranking AS (
        SELECT t.id
          , t.group_id
          , t.group_tier
          ${singletonFetch ? ', singleton_rn' : ''}
          , ROW_NUMBER() OVER (PARTITION BY t.group_id ORDER BY t.id) as group_rn
          , ${hasActiveGroupCounts ? 't.active_cnt' : '0'} as active_cnt
        FROM ${singletonFetch ? 'singleton_ranking' : 'next'} t
        ${singletonFetch ? 'WHERE singleton_rn = 1' : ''}
      ),
      group_filtered AS (
        SELECT id FROM group_ranking
        WHERE group_id IS NULL
          OR (active_cnt + group_rn) <= ${groupLimit}
      )` : '';
    const finalCte = hasGroupConcurrency ? 'group_filtered' : singletonFetch ? 'singleton_ranking' : 'next';
    // An uncorrelated array InitPlan makes the selected ids a one-time input to the
    // UPDATE. Without it, stale estimates can make Postgres put the inlined ranking
    // query on the inner side of a nested loop and execute it once per job table row.
    const updateSource = hasGroupConcurrency ? '' : `FROM ${finalCte}`;
    const updateMatch = hasGroupConcurrency ? `j.id = ANY (ARRAY(SELECT id FROM ${finalCte}))` : `j.id = ${finalCte}.id`;
    // Without SKIP LOCKED, add a state check to prevent duplicate processing
    // when multiple workers try to claim the same jobs concurrently
    const distributedStateCheck = noSkipLocked ? `AND j.state < '${JOB_STATES.active}'` : '';
    return {
        text: `
      WITH
      ${strictFifoHeadsCte}
      ${activeGroupCountMapCte}
      ${nextCte}
      ${singletonCte}
      ${groupConcurrencyCtes}
      UPDATE ${schema}.${table} j SET
        state = '${JOB_STATES.active}',
        started_on = now(),
        heartbeat_on = now(),
        retry_count = CASE WHEN started_on IS NOT NULL THEN retry_count + 1 ELSE retry_count END
      ${updateSource}
      WHERE name = '${name}' AND ${updateMatch}
      ${singletonFetch && !hasGroupConcurrency ? 'AND singleton_rn = 1' : ''}
      ${distributedStateCheck}
      RETURNING j.${includeMetadata ? JOB_COLUMNS_ALL : JOB_COLUMNS_MIN}
    `,
        values: params.values
    };
}
// Shared SET/WHERE body for marking jobs completed (no RETURNING). Used by the
// single-statement completeJobs() and the distributed completeJobsDistributed().
function completeJobsUpdate(schema, table, includeQueued) {
    return `UPDATE ${schema}.${table}
      SET completed_on = now(),
        state = '${JOB_STATES.completed}',
        output = $3::jsonb,
        blocked = ${includeQueued ? 'false' : 'blocked'},
        pending_dependencies = ${includeQueued ? '0' : 'pending_dependencies'}
      WHERE name = $1
        AND id = ANY($2::uuid[])
        AND ${includeQueued ? `state < '${JOB_STATES.completed}'` : `state = '${JOB_STATES.active}'`}`;
}
// Shared dependency-unblocking fragments. Both consume a `decremented` CTE
// (child_name, child_id, n) that the caller defines, and are reused by the standard
// completeJobs() and the distributed decrementDependents().
function lockedChildrenCte(schema) {
    return `locked_children AS (
      SELECT j.name, j.id, d.n
      FROM ${schema}.job j
      JOIN decremented d ON d.child_name = j.name
        AND d.child_id = j.id
      WHERE j.blocked
      ORDER BY j.name, j.id
      FOR UPDATE OF j
    )`;
}
function unblockChildrenUpdate(schema) {
    return `UPDATE ${schema}.job j
      SET pending_dependencies = GREATEST(j.pending_dependencies - lc.n, 0),
          blocked = GREATEST(j.pending_dependencies - lc.n, 0) > 0
      FROM locked_children lc
      WHERE j.name = lc.name
        AND j.id = lc.id`;
}
function completeJobs(schema, table, includeQueued) {
    return `
    WITH results AS (
      ${completeJobsUpdate(schema, table, includeQueued)}
      RETURNING 1
    )
    SELECT COUNT(*) FROM results
  `;
}
function completeJobsWithOutputs(schema, table) {
    return `
    WITH input AS (
      SELECT * FROM json_to_recordset($2::json) AS x (id uuid, output jsonb)
    ),
    results AS (
      UPDATE ${schema}.${table} j
      SET completed_on = now(),
        state = '${JOB_STATES.completed}',
        output = i.output
      FROM input i
      WHERE j.name = $1
        AND j.id = i.id
        AND j.state = '${JOB_STATES.active}'
      RETURNING 1
    )
    SELECT COUNT(*) FROM results
  `;
}
function completeJobsWithOutputsDistributed(schema, table) {
    return `
    WITH input AS (
      SELECT * FROM json_to_recordset($2::json) AS x (id uuid, output jsonb)
    )
    UPDATE ${schema}.${table} j
    SET completed_on = now(),
      state = '${JOB_STATES.completed}',
      output = i.output
    FROM input i
    WHERE j.name = $1
      AND j.id = i.id
      AND j.state = '${JOB_STATES.active}'
    RETURNING j.id
  `;
}
function cancelJobs(schema, table) {
    return `
    WITH results as (
      UPDATE ${schema}.${table}
      SET completed_on = now(),
        state = '${JOB_STATES.cancelled}'
      WHERE name = $1
        AND id = ANY($2::uuid[])
        AND state < '${JOB_STATES.completed}'
      RETURNING 1
    )
    SELECT COUNT(*) from results
  `;
}
function resumeJobs(schema, table) {
    return `
    WITH results as (
      UPDATE ${schema}.${table}
      SET completed_on = NULL,
        state = '${JOB_STATES.created}'
      WHERE name = $1
        AND id = ANY($2::uuid[])
        AND state = '${JOB_STATES.cancelled}'
      RETURNING 1
    )
    SELECT COUNT(*) from results
  `;
}
function restoreJobs(schema, table) {
    return `
    UPDATE ${schema}.${table}
    SET state = '${JOB_STATES.created}',
        started_on = NULL,
        heartbeat_on = NULL
    WHERE name = $1
      AND id = ANY($2::uuid[])
  `;
}
// A `startAfter` string is either an absolute date time or a delay expressed as a Postgres
// interval. A trailing 'Z' has always marked a date time; a leading ISO 8601 calendar date
// (YYYY-MM-DD) marks one as well, which is what lets the other 8601 zone designators through
// ('+00:00', '+05:30', '-08:00') along with zone-less and date-only strings — all of which
// used to reach the interval cast and fail as 'invalid input syntax for type interval'.
//
// Recognition is only ever widened, so anything that resolves as an interval today still
// does: bare seconds ('0', '300'), phrases ('5 minutes'), ISO 8601 durations ('PT1H') and
// the year-month form ('2027-01', which Postgres reads as 2027 years 1 mon) carry neither
// mark. A date time with an explicit offset resolves to that exact instant.
//
// A zone-less date time would otherwise be cast in the database session's TimeZone, so the
// public entry points pin it to UTC before it gets here (Attorney.pinZonelessDateTime). This
// cast is still session-TZ dependent for anything that reaches it unpinned, which is why the
// pin lives at the boundary rather than in this expression: a caller may legitimately pass a
// form Postgres resolves itself ('2027-01-01 08:00:00 America/New_York'), and rewriting those
// in SQL would mean re-implementing timestamp parsing in a regex.
function isDateTimeString(expression) {
    return `(right(${expression}, 1) = 'Z' OR ${expression} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}')`;
}
function insertJobs(schema, { table, name, returnId = true, notify = false }) {
    // When notify is enabled we always RETURN start_after so the wrapper below can gate
    // the NOTIFY on immediate availability, regardless of whether the caller wants ids.
    const returning = notify ? 'RETURNING id, start_after' : returnId ? 'RETURNING id' : '';
    const insert = `
    INSERT INTO ${schema}.${table} (
      id,
      name,
      data,
      priority,
      start_after,
      singleton_key,
      singleton_on,
      group_id,
      group_tier,
      expire_seconds,
      deletion_seconds,
      keep_until,
      retry_limit,
      retry_delay,
      retry_backoff,
      retry_delay_max,
      policy,
      dead_letter,
      heartbeat_seconds,
      blocked,
      blocking,
      pending_dependencies
    )
    SELECT
      COALESCE(id, gen_random_uuid()) as id,
      '${name}' as name,
      data,
      COALESCE(priority, 0) as priority,
      j.start_after,
      "singletonKey",
      CASE
        WHEN "singletonSeconds" IS NOT NULL THEN 'epoch'::timestamp + '1s'::interval * ("singletonSeconds"::float8 * floor(( date_part('epoch', now()) + COALESCE("singletonOffset",0)::float8) / "singletonSeconds"::float8 ))
        ELSE NULL
        END as singleton_on,
      "groupId" as group_id,
      "groupTier" as group_tier,
      COALESCE("expireInSeconds", q.expire_seconds) as expire_seconds,
      COALESCE("deleteAfterSeconds", q.deletion_seconds) as deletion_seconds,
      j.start_after + (COALESCE("retentionSeconds", q.retention_seconds) * interval '1s') as keep_until,
      COALESCE("retryLimit", q.retry_limit) as retry_limit,
      COALESCE("retryDelay", q.retry_delay) as retry_delay,
      COALESCE("retryBackoff", q.retry_backoff, false) as retry_backoff,
      COALESCE("retryDelayMax", q.retry_delay_max) as retry_delay_max,
      q.policy,
      COALESCE("deadLetter", q.dead_letter) as dead_letter,
      COALESCE("heartbeatSeconds", q.heartbeat_seconds) as heartbeat_seconds,
      COALESCE(blocked, false) as blocked,
      COALESCE(blocking, false) as blocking,
      COALESCE("pendingDependencies", 0) as pending_dependencies
    FROM (
      SELECT *,
        CASE
          WHEN ${isDateTimeString('"startAfter"')} THEN CAST("startAfter" as timestamp with time zone)
          ELSE now() + CAST(COALESCE("startAfter",'0') as interval)
          END as start_after
      FROM json_to_recordset($1::json) as x (
        id uuid,
        priority integer,
        data jsonb,
        "startAfter" text,
        "retryLimit" integer,
        "retryDelay" integer,
        "retryDelayMax" integer,
        "retryBackoff" boolean,
        "singletonKey" text,
        "singletonSeconds" integer,
        "singletonOffset" integer,
        "groupId" text,
        "groupTier" text,
        "expireInSeconds" integer,
        "deleteAfterSeconds" integer,
        "retentionSeconds" integer,
        "deadLetter" text,
        "heartbeatSeconds" integer,
        blocked boolean,
        blocking boolean,
        "pendingDependencies" integer
      )
    ) j
    JOIN ${schema}.queue q ON q.name = '${name}'
    ON CONFLICT DO NOTHING
    ${returning}
  `;
    if (!notify) {
        return insert;
    }
    // Fire a single transactional NOTIFY (committed atomically with the insert) only when
    // at least one inserted row is immediately runnable. Future-dated/throttled jobs are
    // left to the polling floor. The `notified` CTE is referenced from the final WHERE so
    // Postgres actually evaluates it; pg_notify runs at most once thanks to LIMIT 1. The
    // comparator shapes the output rows to honor returnId without changing notify behavior.
    const comparator = returnId ? '>= 0' : '< 0';
    return `
    WITH ins AS (
      ${insert}
    ),
    notified AS (
      SELECT pg_notify(${notifyChannelSql(schema)}, '${name}')
      FROM ins WHERE start_after <= now() LIMIT 1
    )
    SELECT id FROM ins WHERE (SELECT count(*) FROM notified) ${comparator}
  `;
}
function insertFlowJobs(schema, { table, name }, jobs) {
    const insert = insertJobs(schema, {
        table,
        name,
        returnId: true
    }).replace('$1', ()=>serializeJsonParam(jobs));
    return `
    WITH ins AS (
      ${insert}
    )
    SELECT 1 / (CASE WHEN (SELECT count(*) FROM ins) = ${jobs.length} THEN 1 ELSE 0 END)
  `;
}
function failJobsById(schema, table) {
    const where = `name = $1 AND id = ANY($2::uuid[]) AND state < '${JOB_STATES.completed}'`;
    const output = '$3::jsonb';
    return failJobs(schema, table, where, output);
}
function failJobsByTimeout(schema, table, queues, noAdvisoryLocks) {
    const where = `state = '${JOB_STATES.active}'
            AND (started_on + expire_seconds * interval '1s') < now()
            AND name = ANY(${serializeArrayParam(queues)})`;
    const output = '\'{ "value": { "message": "job timed out" } }\'::jsonb';
    return locked(schema, failJobs(schema, table, where, output), table + 'failJobsByTimeout', noAdvisoryLocks);
}
function failJobsByHeartbeat(schema, table, queues, noAdvisoryLocks) {
    const where = `state = '${JOB_STATES.active}'
            AND heartbeat_seconds IS NOT NULL
            AND (heartbeat_on + heartbeat_seconds * interval '1s') < now()
            AND name = ANY(${serializeArrayParam(queues)})`;
    const output = '\'{ "value": { "message": "job heartbeat timeout" } }\'::jsonb';
    return locked(schema, failJobs(schema, table, where, output), table + 'failJobsByHeartbeat', noAdvisoryLocks);
}
function touchJobs(schema, table) {
    return `
    WITH results AS (
      UPDATE ${schema}.${table}
      SET heartbeat_on = now()
      WHERE name = $1
        AND id = ANY($2::uuid[])
        AND state = '${JOB_STATES.active}'
      RETURNING 1
    )
    SELECT COUNT(*) FROM results
  `;
}
function failJobs(schema, table, where, output) {
    return `
    WITH ${failJobsBody(schema, table, where, output)}
    SELECT COUNT(*) FROM results
  `;
}
// The CTE chain shared by failJobs() and failJobsByIdWithOutputs(): delete the matched jobs and
// re-insert them as retry (when retries remain) or failed (+ dead letter). `where` selects the rows
// to fail and `output` is the SQL expression stored on each re-inserted job. Returned without the
// leading `WITH` or trailing `SELECT` so callers can prepend extra CTEs (e.g. an output map).
// When `forceTerminal` is set, every re-inserted job goes straight to the terminal `failed` state
// regardless of remaining retries, so the dlq_jobs CTE routes it to the dead letter queue (if any)
// immediately. This backs the perJobResults `deadletter` disposition.
function failJobsBody(schema, table, where, output, forceTerminal = false) {
    const state = forceTerminal ? `'${JOB_STATES.failed}'::${schema}.job_state` : `CASE
          WHEN retry_count < retry_limit THEN '${JOB_STATES.retry}'::${schema}.job_state
          ELSE '${JOB_STATES.failed}'::${schema}.job_state
          END`;
    const completedOn = forceTerminal ? 'now()' : 'CASE WHEN retry_count < retry_limit THEN NULL ELSE now() END';
    return `deleted_jobs AS (
      DELETE FROM ${schema}.${table}
      WHERE ${where}
      RETURNING *
    ),
    retried_jobs AS (
      INSERT INTO ${schema}.${table} (
        id,
        name,
        priority,
        data,
        state,
        retry_limit,
        retry_count,
        retry_delay,
        retry_backoff,
        retry_delay_max,
        start_after,
        started_on,
        singleton_key,
        singleton_on,
        group_id,
        group_tier,
        expire_seconds,
        deletion_seconds,
        created_on,
        completed_on,
        keep_until,
        policy,
        output,
        dead_letter,
        heartbeat_on,
        heartbeat_seconds,
        blocked,
        blocking,
        pending_dependencies
      )
      SELECT
        id,
        name,
        priority,
        data,
        ${state} as state,
        retry_limit,
        retry_count,
        retry_delay,
        retry_backoff,
        retry_delay_max,
        CASE WHEN retry_count = retry_limit THEN start_after
             WHEN NOT retry_backoff THEN now() + retry_delay * interval '1'
             ELSE now() + LEAST(
               retry_delay_max,
               GREATEST(retry_delay, 1) * (
                2 ^ LEAST(16, retry_count + 1) / 2 +
                2 ^ LEAST(16, retry_count + 1) / 2 * random()
               )
             ) * interval '1s'
        END as start_after,
        started_on,
        singleton_key,
        singleton_on,
        group_id,
        group_tier,
        expire_seconds,
        deletion_seconds,
        created_on,
        ${completedOn} as completed_on,
        keep_until,
        policy,
        ${output},
        dead_letter,
        NULL as heartbeat_on,
        heartbeat_seconds,
        blocked,
        blocking,
        pending_dependencies
      FROM deleted_jobs
      ON CONFLICT DO NOTHING
      RETURNING *
    ),
    failed_jobs as (
      INSERT INTO ${schema}.${table} (
        id,
        name,
        priority,
        data,
        state,
        retry_limit,
        retry_count,
        retry_delay,
        retry_backoff,
        retry_delay_max,
        start_after,
        started_on,
        singleton_key,
        singleton_on,
        group_id,
        group_tier,
        expire_seconds,
        deletion_seconds,
        created_on,
        completed_on,
        keep_until,
        policy,
        output,
        dead_letter,
        heartbeat_on,
        heartbeat_seconds,
        blocked,
        blocking,
        pending_dependencies
      )
      SELECT
        id,
        name,
        priority,
        data,
        '${JOB_STATES.failed}'::${schema}.job_state as state,
        retry_limit,
        retry_count,
        retry_delay,
        retry_backoff,
        retry_delay_max,
        start_after,
        started_on,
        singleton_key,
        singleton_on,
        group_id,
        group_tier,
        expire_seconds,
        deletion_seconds,
        created_on,
        now() as completed_on,
        keep_until,
        policy,
        ${output},
        dead_letter,
        NULL as heartbeat_on,
        heartbeat_seconds,
        blocked,
        blocking,
        pending_dependencies
      FROM deleted_jobs
      WHERE id NOT IN (SELECT id from retried_jobs)
      RETURNING *
    ),
    results as (
      SELECT * FROM retried_jobs
      UNION ALL
      SELECT * FROM failed_jobs
    ),
    dlq_jobs as (
      INSERT INTO ${schema}.job (name, priority, data, output, retry_limit, retry_backoff, retry_delay, keep_until, deletion_seconds,
        expire_seconds, source_name, source_id, source_created_on, source_retry_count, singleton_key, group_id, group_tier, heartbeat_seconds)
      SELECT
        r.dead_letter,
        r.priority,
        r.data,
        r.output,
        q.retry_limit,
        q.retry_backoff,
        q.retry_delay,
        now() + q.retention_seconds * interval '1s',
        q.deletion_seconds,
        q.expire_seconds,
        r.name,
        r.id,
        r.created_on,
        r.retry_count,
        r.singleton_key,
        r.group_id,
        r.group_tier,
        q.heartbeat_seconds
      FROM results r
        JOIN ${schema}.queue q ON q.name = r.dead_letter
      WHERE state = '${JOB_STATES.failed}'
    )`;
}
function failJobsByIdWithOutputs(schema, table) {
    // Output is supplied per job via a JSON recordset ($2). `where` and the output expression both
    // reference the output_map CTE so each re-inserted job keeps its own output. Constant number of
    // statements regardless of batch size.
    const where = `name = $1 AND id IN (SELECT id FROM output_map) AND state < '${JOB_STATES.completed}'`;
    const output = '(SELECT om.output FROM output_map om WHERE om.id = deleted_jobs.id)';
    return `
    WITH output_map AS (
      SELECT * FROM json_to_recordset($2::json) AS x (id uuid, output jsonb)
    ),
    ${failJobsBody(schema, table, where, output)}
    SELECT COUNT(*) FROM results
  `;
}
function deadLetterJobsByIdWithOutputs(schema, table) {
    const where = `name = $1 AND id IN (SELECT id FROM output_map) AND state < '${JOB_STATES.completed}'`;
    const output = '(SELECT om.output FROM output_map om WHERE om.id = deleted_jobs.id)';
    return `
    WITH output_map AS (
      SELECT * FROM json_to_recordset($2::json) AS x (id uuid, output jsonb)
    ),
    ${failJobsBody(schema, table, where, output, true)}
    SELECT COUNT(*) FROM results
  `;
}
function selectJobsToFailById(schema, table) {
    return {
        text: `SELECT * FROM ${schema}.${table} WHERE name = $1 AND id = ANY($2::uuid[]) AND state < '${JOB_STATES.completed}'`,
        values: []
    };
}
function deleteJobsToFail(schema, table) {
    return {
        text: `DELETE FROM ${schema}.${table} WHERE name = $1 AND id = ANY($2::uuid[])`,
        values: []
    };
}
function selectJobsToFailByTimeout(schema, table, queues) {
    return {
        text: `SELECT * FROM ${schema}.${table}
      WHERE state = '${JOB_STATES.active}'
        AND (started_on + expire_seconds * interval '1s') < now()
        AND name = ANY(${serializeArrayParam(queues)})`,
        values: []
    };
}
function selectJobsToFailByHeartbeat(schema, table, queues) {
    return {
        text: `SELECT * FROM ${schema}.${table}
      WHERE state = '${JOB_STATES.active}'
        AND heartbeat_seconds IS NOT NULL
        AND (heartbeat_on + heartbeat_seconds * interval '1s') < now()
        AND name = ANY(${serializeArrayParam(queues)})`,
        values: []
    };
}
function deleteJobsByIds(schema, table) {
    return {
        text: `DELETE FROM ${schema}.${table} WHERE id = ANY($1::uuid[])`,
        values: []
    };
}
function completeJobsDistributed(schema, table, includeQueued) {
    return `
    ${completeJobsUpdate(schema, table, includeQueued)}
    RETURNING id
  `;
}
function decrementDependents(schema) {
    return `
    WITH decremented AS (
      SELECT d.child_name, d.child_id, COUNT(*)::int AS n
      FROM ${schema}.job_dependency d
      WHERE d.parent_name = $1
        AND d.parent_id = ANY($2::uuid[])
      GROUP BY d.child_name, d.child_id
    ),
    ${lockedChildrenCte(schema)}
    ${unblockChildrenUpdate(schema)}
  `;
}
const FLOW_BATCH_SIZE = 1000;
function resolveFlowJobs(schema, table, names) {
    return {
        text: `
    WITH locked_parents AS (
      SELECT j.name, j.id
      FROM ${schema}.${table} j
      WHERE j.blocking
        AND j.state = '${JOB_STATES.completed}'
        AND j.name = ANY($1::text[])
      ORDER BY j.name, j.id
      FOR UPDATE OF j SKIP LOCKED
      LIMIT ${FLOW_BATCH_SIZE}
    ),
    decremented AS (
      SELECT d.child_name, d.child_id, COUNT(*)::int AS n
      FROM ${schema}.job_dependency d
      JOIN locked_parents p ON d.parent_name = p.name
        AND d.parent_id = p.id
      GROUP BY d.child_name, d.child_id
    ),
    ${lockedChildrenCte(schema)},
    unblocked AS (
      ${unblockChildrenUpdate(schema)}
      RETURNING 1
    ),
    cleared AS (
      UPDATE ${schema}.${table} j
      SET blocking = false
      FROM locked_parents p
      WHERE j.name = p.name
        AND j.id = p.id
      RETURNING 1
    )
    SELECT COUNT(*)::int AS resolved FROM cleared
  `,
        values: [
            names
        ]
    };
}
function selectBlockingParents(schema, table, names, noSkipLocked) {
    return {
        text: `
      SELECT name, id
      FROM ${schema}.${table}
      WHERE blocking
        AND state = '${JOB_STATES.completed}'
        AND name = ANY($1::text[])
      ORDER BY name, id
      FOR UPDATE${noSkipLocked ? '' : ' SKIP LOCKED'}
      LIMIT ${FLOW_BATCH_SIZE}
    `,
        values: [
            names
        ]
    };
}
function clearBlocking(schema) {
    return `
    UPDATE ${schema}.job
    SET blocking = false
    WHERE name = $1
      AND id = ANY($2::uuid[])
  `;
}
function insertRetryJob(schema, table) {
    return `
    INSERT INTO ${schema}.${table} (
      id, name, priority, data, state, retry_limit, retry_count, retry_delay,
      retry_backoff, retry_delay_max, start_after, started_on, singleton_key, singleton_on,
      group_id, group_tier, expire_seconds, deletion_seconds, created_on, completed_on,
      keep_until, policy, output, dead_letter,
      heartbeat_on, heartbeat_seconds, blocked, blocking, pending_dependencies
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
      $25, $26, $27, $28, $29
    ) ON CONFLICT DO NOTHING
    RETURNING id
  `;
}
function insertDeadLetterJob(schema) {
    return `
    INSERT INTO ${schema}.job (name, data, output, retry_limit, retry_backoff, retry_delay, keep_until, deletion_seconds,
      expire_seconds, source_name, source_id, source_created_on, source_retry_count, singleton_key, heartbeat_seconds,
      priority, group_id, group_tier)
    SELECT $1, $2, $3, q.retry_limit, q.retry_backoff, q.retry_delay, now() + q.retention_seconds * interval '1s', q.deletion_seconds,
      q.expire_seconds, $4, $5, $6, $7, $8, q.heartbeat_seconds, $9, $10, $11
    FROM ${schema}.queue q WHERE q.name = $1
  `;
}
function redriveJobs(schema, table) {
    return `
    WITH candidates AS (
      SELECT j.id
      FROM ${schema}.${table} j
      JOIN ${schema}.queue q ON q.name = COALESCE($2, j.source_name)
      WHERE j.name = $1
        AND j.state < '${JOB_STATES.active}'
        AND ($3::text IS NULL OR j.source_name = $3)
      ORDER BY j.created_on
      LIMIT $4
      FOR UPDATE OF j SKIP LOCKED
    ),
    moved AS (
      DELETE FROM ${schema}.${table}
      WHERE id IN (SELECT id FROM candidates)
      RETURNING *
    ),
    ins AS (
      INSERT INTO ${schema}.job
        (name, data, priority, retry_limit, retry_backoff, retry_delay, retry_delay_max,
         expire_seconds, keep_until, deletion_seconds, policy, singleton_key, group_id, group_tier,
         heartbeat_seconds, dead_letter)
      SELECT COALESCE($2, m.source_name), m.data, m.priority, q.retry_limit, q.retry_backoff,
        q.retry_delay, q.retry_delay_max, q.expire_seconds,
        now() + q.retention_seconds * interval '1s', q.deletion_seconds, q.policy,
        m.singleton_key, m.group_id, m.group_tier, q.heartbeat_seconds, q.dead_letter
      FROM moved m JOIN ${schema}.queue q ON q.name = COALESCE($2, m.source_name)
      -- A destination queue's short/stately policy can still collide on (name, singleton_key)
      -- if two redriven jobs share a key (job_i1/job_i3); dropping just that row here, matching
      -- retried_jobs' ON CONFLICT DO NOTHING elsewhere, is preferable to aborting the whole batch.
      -- The dropped job has already been deleted from the DLQ by the moved CTE and is not restored.
      ON CONFLICT DO NOTHING
      RETURNING 1
    )
    SELECT count(*)::int AS moved FROM ins
  `;
}
function deletion(schema, table, queues, noAdvisoryLocks) {
    const sql = `
    DELETE FROM ${schema}.${table}
    WHERE name = ANY(${serializeArrayParam(queues)})
      AND
      (
        (deletion_seconds > 0 AND completed_on + deletion_seconds * interval '1s' < now())
        OR
        (state < '${JOB_STATES.active}' AND keep_until < now())
      )
  `;
    return locked(schema, sql, table + 'deletion', noAdvisoryLocks);
}
function retryJobs(schema, table) {
    return `
    WITH results as (
      UPDATE ${schema}.job
      SET state = '${JOB_STATES.retry}',
        retry_limit = retry_limit + 1,
        completed_on = NULL
      WHERE name = $1
        AND id = ANY($2::uuid[])
        AND state = '${JOB_STATES.failed}'
      RETURNING 1
    )
    SELECT COUNT(*) from results
  `;
}
function updateJob(schema, table, name, by, match, notify = false) {
    const targetPredicate = by === 'id' ? "job.id = (o.data->>'id')::uuid" : "job.singleton_key = o.data->>'singletonKey'";
    const ordering = by === 'singletonKey' && match !== 'all' ? `ORDER BY job.created_on ${match === 'oldest' ? 'ASC' : 'DESC'} LIMIT 1` : '';
    // Resolve the incoming startAfter the same way insertJobs does (absolute date time vs.
    // relative interval), falling back to the row's current start_after when not supplied.
    const resolvedStartAfter = `
        CASE WHEN jsonb_exists(o.data, 'startAfter')
          THEN CASE WHEN ${isDateTimeString("o.data->>'startAfter'")}
                 THEN (o.data->>'startAfter')::timestamptz
                 ELSE now() + CAST(o.data->>'startAfter' AS interval) END
          ELSE job.start_after END`;
    const tail = notify ? `, notified AS (
      SELECT pg_notify(${notifyChannelSql(schema)}, '${name}')
      FROM upd WHERE start_after <= now() LIMIT 1
    )
    SELECT id FROM upd WHERE (SELECT count(*) FROM notified) >= 0` : `
    SELECT id FROM upd`;
    return `
    WITH o AS (SELECT $1::jsonb AS data),
    target AS (
      SELECT job.id
      FROM ${schema}.${table} job, o
      WHERE job.name = '${name}'
        AND job.state < '${JOB_STATES.active}'
        AND ${targetPredicate}
      ${ordering}
    ),
    upd AS (
      UPDATE ${schema}.${table} job
      SET data = CASE WHEN jsonb_exists(o.data, 'data') THEN o.data->'data' ELSE job.data END,
          priority = COALESCE((o.data->>'priority')::int, job.priority),
          start_after = ${resolvedStartAfter},
          keep_until = CASE
            WHEN jsonb_exists(o.data, 'retentionSeconds')
              THEN (${resolvedStartAfter}) + ((o.data->>'retentionSeconds')::int * interval '1s')
            -- When only start_after moves, slide keep_until by the same original retention window
            -- (keep_until - start_after) so pulling a job forward/back never leaves keep_until in
            -- the past, which the deletion sweep would treat as expired and remove the pending job.
            WHEN jsonb_exists(o.data, 'startAfter')
              THEN (${resolvedStartAfter}) + (job.keep_until - job.start_after)
            ELSE job.keep_until END,
          expire_seconds = COALESCE((o.data->>'expireInSeconds')::int, job.expire_seconds),
          deletion_seconds = COALESCE((o.data->>'deleteAfterSeconds')::int, job.deletion_seconds),
          retry_limit = COALESCE((o.data->>'retryLimit')::int, job.retry_limit),
          retry_delay = COALESCE((o.data->>'retryDelay')::int, job.retry_delay),
          retry_backoff = COALESCE((o.data->>'retryBackoff')::bool, job.retry_backoff),
          retry_delay_max = CASE WHEN jsonb_exists(o.data, 'retryDelayMax') THEN (o.data->>'retryDelayMax')::int ELSE job.retry_delay_max END,
          dead_letter = CASE WHEN jsonb_exists(o.data, 'deadLetter') THEN o.data->>'deadLetter' ELSE job.dead_letter END,
          heartbeat_seconds = CASE WHEN jsonb_exists(o.data, 'heartbeatSeconds') THEN (o.data->>'heartbeatSeconds')::int ELSE job.heartbeat_seconds END,
          group_id = CASE WHEN jsonb_exists(o.data, 'groupId') THEN o.data->>'groupId' ELSE job.group_id END,
          group_tier = CASE WHEN jsonb_exists(o.data, 'groupTier') THEN o.data->>'groupTier' ELSE job.group_tier END
      FROM o
      -- Re-check state < active on the locked row, not just in the unlocked target CTE. Under
      -- READ COMMITTED a concurrent fetchNextJob can activate a candidate between target selection
      -- and this UPDATE; EvalPlanQual re-evaluates this predicate on the freshly-locked row, so the
      -- guard here prevents mutating a job a worker has already started running.
      WHERE job.id IN (SELECT id FROM target)
        AND job.state < '${JOB_STATES.active}'
      RETURNING job.id, job.start_after
    )${tail}
  `;
}
function getQueueStats(schema, table, queues) {
    return {
        text: `
    SELECT
        name,
        "deferredCount",
        "queuedCount",
        GREATEST("queuedCount" - "deferredCount", 0) as "readyCount",
        "activeCount",
        "failedCount",
        "totalCount",
        "singletonsActive"
      FROM (
        SELECT
            name,
            (count(*) FILTER (WHERE start_after > now() AND state < '${JOB_STATES.active}'))::int as "deferredCount",
            (count(*) FILTER (WHERE state < '${JOB_STATES.active}'))::int as "queuedCount",
            (count(*) FILTER (WHERE state = '${JOB_STATES.active}'))::int as "activeCount",
            (count(*) FILTER (WHERE state = '${JOB_STATES.failed}'))::int as "failedCount",
            count(*)::int as "totalCount",
            array_agg(singleton_key) FILTER (WHERE policy IN ('${QUEUE_POLICIES.singleton}','${QUEUE_POLICIES.stately}') AND state = '${JOB_STATES.active}') as "singletonsActive"
          FROM ${schema}.${table}
          WHERE name = ANY($1::text[])
          GROUP BY 1
      ) stats
  `,
        values: [
            queues
        ]
    };
}
const READY_HISTORY_SIZE = 60;
function cacheQueueStats(schema, table, queues, noAdvisoryLocks) {
    const statsQuery = getQueueStats(schema, table, queues);
    // Serialize the $1 parameter for use in locked() multi-statement query
    const statsText = statsQuery.text.replace('$1::text[]', serializeArrayParam(queues));
    const sql = `
    WITH stats AS (${statsText})
    UPDATE ${schema}.queue SET
      deferred_count = COALESCE(stats."deferredCount", 0),
      queued_count = COALESCE(stats."queuedCount", 0),
      ready_count = COALESCE(stats."readyCount", 0),
      active_count = COALESCE(stats."activeCount", 0),
      failed_count = COALESCE(stats."failedCount", 0),
      total_count = COALESCE(stats."totalCount", 0),
      singletons_active = stats."singletonsActive",
      -- Always-on sliding window of recent ready counts for the dashboard sparkline (independent of
      -- persistQueueStats). Prepend the newest sample and keep the newest READY_HISTORY_SIZE, stored
      -- newest-first. Built with unnest + array_agg (not array slicing, which CockroachDB lacks).
      ready_history = (
        SELECT COALESCE(array_agg(v ORDER BY ord), '{}'::int[])
        FROM (
          SELECT v, ord
          FROM (
            SELECT COALESCE(stats."readyCount", 0)::int AS v, 0::bigint AS ord
            UNION ALL
            SELECT h.v, h.ord
            FROM unnest(COALESCE(queue.ready_history, '{}'::int[])) WITH ORDINALITY AS h(v, ord)
          ) merged
          ORDER BY ord
          LIMIT ${READY_HISTORY_SIZE}
        ) capped
      )
    FROM (
      SELECT q.name
      FROM unnest(${serializeArrayParam(queues)}) AS q(name)
    ) q
    LEFT JOIN stats ON stats.name = q.name
    WHERE queue.name = q.name
    RETURNING
      queue.name,
      queue.queued_count as "queuedCount",
      queue.warning_queued as "warningQueueSize"
  `;
    return locked(schema, sql, 'queue-stats', noAdvisoryLocks);
}
function refreshQueueStats(schema, table, name) {
    const statsQuery = getQueueStats(schema, table, [
        name
    ]);
    const statsText = statsQuery.text.replace('$1::text[]', serializeArrayParam([
        name
    ]));
    return `
    WITH stats AS (${statsText})
    UPDATE ${schema}.queue SET
      deferred_count = COALESCE(stats."deferredCount", 0),
      queued_count = COALESCE(stats."queuedCount", 0),
      ready_count = COALESCE(stats."readyCount", 0),
      active_count = COALESCE(stats."activeCount", 0),
      failed_count = COALESCE(stats."failedCount", 0),
      total_count = COALESCE(stats."totalCount", 0),
      singletons_active = stats."singletonsActive",
      monitor_on = now()
    FROM (
      SELECT q.name
      FROM unnest(${serializeArrayParam([
        name
    ])}) AS q(name)
    ) q
    LEFT JOIN stats ON stats.name = q.name
    WHERE queue.name = q.name
    RETURNING
      queue.name,
      queue.deferred_count as "deferredCount",
      queue.queued_count as "queuedCount",
      queue.ready_count as "readyCount",
      queue.active_count as "activeCount",
      queue.failed_count as "failedCount",
      queue.total_count as "totalCount",
      queue.monitor_on as "capturedOn"
  `;
}
function serializeArrayParam(values) {
    const escaped = values.map((v)=>`'${v.replace(SINGLE_QUOTE_REGEX, "''")}'`);
    return `ARRAY[${escaped.join(',')}]::text[]`;
}
function serializeJsonParam(value) {
    return `'${JSON.stringify(value).replace(SINGLE_QUOTE_REGEX, "''")}'`;
}
function transaction(query) {
    const sql = Array.isArray(query) ? query.join(';\n') : query;
    return `
    BEGIN;
    SET LOCAL lock_timeout = 30000;
    SET LOCAL idle_in_transaction_session_timeout = 30000;
    ${sql};
    COMMIT;
  `;
}
function locked(schema, query, key, noAdvisoryLocks) {
    const statements = Array.isArray(query) ? query : [
        query
    ];
    return transaction(noAdvisoryLocks ? statements : [
        advisoryLock(schema, key),
        ...statements
    ]);
}
// normalizeSchemaName, not resolveSchemaName: the key is opaque to postgres and never compared
// against the catalog, so it only has to agree across instances on the same schema. See the note
// on the helper.
function advisoryLock(schema, key) {
    return `SELECT pg_advisory_xact_lock(
      ('x' || encode(sha224((current_database() || '.pgboss.${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["normalizeSchemaName"])(schema)}${key || ''}')::bytea), 'hex'))::bit(64)::bigint
  )`;
}
function assertMigration(schema, version) {
    // raises 'division by zero' if already on desired schema version
    return `SELECT version::int/(version::int-${version}) from ${schema}.version`;
}
function findJobs(schema, table, options) {
    const { queued, byKey, byData, byId } = options;
    let paramIndex = 1;
    const whereConditions = [];
    if (byId) {
        ++paramIndex;
        whereConditions.push(`AND id = $${paramIndex}`);
    }
    if (byKey) {
        ++paramIndex;
        whereConditions.push(`AND singleton_key = $${paramIndex}`);
    }
    if (byData) {
        ++paramIndex;
        whereConditions.push(`AND data @> $${paramIndex}`);
    }
    if (queued) {
        whereConditions.push(`AND state < '${JOB_STATES.active}'`);
    }
    return `
    SELECT ${JOB_COLUMNS_ALL}
    FROM ${schema}.${table}
    WHERE name = $1
      ${whereConditions.join('\n      ')}
    `;
}
function getJobById(schema, table) {
    return `
    SELECT ${JOB_COLUMNS_ALL}
    FROM ${schema}.${table}
    WHERE name = $1
      AND id = $2
    `;
}
function insertDependencies(schema, deps) {
    const sql = `
    INSERT INTO ${schema}.job_dependency (child_name, child_id, parent_name, parent_id)
    SELECT child_name, child_id, parent_name, parent_id
    FROM json_to_recordset($1::json) AS x (
      child_name text,
      child_id uuid,
      parent_name text,
      parent_id uuid
    )
    ON CONFLICT DO NOTHING
  `;
    return deps ? sql.replace('$1', ()=>serializeJsonParam(deps)) : sql;
}
function getDependencies(schema) {
    return `
    SELECT parent_name as "parentName", parent_id as "parentId"
    FROM ${schema}.job_dependency
    WHERE child_name = $1 AND child_id = $2
  `;
}
function getDependents(schema) {
    return `
    SELECT child_name as "childName", child_id as "childId"
    FROM ${schema}.job_dependency
    WHERE parent_name = $1 AND parent_id = $2
  `;
}
function cleanupDependencies(schema, table, queues, noAdvisoryLocks) {
    const sql = `
    DELETE FROM ${schema}.job_dependency
    WHERE (child_name = ANY(${serializeArrayParam(queues)})
      AND NOT EXISTS (
        SELECT 1 FROM ${schema}.${table} j
        WHERE j.name = child_name AND j.id = child_id
      ))
    OR (parent_name = ANY(${serializeArrayParam(queues)})
      AND NOT EXISTS (
        SELECT 1 FROM ${schema}.${table} j
        WHERE j.name = parent_name AND j.id = parent_id
      ))
  `;
    return locked(schema, sql, table + 'cleanupDependencies', noAdvisoryLocks);
}
function getBlockedKeys(schema, table) {
    return `
    SELECT DISTINCT singleton_key as "singletonKey"
    FROM ${schema}.${table}
    WHERE name = $1
      AND state = '${JOB_STATES.failed}'
      AND policy = '${QUEUE_POLICIES.key_strict_fifo}'
    `;
}
function getNextBamCommand(schema, { useLiveness = false } = {}) {
    // Head-of-line note (shared by both variants): process all 'pending' commands (oldest first)
    // before retrying any 'failed' or stale 'in_progress' one, so a permanently-failing (or
    // crashed-mid-flight) command can't sit at the head of the queue and starve everything behind it.
    // Within a status, created_on preserves enqueue order.
    if (!useLiveness) {
        // Timeout-only path for engines without pg_stat_progress_create_index (CockroachDB/YugabyteDB):
        // a stuck in_progress row is reclaimed purely on the 24h fallback. No CONCURRENTLY healing, so no
        // reclaimed flag is emitted (bam.ts skips healing when noIndexProgressView is set anyway).
        return `
      UPDATE ${schema}.bam
      SET status = 'in_progress', started_on = now()
      WHERE id = (
        SELECT id FROM ${schema}.bam
        WHERE (
          status IN ('pending', 'failed')
          OR (status = 'in_progress' AND started_on < now() - interval '${BAM_STALE_SECONDS} seconds')
        )
        AND NOT EXISTS (
          SELECT 1 FROM ${schema}.bam
          WHERE status = 'in_progress' AND started_on >= now() - interval '${BAM_STALE_SECONDS} seconds'
        )
        ORDER BY (status != 'pending'), created_on
        LIMIT 1
      )
      RETURNING id, name, version, status, queue, table_name as "table", command, error,
                created_on as "createdOn", started_on as "startedOn", completed_on as "completedOn"
    `;
    }
    // Native-Postgres liveness path. An in_progress row counts as "stale" (reclaimable) when it is past
    // the grace window AND no backend is actually building its index right now. The same predicate,
    // negated, defines a genuinely-live command that must still block the queue — so a running build is
    // NEVER reclaimed (no matter how long it runs), and a dead one recovers within the grace window.
    // There is deliberately no 24h absolute cap here: liveBuild=true always means a build is in flight, so
    // capping on elapsed time would reclaim a genuinely-running build and start a second
    // CREATE INDEX CONCURRENTLY on the same index — the exact double-build this path exists to prevent.
    // (The timeout-only path's BAM_STALE_SECONDS fallback covers engines with no way to detect liveness.)
    //
    // liveBuild(tableCol): is a CREATE INDEX CONCURRENTLY actively building this table's index right now?
    // Detected via pg_locks, NOT pg_stat_progress_create_index — and that choice is load-bearing for
    // multi-instance safety. pg_stat_progress_* is filtered to the querying role's OWN backends (only a
    // superuser or a member of pg_read_all_stats sees another role's builds), so a progress-view check
    // silently reads a peer's live build as "dead" whenever pg-boss instances connect under different DB
    // roles — and the heal step (bamHealProbe/bamHealDrop in bam.ts) would then DROP INDEX CONCURRENTLY a
    // live index mid-build, racing the builder into a double CREATE. pg_locks, by contrast, is cluster-wide
    // and visible to every role (verified empirically). CREATE INDEX CONCURRENTLY holds a
    // ShareUpdateExclusiveLock on the target table for the ENTIRE build and releases it the instant the
    // statement finishes or the backend dies, so a granted SUExclusive lock on the row's table is a
    // crash-safe, role-agnostic "build in flight" signal — instances may run under different roles with no
    // loss of safety. Ordinary queue DML never takes SUExclusive (it uses AccessShare/RowShare/
    // RowExclusive), so it can't false-trigger; a concurrent autovacuum/ANALYZE on the same table DOES take
    // SUExclusive and reads as "live", but that false positive is in the SAFE direction — it only briefly
    // DEFERS a reclaim, never drops a live index. Scoped to the current database (l.database) because
    // pg_locks is cluster-wide while relation OIDs are only unique per database. Correlating on the table
    // is enough because the queue runs only one in_progress command at a time.
    const liveBuild = (tableCol)=>`EXISTS (
    SELECT 1 FROM pg_locks l
    WHERE l.locktype = 'relation'
      AND l.granted
      AND l.mode = 'ShareUpdateExclusiveLock'
      AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND l.relation = to_regclass(quote_ident('${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveSchemaName"])(schema)}') || '.' || quote_ident(${tableCol}))
  )`;
    const stale = (startedCol, tableCol)=>`(
    ${startedCol} < now() - interval '${BAM_LIVENESS_GRACE_SECONDS} seconds'
    AND NOT ${liveBuild(tableCol)}
  )`;
    return `
    WITH candidate AS (
      SELECT c.id, c.status AS prior_status
      FROM ${schema}.bam c
      WHERE (
        c.status IN ('pending', 'failed')
        OR (c.status = 'in_progress' AND ${stale('c.started_on', 'c.table_name')})
      )
      AND NOT EXISTS (
        SELECT 1 FROM ${schema}.bam g
        WHERE g.status = 'in_progress' AND NOT ${stale('g.started_on', 'g.table_name')}
      )
      ORDER BY (c.status != 'pending'), c.created_on
      LIMIT 1
      -- Defense-in-depth against a double-claim. The upstream trySetBamTime throttle serializes healers
      -- to one per interval, but a build running longer than bamIntervalSeconds lets a second instance
      -- pass the throttle while the first is still working. FOR UPDATE SKIP LOCKED makes the claim itself
      -- mutually exclusive: whichever instance locks the head row wins; the other skips it (and, with
      -- LIMIT 1, claims nothing) rather than re-running the same UPDATE and re-driving the command with a
      -- stale prior_status. OF c scopes the lock to the candidate row only, so the NOT EXISTS probe over
      -- bam g is never itself locked. Postgres-only path — SKIP LOCKED is deliberately absent from the
      -- timeout-only variant, which also serves CockroachDB/YugabyteDB where it performs poorly and can
      -- skip unexpectedly.
      FOR UPDATE OF c SKIP LOCKED
    )
    UPDATE ${schema}.bam b
    SET status = 'in_progress', started_on = now()
    FROM candidate
    WHERE b.id = candidate.id
    RETURNING b.id, b.name, b.version, b.status, b.queue, b.table_name as "table", b.command, b.error,
              b.created_on as "createdOn", b.started_on as "startedOn", b.completed_on as "completedOn",
              -- reattempt: was this command already tried once (stale-reclaimed in_progress OR a prior
              -- 'failed')? Either way an interrupted/failed CREATE INDEX CONCURRENTLY may have left an
              -- INVALID index, so the runner heals (drop-then-rebuild) before re-running. Fresh
              -- 'pending' rows have nothing to heal.
              (candidate.prior_status <> 'pending') as reattempt
  `;
}
function bamHealDrop(schema, command) {
    const match = command.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[\w$]+"?)/i);
    if (!match) return null;
    return `DROP INDEX CONCURRENTLY IF EXISTS ${schema}.${match[1]}`;
}
function bamHealProbe(schema, command) {
    const match = command.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([\w$]+)"?/i);
    if (!match) return null;
    return `
    SELECT NOT i.indisvalid AS invalid
    FROM pg_class c
    JOIN pg_index i ON i.indexrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = '${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveSchemaName"])(schema).replace(SINGLE_QUOTE_REGEX, "''")}' AND c.relname = '${match[1].replace(SINGLE_QUOTE_REGEX, "''")}'
  `;
}
function setBamCompleted(schema, id) {
    return `
    UPDATE ${schema}.bam
    SET status = 'completed', completed_on = now()
    WHERE id = '${id}'
  `;
}
function setBamFailed(schema, id, error) {
    const escapedError = error.replace(/'/g, "''");
    return `
    UPDATE ${schema}.bam
    SET status = 'failed', error = '${escapedError}', completed_on = now()
    WHERE id = '${id}'
  `;
}
function getBamStatus(schema) {
    return `
    SELECT status, count(*)::int as count, max(created_on) as "lastCreatedOn"
    FROM ${schema}.bam
    GROUP BY status
  `;
}
function getBamEntries(schema) {
    return `
    SELECT id, name, version, status, queue, table_name as "table", command, error,
           created_on as "createdOn", started_on as "startedOn", completed_on as "completedOn"
    FROM ${schema}.bam
    ORDER BY version, created_on
  `;
}
function jobCommonExists(schema) {
    return `SELECT to_regclass('${schema}.${COMMON_JOB_TABLE}') as name`;
}
function getManagedQueuePartitions(schema) {
    return `SELECT table_name as "table", policy FROM ${schema}.queue WHERE partition = true`;
}
function getIncompleteBamCommands(schema) {
    return `SELECT command FROM ${schema}.bam WHERE status <> 'completed'`;
}
function bamCommandIndexName(command) {
    const match = command.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?"?([\w$]+)"?/i);
    return match ? match[1] : null;
}
// job_iN partial indexes that gate on a queue policy: a per-queue partition table (partition:true)
// only receives the index for its own policy (see create_queue, createQueueFunction). The shared
// job_common table and a non-partitioned job table carry all of them at once. Keep in sync with the
// createIndexJobPolicy* builders and the ELSIF ladder in createQueueFunction.
const POLICY_JOB_INDEXES = {
    1: QUEUE_POLICIES.short,
    2: QUEUE_POLICIES.singleton,
    3: QUEUE_POLICIES.stately,
    6: QUEUE_POLICIES.exclusive,
    8: QUEUE_POLICIES.key_strict_fifo,
    10: QUEUE_POLICIES.key_strict_fifo
};
// job_iN indexes with no policy gate — created on every job table regardless of policy
// (throttle i4, fetch i5, group-concurrency i7, blocking i9).
const BASE_JOB_INDEXES = [
    4,
    5,
    7,
    9
];
// The fixed (non-job) managed tables; job/job_common/partitions are handled separately.
const FIXED_MANAGED_TABLES = [
    'version',
    'queue',
    'schedule',
    'subscription',
    'bam',
    'warning',
    'queue_stats',
    'job_dependency'
];
// Selects the manifest section for the live architecture, and substitutes the real schema name back in
// for the placeholder the manifest stores.
function manifestSection(partitioned) {
    return partitioned ? __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$schema$2e$json__$28$json$29$__["default"].partitioned : __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$schema$2e$json__$28$json$29$__["default"].nonPartitioned;
}
function applyManifestSchema(text, schema) {
    return text.split(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$schema$2e$json__$28$json$29$__["default"].schemaToken).join(schema);
}
const EXPECTED_JOB_STATES = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$schema$2e$json__$28$json$29$__["default"].partitioned.enum;
function expectedManagedTables(schema, partitioned, partitions = []) {
    const tables = [
        ...manifestSection(partitioned).tables
    ];
    if (partitioned) for (const p of partitions)tables.push(p.table);
    return tables;
}
function expectedManagedColumns(schema, partitioned, partitions = []) {
    const fixed = new Set(FIXED_MANAGED_TABLES);
    const byTable = new Map();
    const jobColumns = [];
    for (const c of manifestSection(partitioned).columns){
        if (c.table === 'job') {
            jobColumns.push(c.column);
            continue;
        }
        if (!fixed.has(c.table)) continue; // job_common / anything else derives from the job template below
        let entry = byTable.get(c.table);
        if (!entry) byTable.set(c.table, entry = {
            table: c.table,
            columns: [],
            defaults: {},
            types: {}
        });
        entry.columns.push(c.column);
        entry.types[c.column] = {
            type: applyManifestSchema(c.type, schema),
            notNull: c.notNull
        };
        if (c.default != null) entry.defaults[c.column] = applyManifestSchema(c.default, schema);
    }
    const out = [
        ...byTable.values()
    ];
    out.push({
        table: 'job',
        columns: jobColumns
    });
    if (partitioned) {
        out.push({
            table: COMMON_JOB_TABLE,
            columns: jobColumns
        });
        for (const p of partitions)out.push({
            table: p.table,
            columns: jobColumns
        });
    }
    return out;
}
function expectedManagedConstraints(schema, partitioned) {
    const fixed = new Set(FIXED_MANAGED_TABLES);
    const byTable = new Map();
    for (const { table, def } of manifestSection(partitioned).constraints){
        if (!fixed.has(table)) continue;
        const list = byTable.get(table) ?? byTable.set(table, []).get(table);
        list.push(applyManifestSchema(def, schema));
    }
    return [
        ...byTable
    ].map(([table, constraints])=>({
            table,
            constraints
        }));
}
function expectedManagedFunctions(schema, partitioned) {
    return manifestSection(partitioned).functions.map((fn)=>{
        const def = applyManifestSchema(fn.def, schema);
        return {
            name: fn.name,
            expectedBody: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["normalizeFunctionBody"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["extractFunctionBody"])(def)),
            definition: def.replace(/\s+/g, ' ').trim()
        };
    });
}
function expectedManagedIndexes(schema, partitioned, partitions = []) {
    const managed = (name, table, indexdef)=>{
        const def = applyManifestSchema(indexdef, schema);
        return {
            name,
            table,
            keys: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["indexKeysRaw"])(def),
            include: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["indexIncludeRaw"])(def),
            predicate: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["indexPredicateRaw"])(def),
            definition: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["displayIndexDefinition"])(def)
        };
    };
    const jobTable = partitioned ? COMMON_JOB_TABLE : 'job';
    const out = [];
    const jobIndexes = [];
    // The manifest holds only the managed indexes (constraint-backing *_pkey indexes are excluded at
    // generation), so every row is an expectation.
    for (const idx of manifestSection(partitioned).indexes){
        out.push(managed(idx.name, idx.table, idx.def));
        const n = idx.table === jobTable ? idx.name.match(/_i(\d+)$/) : null;
        if (n) jobIndexes.push({
            n: Number(n[1]),
            def: idx.def
        });
    }
    // Per-queue partition tables are dynamic, so template each applicable job_common index onto them.
    if (partitioned) {
        for (const p of partitions){
            for (const { n, def } of jobIndexes){
                if (!BASE_JOB_INDEXES.includes(n) && POLICY_JOB_INDEXES[n] !== p.policy) continue;
                out.push(managed(`${p.table}_i${n}`, p.table, def.split(COMMON_JOB_TABLE).join(p.table)));
            }
        }
    }
    return out;
}
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/attorney.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POLICY",
    ()=>POLICY,
    "assertKey",
    ()=>assertKey,
    "assertPostgresObjectName",
    ()=>assertPostgresObjectName,
    "assertQueueName",
    ()=>assertQueueName,
    "checkFetchArgs",
    ()=>checkFetchArgs,
    "checkSendArgs",
    ()=>checkSendArgs,
    "checkUpdateArgs",
    ()=>checkUpdateArgs,
    "checkWorkArgs",
    ()=>checkWorkArgs,
    "getConfig",
    ()=>getConfig,
    "pinZonelessDateTime",
    ()=>pinZonelessDateTime,
    "validateFlowJobs",
    ()=>validateFlowJobs,
    "validateGroupConfig",
    ()=>validateGroupConfig,
    "validateQueueArgs",
    ()=>validateQueueArgs
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:assert [external] (node:assert, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/plans.js [instrumentation] (ecmascript)");
;
;
const POLICY = {
    MAX_EXPIRATION_HOURS: 24,
    MIN_POLLING_INTERVAL_MS: 500,
    MAX_RETENTION_DAYS: 365
};
// The internal compatibility flags a backend can toggle. A backend sets only the flags that differ
// from stock PostgreSQL; everything else defaults to false. These are derived from the backend
// profile and are not user-configurable (see resolveBackend).
const COMPATIBILITY_FLAGS = [
    'noSkipLocked',
    'noMultiMutationCte',
    'noTablePartitioning',
    'noDeferrableConstraints',
    'noAdvisoryLocks',
    'noCoveringIndexes',
    'noListenNotify',
    'noIndexProgressView'
];
// The single source of truth for backend presets, mirrored by test/testHelper.ts.
const BACKEND_PROFILES = {
    postgres: {
        kind: 'standard',
        flags: {}
    },
    cockroachdb: {
        kind: 'distributed',
        flags: {
            noSkipLocked: true,
            noMultiMutationCte: true,
            noTablePartitioning: true,
            noDeferrableConstraints: true,
            noAdvisoryLocks: true,
            noCoveringIndexes: true,
            noListenNotify: true,
            // Online DDL runs as a schema-change job, not the PG CONCURRENTLY path, and
            // pg_stat_progress_create_index isn't available — so BAM can't use liveness-based reclaim.
            noIndexProgressView: true
        }
    },
    yugabytedb: {
        kind: 'distributed',
        flags: {
            noAdvisoryLocks: true,
            noTablePartitioning: true,
            // Index builds are a distributed backfill that pg_stat_progress_create_index doesn't reflect,
            // so liveness would misread an in-flight build as dead. BAM falls back to the timeout instead.
            noIndexProgressView: true
        }
    },
    // No noIndexProgressView: pg-boss keeps its tables coordinator-local (it never calls
    // create_distributed_table), so CREATE INDEX CONCURRENTLY runs against ordinary local Postgres tables
    // on the coordinator, where pg_stat_progress_create_index is accurate and liveness-based reclaim is
    // valid. This holds ONLY while the tables stay coordinator-local — if they are ever distributed, the
    // coordinator's progress view would misread in-flight worker builds as dead and BAM could double-build.
    citus: {
        kind: 'distributed',
        flags: {}
    },
    pglite: {
        kind: 'embedded',
        flags: {}
    }
};
function assertObjectName(value, name = 'Name') {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(/^[\w.\-/]+$/.test(value), `${name} can only contain alphanumeric characters, underscores, hyphens, periods, or forward slashes`);
}
function validateQueueArgs(config = {}) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('deadLetter' in config) || config.deadLetter === null || typeof config.deadLetter === 'string', 'deadLetter must be a string');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('notify' in config) || typeof config.notify === 'boolean', 'notify must be a boolean');
    if (config.deadLetter) {
        assertObjectName(config.deadLetter, 'deadLetter');
    }
    validateRetryConfig(config);
    validateExpirationConfig(config);
    validateRetentionConfig(config);
    validateDeletionConfig(config);
    validateHeartbeatConfig(config);
}
// A `startAfter` string that begins with an ISO 8601 calendar date is cast to timestamptz by the
// database, so one carrying no zone designator resolves in the database session's TimeZone. Two
// instances against the same database can then schedule the same string at different instants
// (a 10.5 hour spread between America/New_York and Asia/Kolkata, and a date-only string can land
// on the previous day), which is nothing the caller of send() is thinking about. The documented
// contract is UTC and the Date path already produces UTC via toISOString(), so pin the zone here.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
// Matched against the remainder past YYYY-MM-DD, and deliberately a whitelist of the zone-less
// spellings rather than a test for a missing zone: a trailing '-01' would read as an offset, and
// forms Postgres resolves on its own — a named zone ('... UTC', '... America/New_York'), a
// single-digit offset ('+5:30') — must be left exactly as they are rather than pinned to UTC.
const ZONELESS_TIME = /^(?:[T ]\d{2}(?::\d{2}(?::\d{2}(?:[.,]\d+)?)?)?)?$/;
function pinZonelessDateTime(value) {
    return ISO_DATE.test(value) && ZONELESS_TIME.test(value.slice(10)) ? value + 'Z' : value;
}
function checkSendArgs(args) {
    let name, data, options;
    if (typeof args[0] === 'string') {
        name = args[0];
        data = args[1];
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof data !== 'function', 'send() cannot accept a function as the payload.  Did you intend to use work()?');
        options = args[2];
    } else if (typeof args[0] === 'object') {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(args.length === 1, 'send object API only accepts 1 argument');
        const job = args[0];
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(job, 'boss requires all jobs to have a name');
        name = job.name;
        data = job.data;
        options = job.options;
    }
    options = options || {};
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(name, 'boss requires all jobs to have a queue name');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof options === 'object', 'options should be an object');
    options = {
        ...options
    };
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('priority' in options) || Number.isInteger(options.priority), 'priority must be an integer');
    options.priority = options.priority || 0;
    options.startAfter = options.startAfter instanceof Date && typeof options.startAfter.toISOString === 'function' ? options.startAfter.toISOString() : +options.startAfter > 0 ? '' + options.startAfter : typeof options.startAfter === 'string' ? pinZonelessDateTime(options.startAfter) : undefined;
    validateRetryConfig(options);
    validateExpirationConfig(options);
    validateRetentionConfig(options);
    validateDeletionConfig(options);
    validateGroupConfig(options);
    validateHeartbeatConfig(options);
    return {
        name,
        data,
        options
    };
}
const JOB_MATCH_STRATEGIES = [
    'newest',
    'oldest',
    'all'
];
// Unlike checkSendArgs, this does NOT inject send-style defaults (e.g. priority = 0): update()
// is a partial edit, so only the option keys the caller actually supplied may survive into the
// payload. Normalization is limited to type coercion (startAfter) and validation.
function checkUpdateArgs(args, { upsert = false } = {}) {
    const verb = upsert ? 'upsert()' : 'update()';
    let name, data, rawOptions;
    if (typeof args[0] === 'string') {
        name = args[0];
        data = args[1];
        rawOptions = args[2];
    } else if (typeof args[0] === 'object') {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(args.length === 1, `${verb} object API only accepts 1 argument`);
        const job = args[0];
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(job, 'boss requires all jobs to have a name');
        name = job.name;
        data = job.data;
        rawOptions = job.options;
    }
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(name, 'boss requires all jobs to have a queue name');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof data !== 'function', `${verb} cannot accept a function as the payload.  Did you intend to use work()?`);
    const options = {
        ...rawOptions || {}
    };
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof options === 'object', 'options should be an object');
    const { id, singletonKey, match } = options;
    // Both update() and upsert() target by exactly one of id or singletonKey. (upsert() may also
    // require a singletonKey at runtime on key_strict_fifo queues — enforced in the manager, which
    // knows the policy — because an insert-on-miss there needs a key.)
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!!id !== !!singletonKey, `${verb} requires exactly one of id or singletonKey`);
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!(id && match !== undefined), 'match is only valid when targeting jobs by singletonKey');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(match === undefined || JOB_MATCH_STRATEGIES.includes(match), `match must be one of: ${JOB_MATCH_STRATEGIES.join(', ')}`);
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('priority' in options) || Number.isInteger(options.priority), 'priority must be an integer');
    if ('startAfter' in options) {
        // Unlike send(), update() must honor a numeric startAfter of 0 (or negative) — the caller is
        // explicitly pulling a deferred job forward to now. The send-style `+startAfter > 0` guard
        // coerced 0 to undefined, which JSON.stringify then dropped, silently making the edit a no-op.
        // Any finite number is passed through as a seconds interval ('0' -> now()); a string is kept.
        const startAfter = options.startAfter;
        options.startAfter = startAfter instanceof Date && typeof startAfter.toISOString === 'function' ? startAfter.toISOString() : typeof startAfter === 'number' && Number.isFinite(startAfter) ? '' + startAfter : typeof startAfter === 'string' ? pinZonelessDateTime(startAfter) : undefined;
    }
    validateRetryConfig(options);
    validateExpirationConfig(options);
    validateRetentionConfig(options);
    validateGroupConfig(options);
    validateHeartbeatConfig(options);
    return {
        name,
        data,
        options
    };
}
function validateGroupConfig(config) {
    if (!('group' in config) || config.group === undefined || config.group === null) {
        return;
    }
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof config.group === 'object', 'group must be an object');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof config.group.id === 'string' && config.group.id.length > 0, 'group.id must be a non-empty string');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('tier' in config.group) || typeof config.group.tier === 'string' && config.group.tier.length > 0, 'group.tier must be a non-empty string if provided');
}
function validateFlowJobs(jobs) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(Array.isArray(jobs), 'flow requires an array of jobs');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(jobs.length >= 2, 'flow requires at least 2 jobs');
    const refs = new Set();
    for (const job of jobs){
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof job.ref === 'string' && job.ref.length > 0, 'each flow job must have a non-empty ref');
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!refs.has(job.ref), `duplicate ref: "${job.ref}"`);
        refs.add(job.ref);
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof job.name === 'string' && job.name.length > 0, 'each flow job must have a non-empty name');
        assertObjectName(job.name);
    }
    const hasDeps = jobs.some((j)=>j.dependsOn && j.dependsOn.length > 0);
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(hasDeps, 'flow requires at least one job with dependsOn');
    for (const job of jobs){
        if (!job.dependsOn) continue;
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(Array.isArray(job.dependsOn), `dependsOn for ref "${job.ref}" must be an array`);
        for (const dep of job.dependsOn){
            (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof dep === 'string' && dep.length > 0, 'dependsOn entries must be non-empty strings');
            (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(dep !== job.ref, `job "${job.ref}" cannot depend on itself`);
            (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(refs.has(dep), `dependsOn ref "${dep}" not found in flow`);
        }
    }
    // Cycle detection via topological sort
    const inDegree = new Map();
    const edges = new Map();
    for (const job of jobs){
        inDegree.set(job.ref, 0);
        edges.set(job.ref, []);
    }
    for (const job of jobs){
        if (!job.dependsOn) continue;
        for (const dep of job.dependsOn){
            edges.get(dep).push(job.ref);
            inDegree.set(job.ref, inDegree.get(job.ref) + 1);
        }
    }
    const queue = [];
    for (const [ref, deg] of inDegree){
        if (deg === 0) queue.push(ref);
    }
    let visited = 0;
    while(queue.length > 0){
        const current = queue.shift();
        visited++;
        for (const child of edges.get(current)){
            const newDeg = inDegree.get(child) - 1;
            inDegree.set(child, newDeg);
            if (newDeg === 0) queue.push(child);
        }
    }
    if (visited !== jobs.length) {
        const cycle = findDependencyCycle(edges);
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(false, `flow contains a dependency cycle: ${cycle.join(' -> ')}`);
    }
}
function findDependencyCycle(edges) {
    const visiting = new Set();
    const visited = new Set();
    const path = [];
    function visit(ref) {
        if (visiting.has(ref)) {
            const start = path.indexOf(ref);
            return [
                ...path.slice(start),
                ref
            ];
        }
        if (visited.has(ref)) return null;
        visiting.add(ref);
        path.push(ref);
        for (const child of edges.get(ref) || []){
            const cycle = visit(child);
            if (cycle) return cycle;
        }
        path.pop();
        visiting.delete(ref);
        visited.add(ref);
        return null;
    }
    let cycle = null;
    for (const ref of edges.keys()){
        cycle = visit(ref);
        if (cycle) break;
    }
    return cycle;
}
function validateGroupConcurrencyValue(value, optionName) {
    if (typeof value === 'number') {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(Number.isInteger(value) && value >= 1, `${optionName} must be an integer >= 1`);
        return;
    }
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof value === 'object', `${optionName} must be a number or an object with { default, tiers? }`);
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(Number.isInteger(value.default) && value.default >= 1, `${optionName}.default must be an integer >= 1`);
    if ('tiers' in value && value.tiers) {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof value.tiers === 'object', `${optionName}.tiers must be an object`);
        for (const [tier, limit] of Object.entries(value.tiers)){
            (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof tier === 'string' && tier.length > 0, `${optionName} tier keys must be non-empty strings`);
            (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(Number.isInteger(limit) && limit >= 1, `${optionName}.tiers["${tier}"] must be an integer >= 1`);
        }
    }
}
function validatePriorityRangeConfig(config) {
    if (config.minPriority !== undefined) {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(Number.isInteger(config.minPriority), 'minPriority must be an integer');
    }
    if (config.maxPriority !== undefined) {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(Number.isInteger(config.maxPriority), 'maxPriority must be an integer');
    }
    if (config.minPriority !== undefined && config.maxPriority !== undefined) {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(config.minPriority <= config.maxPriority, 'minPriority must be <= maxPriority');
    }
}
function validateGroupConcurrencyConfig(config) {
    const hasGlobal = config.groupConcurrency != null;
    const hasLocal = config.localGroupConcurrency != null;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!(hasGlobal && hasLocal), 'cannot specify both groupConcurrency and localGroupConcurrency - choose one');
    if (hasGlobal) validateGroupConcurrencyValue(config.groupConcurrency, 'groupConcurrency');
    if (hasLocal) {
        validateGroupConcurrencyValue(config.localGroupConcurrency, 'localGroupConcurrency');
        validateLocalGroupConcurrencyLimit(config.localGroupConcurrency, config.localConcurrency);
    }
}
function validateLocalGroupConcurrencyLimit(localGroupConcurrency, localConcurrency) {
    const effectiveLocalConcurrency = localConcurrency ?? 1;
    if (typeof localGroupConcurrency === 'number') {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(localGroupConcurrency <= effectiveLocalConcurrency, `localGroupConcurrency (${localGroupConcurrency}) cannot exceed localConcurrency (${effectiveLocalConcurrency})`);
    } else if (typeof localGroupConcurrency === 'object') {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(localGroupConcurrency.default <= effectiveLocalConcurrency, `localGroupConcurrency.default (${localGroupConcurrency.default}) cannot exceed localConcurrency (${effectiveLocalConcurrency})`);
        if (localGroupConcurrency.tiers) {
            for (const [tier, limit] of Object.entries(localGroupConcurrency.tiers)){
                (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(limit <= effectiveLocalConcurrency, `localGroupConcurrency.tiers["${tier}"] (${limit}) cannot exceed localConcurrency (${effectiveLocalConcurrency})`);
            }
        }
    }
}
function checkWorkArgs(name, args) {
    let options, callback;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(name, 'queue name is required');
    if (args.length === 1) {
        callback = args[0];
        options = {};
    } else if (args.length > 1) {
        options = args[0] || {};
        callback = args[1];
    }
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof callback === 'function', 'expected callback to be a function');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof options === 'object', 'expected config to be an object');
    options = {
        ...options
    };
    applyPollingInterval(options);
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('batchSize' in options) || Number.isInteger(options.batchSize) && options.batchSize >= 1, 'batchSize must be an integer > 0');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('includeMetadata' in options) || typeof options.includeMetadata === 'boolean', 'includeMetadata must be a boolean');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('priority' in options) || typeof options.priority === 'boolean', 'priority must be a boolean');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('localConcurrency' in options) || Number.isInteger(options.localConcurrency) && options.localConcurrency >= 1, 'localConcurrency must be an integer >= 1');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('perJobResults' in options) || typeof options.perJobResults === 'boolean', 'perJobResults must be a boolean');
    validatePriorityRangeConfig(options);
    validateGroupConcurrencyConfig(options);
    validateHeartbeatRefreshConfig(options);
    return {
        options,
        callback
    };
}
function checkFetchArgs(name, options) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(name, 'missing queue name');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('batchSize' in options) || Number.isInteger(options.batchSize) && options.batchSize >= 1, 'batchSize must be an integer > 0');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('includeMetadata' in options) || typeof options.includeMetadata === 'boolean', 'includeMetadata must be a boolean');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('priority' in options) || typeof options.priority === 'boolean', 'priority must be a boolean');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('ignoreStartAfter' in options) || typeof options.ignoreStartAfter === 'boolean', 'ignoreStartAfter must be a boolean');
    validatePriorityRangeConfig(options);
}
function getConfig(value) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(value && (typeof value === 'object' || typeof value === 'string'), 'configuration assert: string or config object is required to connect to postgres');
    const config = typeof value === 'string' ? {
        connectionString: value
    } : {
        ...value
    };
    config.schedule = 'schedule' in config ? config.schedule : true;
    config.supervise = 'supervise' in config ? config.supervise : true;
    config.migrate = 'migrate' in config ? config.migrate : true;
    config.createSchema = 'createSchema' in config ? config.createSchema : true;
    config.useListenNotify = 'useListenNotify' in config ? config.useListenNotify : false;
    resolveBackend(config);
    applySchemaConfig(config);
    applyOpsConfig(config);
    applyScheduleConfig(config);
    applyBamConfig(config);
    applyFlowConfig(config);
    validateWarningConfig(config);
    return config;
}
function applySchemaConfig(config) {
    if (config.schema) {
        assertPostgresObjectName(config.schema);
    }
    config.schema = config.schema || __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["DEFAULT_SCHEMA"];
}
function validateWarningConfig(config) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('warningQueueSize' in config) || config.warningQueueSize >= 1, 'configuration assert: warningQueueSize must be at least 1');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('warningSlowQuerySeconds' in config) || config.warningSlowQuerySeconds >= 1, 'configuration assert: warningSlowQuerySeconds must be at least 1');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('warningRetentionDays' in config) || Number.isInteger(config.warningRetentionDays) && config.warningRetentionDays >= 1, 'configuration assert: warningRetentionDays must be an integer >= 1');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('warningRetentionDays' in config) || config.warningRetentionDays <= POLICY.MAX_RETENTION_DAYS, `configuration assert: warningRetentionDays cannot exceed ${POLICY.MAX_RETENTION_DAYS} days`);
}
// Expands config.backend into the internal compatibility flags. The flags are derived
// solely from the backend profile — they are not part of the public input, so a
// deployment can't end up with an inconsistent combination.
function resolveBackend(config) {
    const backend = 'backend' in config ? config.backend : 'postgres';
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(backend in BACKEND_PROFILES, `configuration assert: backend must be one of ${Object.keys(BACKEND_PROFILES).join(', ')}`);
    config.backend = backend;
    const { flags } = BACKEND_PROFILES[backend];
    for (const flag of COMPATIBILITY_FLAGS){
        config[flag] = flags[flag] ?? false;
    }
    // Test hook: exercise the distributed runtime paths (atomic fetch + split mutations)
    // on top of the current backend's schema, without standing up a distributed database.
    if (config.__test__distributed) {
        config.noSkipLocked = true;
        config.noMultiMutationCte = true;
    }
    // Test hook: exercise the advisory-lock-free SQL path (used by YugabyteDB/CockroachDB) on a
    // plain Postgres instance, without standing up a backend whose profile sets the flag.
    if (config.__test__noAdvisoryLocks) {
        config.noAdvisoryLocks = true;
    }
    // Test hook: exercise the no-liveness BAM reclaim path (timeout-only, no CONCURRENTLY healing)
    // used by CockroachDB/YugabyteDB, on a plain Postgres instance.
    if (config.__test__noIndexProgressView) {
        config.noIndexProgressView = true;
    }
}
// The character rules for the contents of a quoted name, as a predicate clause returned rather than
// thrown, so the bare-name path can ask whether quoting would actually fix a name before
// recommending it - and explain why not when it wouldn't.
function quotedNameProblem(resolved) {
    // the value is interpolated into identifier positions verbatim, so a double quote inside the
    // outer pair would close the identifier early and allow arbitrary SQL to follow.
    if (resolved.includes('"')) return 'cannot contain double quotes';
    // a single quote would terminate the literal in the string-comparison positions, and would also
    // break the `EXECUTE format('… ')` bodies the schema is interpolated into.
    if (resolved.includes("'")) return 'cannot contain single quotes';
    // % is a format() specifier, and the schema is interpolated into EXECUTE format('… ${schema}.%I …')
    // templates. an unknown specifier aborts the statement; a valid one (e.g. "a%Ib") is worse, since
    // it silently consumes an argument and shifts every later specifier by one.
    if (resolved.includes('%')) return 'cannot contain percent signs';
    // $ can collide with the dollar-quoted function bodies the schema appears inside.
    if (resolved.includes('$')) return 'cannot contain dollar signs';
    // partition and table naming splits on '.', so a dot would be misread as a schema separator.
    if (resolved.includes('.')) return 'cannot contain periods';
    // backslash is not valid in the bytea inputs the name is hashed through, and control
    // characters can break out of the provenance comments in exported migration SQL.
    if (resolved.includes('\\')) return 'cannot contain backslashes';
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(resolved)) return 'cannot contain control characters';
    return null;
}
function assertPostgresObjectName(name) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof name === 'string', 'Name must be a string');
    const quoted = name.startsWith('"') && name.endsWith('"') && name.length > 1;
    const resolved = quoted ? name.slice(1, -1) : name;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(resolved.length > 0, 'Name cannot be empty');
    // the limit applies to the resolved name, since that is what postgres stores and what the
    // derived object names are built from. it is measured in bytes rather than characters because
    // postgres truncates identifiers at NAMEDATALEN-1 (63) bytes *silently* - a name over the limit
    // would install fine but leave the configured name and the catalog name permanently out of sync,
    // so every nspname comparison would miss. bare names are ascii, so this only binds on quoted ones.
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(Buffer.byteLength(resolved, 'utf8') <= 50, 'Name cannot exceed 50 bytes');
    if (quoted) {
        const problem = quotedNameProblem(resolved);
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(problem === null, `Quoted name ${problem}`);
        return;
    }
    // A name that is not a legal bare identifier is usable verbatim if it is quoted, so hand the
    // caller the config value that works instead of only the rule they broke - otherwise the feature
    // is only discoverable by finding the docs. When quoting would not help either, say which rule
    // stops it, rather than recommending a value that also throws or leaving the caller to guess.
    const problem = quotedNameProblem(name);
    const remedy = problem === null ? ` Pass it quoted to use it verbatim: schema: '"${name}"'` : ` Quoting will not help: a quoted name ${problem}.`;
    // Both rules are scoped to unquoted names - the message has to say so, since the quoted form
    // accepts far more than this.
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!/\W/.test(name), `Schema name ${JSON.stringify(name)} can only contain alphanumeric characters or underscores when unquoted.${remedy}`);
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!/^\d/.test(name), `Schema name ${JSON.stringify(name)} cannot start with a number when unquoted.${remedy}`);
}
function assertQueueName(name) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(name, 'Name is required');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof name === 'string', 'Name must be a string');
    assertObjectName(name);
}
function assertKey(key) {
    if (!key) return;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof key === 'string', 'Key must be a string');
    assertObjectName(key, 'Key');
}
function validateRetentionConfig(config) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('retentionSeconds' in config) || config.retentionSeconds >= 1, 'configuration assert: retentionSeconds must be at least every second');
}
function validateExpirationConfig(config) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('expireInSeconds' in config) || config.expireInSeconds >= 1, 'configuration assert: expireInSeconds must be at least every second');
    // inclusive, like every other option bounded by MAX_EXPIRATION_HOURS: an expiration of exactly
    // the maximum does not "exceed" it. this is also the value the docs recommend for the longest
    // jobs, and the value the maintenance interval defaults to.
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!config.expireInSeconds || config.expireInSeconds / 60 / 60 <= POLICY.MAX_EXPIRATION_HOURS, `configuration assert: expiration cannot exceed ${POLICY.MAX_EXPIRATION_HOURS} hours`);
}
function validateRetryConfig(config) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('retryDelay' in config) || Number.isInteger(config.retryDelay) && config.retryDelay >= 0, 'retryDelay must be an integer >= 0');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('retryLimit' in config) || Number.isInteger(config.retryLimit) && config.retryLimit >= 0, 'retryLimit must be an integer >= 0');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('retryBackoff' in config) || config.retryBackoff === true || config.retryBackoff === false, 'retryBackoff must be either true or false');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('retryDelayMax' in config) || config.retryDelayMax === null || config.retryBackoff === true, 'retryDelayMax can only be set if retryBackoff is true');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('retryDelayMax' in config) || config.retryDelayMax === null || Number.isInteger(config.retryDelayMax) && config.retryDelayMax >= 0, 'retryDelayMax must be an integer >= 0');
}
function validateHeartbeatConfig(config) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('heartbeatSeconds' in config) || config.heartbeatSeconds === null || Number.isInteger(config.heartbeatSeconds) && config.heartbeatSeconds >= 10, 'heartbeatSeconds must be an integer >= 10');
}
function validateHeartbeatRefreshConfig(config) {
    if (!('heartbeatRefreshSeconds' in config) || config.heartbeatRefreshSeconds == null) return;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof config.heartbeatRefreshSeconds === 'number' && config.heartbeatRefreshSeconds > 0, 'heartbeatRefreshSeconds must be a number > 0');
}
function applyPollingInterval(config) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('pollingIntervalSeconds' in config) || config.pollingIntervalSeconds >= POLICY.MIN_POLLING_INTERVAL_MS / 1000, `configuration assert: pollingIntervalSeconds must be at least every ${POLICY.MIN_POLLING_INTERVAL_MS}ms`);
    config.pollingInterval = 'pollingIntervalSeconds' in config ? config.pollingIntervalSeconds * 1000 : 2000;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('notifyPollingIntervalSeconds' in config) || config.notifyPollingIntervalSeconds >= POLICY.MIN_POLLING_INTERVAL_MS / 1000, `configuration assert: notifyPollingIntervalSeconds must be at least every ${POLICY.MIN_POLLING_INTERVAL_MS}ms`);
    // Relaxed backstop poll used only while NOTIFY is active for the queue; falls back to
    // pollingInterval when notify is unavailable. It must never be smaller than the base poll —
    // that would make a notify-active queue poll more aggressively than an idle one, the opposite
    // of the intent. When explicit, reject a value below the base; when defaulted, floor it at the
    // base so bumping pollingIntervalSeconds past 30s can't silently leave notify smaller.
    if ('notifyPollingIntervalSeconds' in config) {
        config.notifyPollingInterval = config.notifyPollingIntervalSeconds * 1000;
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(config.notifyPollingInterval >= config.pollingInterval, 'configuration assert: notifyPollingIntervalSeconds must be at least pollingIntervalSeconds');
    } else {
        config.notifyPollingInterval = Math.max(30000, config.pollingInterval);
    }
    // Burst triggers: no transform, just validation. Both put the worker into continuous-fetch
    // (no delay) mode; see JobPollingOptions for precedence.
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('burstWhenReadyExceeds' in config) || Number.isInteger(config.burstWhenReadyExceeds) && config.burstWhenReadyExceeds >= 1, 'configuration assert: burstWhenReadyExceeds must be an integer >= 1');
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('burstWhenBatchFull' in config) || typeof config.burstWhenBatchFull === 'boolean', 'configuration assert: burstWhenBatchFull must be a boolean');
}
function applyOpsConfig(config) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('superviseIntervalSeconds' in config) || config.superviseIntervalSeconds >= 1, 'configuration assert: superviseIntervalSeconds must be at least every second');
    config.superviseIntervalSeconds = config.superviseIntervalSeconds || 60;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(config.superviseIntervalSeconds / 60 / 60 <= POLICY.MAX_EXPIRATION_HOURS, `configuration assert: superviseIntervalSeconds cannot exceed ${POLICY.MAX_EXPIRATION_HOURS} hours`);
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('maintenanceIntervalSeconds' in config) || config.maintenanceIntervalSeconds >= 1, 'configuration assert: maintenanceIntervalSeconds must be at least every second');
    config.maintenanceIntervalSeconds = config.maintenanceIntervalSeconds || POLICY.MAX_EXPIRATION_HOURS * 60 * 60;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(config.maintenanceIntervalSeconds / 60 / 60 <= POLICY.MAX_EXPIRATION_HOURS, `configuration assert: maintenanceIntervalSeconds cannot exceed ${POLICY.MAX_EXPIRATION_HOURS} hours`);
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('monitorIntervalSeconds' in config) || config.monitorIntervalSeconds >= 1, 'configuration assert: monitorIntervalSeconds must be at least every second');
    config.monitorIntervalSeconds = config.monitorIntervalSeconds || 60;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(config.monitorIntervalSeconds / 60 / 60 <= POLICY.MAX_EXPIRATION_HOURS, `configuration assert: monitorIntervalSeconds cannot exceed ${POLICY.MAX_EXPIRATION_HOURS} hours`);
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('queueCacheIntervalSeconds' in config) || config.queueCacheIntervalSeconds >= 1, 'configuration assert: queueCacheIntervalSeconds must be at least every second');
    config.queueCacheIntervalSeconds = config.queueCacheIntervalSeconds || 60;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(config.queueCacheIntervalSeconds / 60 / 60 <= POLICY.MAX_EXPIRATION_HOURS, `configuration assert: queueCacheIntervalSeconds cannot exceed ${POLICY.MAX_EXPIRATION_HOURS} hours`);
    if ('queueStatRetentionDays' in config) {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(Number.isInteger(config.queueStatRetentionDays) && config.queueStatRetentionDays >= 1, 'configuration assert: queueStatRetentionDays must be an integer >= 1');
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(config.queueStatRetentionDays <= POLICY.MAX_RETENTION_DAYS, `configuration assert: queueStatRetentionDays cannot exceed ${POLICY.MAX_RETENTION_DAYS} days`);
    }
    config.queueStatRetentionDays = config.queueStatRetentionDays || 7;
}
function validateDeletionConfig(config) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('deleteAfterSeconds' in config) || config.deleteAfterSeconds >= 0, 'configuration assert: deleteAfterSeconds must be at least 0 (0 disables deletion)');
}
function applyScheduleConfig(config) {
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('clockMonitorIntervalSeconds' in config) || config.clockMonitorIntervalSeconds >= 1 && config.clockMonitorIntervalSeconds <= 600, 'configuration assert: clockMonitorIntervalSeconds must be between 1 second and 10 minutes');
    config.clockMonitorIntervalSeconds = config.clockMonitorIntervalSeconds || 600;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('cronMonitorIntervalSeconds' in config) || config.cronMonitorIntervalSeconds >= 1 && config.cronMonitorIntervalSeconds <= 45, 'configuration assert: cronMonitorIntervalSeconds must be between 1 and 45 seconds');
    config.cronMonitorIntervalSeconds = config.cronMonitorIntervalSeconds || 30;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('cronWorkerIntervalSeconds' in config) || config.cronWorkerIntervalSeconds >= 1 && config.cronWorkerIntervalSeconds <= 45, 'configuration assert: cronWorkerIntervalSeconds must be between 1 and 45 seconds');
    config.cronWorkerIntervalSeconds = config.cronWorkerIntervalSeconds || 5;
}
function applyBamConfig(config) {
    const minInterval = config.__test__bypass_bam_interval_check ? 1 : 10;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('bamIntervalSeconds' in config) || config.bamIntervalSeconds >= minInterval, `configuration assert: bamIntervalSeconds must be at least ${minInterval} seconds`);
    config.bamIntervalSeconds = config.bamIntervalSeconds || 60;
}
function applyFlowConfig(config) {
    const minInterval = config.__test__bypass_flow_interval_check ? 0.5 : 1;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!('flowIntervalSeconds' in config) || config.flowIntervalSeconds >= minInterval, `configuration assert: flowIntervalSeconds must be at least ${minInterval} seconds`);
    config.flowIntervalSeconds = config.flowIntervalSeconds || 5;
}
;
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/types.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/migrationStore.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getAll",
    ()=>getAll,
    "getMinVersion",
    ()=>getMinVersion,
    "migrate",
    ()=>migrate,
    "migrateCommands",
    ()=>migrateCommands,
    "next",
    ()=>next,
    "rollback",
    ()=>rollback
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:assert [external] (node:assert, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/plans.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/tools.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$types$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/types.js [instrumentation] (ecmascript)");
;
;
;
;
// 12.28.0 replaced the plain `string[]` partitionTables shape with { tableName, policy } records.
// TypeScript callers get a compile error; this keeps JavaScript callers from silently exporting a
// migration whose target list is wrong (a bare string has no policy, so every policy-scoped build
// would quietly drop it).
function assertPartitionMetadata(partitionTables) {
    for (const partition of partitionTables){
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof partition === 'object' && partition !== null && typeof partition.tableName === 'string' && typeof partition.policy === 'string', `partitionTables entries must be { tableName, policy } records, received: ${JSON.stringify(partition)}. The string[] form was removed in 12.28.0.`);
    }
}
// Mirrors the SQL job_table_format() function (src/plans.ts): rewrites a command targeting
// the base `job` table to target a specific partition table.
function formatJobTable(command, table) {
    // Anchor both rewrites so a schema name that itself contains these substrings (e.g. `job_intake`)
    // isn't mangled: `.job\b` only matches the base table reference (`schema.job`, not `schema.job_i5`
    // whose `job` is followed by `_`), and `job_iN` only matches the bare index-name tokens (job_i1..9),
    // never the `job_i` inside an arbitrary schema name.
    return command.replace(/\.job\b/g, `.${table}`).replace(/\bjob_i(\d+)/g, `${table}_i$1`);
}
// Derives the direct index DDL that a job_table_run_async() command would eventually run
// via BAM, one statement per target table, each prefixed with a provenance comment. The
// CONCURRENTLY keyword is preserved (these are emitted after COMMIT), and IF NOT EXISTS is
// added so the script is safe to re-run.
function inlineAsyncCommand(schema, asyncMigration, version, partitionTables) {
    // Two spellings: the legacy string form embeds the whole job_table_run_async() call as SQL, so
    // name/body/table-pin have to be parsed back out of it; the record form carries them as fields.
    const isLegacy = typeof asyncMigration === 'string';
    const asyncCommand = isLegacy ? asyncMigration : asyncMigration.command;
    const nameMatch = isLegacy ? asyncCommand.match(/job_table_run_async\(\s*'([^']+)'/) : null;
    const bodyMatch = isLegacy ? asyncCommand.match(/\$\$([\s\S]*?)\$\$/) : null;
    // An explicit table arg after the $$ body pins the command to a single table (e.g. i8 →
    // job_common); without it the command fans out across job_common + every partition.
    const tableMatch = isLegacy ? asyncCommand.match(/\$\$\s*,\s*'([^']+)'/) : null;
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!isLegacy || nameMatch && bodyMatch, `Unable to inline async migration command: ${asyncCommand}`);
    const commandName = isLegacy ? nameMatch[1] : asyncMigration.name;
    const body = (isLegacy ? bodyMatch[1] : asyncMigration.command).trim();
    // A policy-scoped build only belongs on partitions of that policy; unscoped builds fan out to all.
    const partitionPolicy = isLegacy ? undefined : asyncMigration.partitionPolicy;
    const eligiblePartitions = partitionTables.filter((partition)=>!partitionPolicy || partition.policy === partitionPolicy).map((partition)=>partition.tableName);
    const targetTables = tableMatch ? [
        tableMatch[1]
    ] : [
        'job_common',
        ...eligiblePartitions
    ];
    return targetTables.map((table)=>{
        // Add IF NOT EXISTS so the exported script is re-runnable. The negative lookahead keeps it
        // idempotent when the async command already spells out IF NOT EXISTS (the live BAM path needs it
        // there for its own idempotency — e.g. migration v36's job_i9 build), avoiding a double insert.
        const ddl = formatJobTable(body, table).replace(/(CREATE (?:UNIQUE )?INDEX CONCURRENTLY)(?! IF NOT EXISTS) /, '$1 IF NOT EXISTS ');
        const comment = `-- inlined from ${schema}.job_table_run_async (migration v${version}, command: ${commandName})`;
        return `${comment}\n${ddl}`;
    });
}
function renderAsyncCommand(schema, asyncMigration, version) {
    if (typeof asyncMigration === 'string') {
        return asyncMigration.replace(/\$VERSION\$/g, String(version));
    }
    const name = asyncMigration.name.replaceAll("'", "''");
    const policy = asyncMigration.partitionPolicy?.replaceAll("'", "''");
    if (!policy) {
        return `SELECT ${schema}.job_table_run_async('${name}', ${version}, $$${asyncMigration.command}$$)`;
    }
    // queue_name is passed alongside table_name so the enqueued rows record which queue each build
    // belongs to, matching what the unscoped fan-out inside job_table_run_async() writes. For a
    // partition row the function re-derives table_name from queue_name and lands on the same value;
    // job_common has no queue of its own, so its row keeps queue NULL like the fan-out does.
    return `SELECT ${schema}.job_table_run_async(
    '${name}',
    ${version},
    $$${asyncMigration.command}$$,
    targets.table_name,
    targets.queue_name
  )
  FROM (
    SELECT 'job_common'::text AS table_name, NULL::text AS queue_name
    UNION ALL
    SELECT table_name, name FROM ${schema}.queue WHERE partition = true AND policy = '${policy}'
  ) targets`;
}
function flatten(schema, commands, version, noAdvisoryLocks) {
    commands.unshift(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertMigration"](schema, version));
    commands.push(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["setVersion"](schema, version));
    return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["locked"](schema, commands, undefined, noAdvisoryLocks);
}
function rollback(schema, version, migrations, noAdvisoryLocks) {
    migrations = migrations || getAll(schema);
    const result = migrations.find((i)=>i.version === version);
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(result, `Version ${version} not found.`);
    // Async (BAM) index builds are enqueued as bam rows, and the BAM runner does not filter by schema
    // version — so a row left unfinished by a rollback would rebuild, one version later, the very index
    // the rollback just dropped. Clear this version's unfinished rows as part of the same transaction.
    // Only migrations that enqueue async commands can have any, and the migration that introduced BAM
    // is also the first one with async commands, so bam is guaranteed to exist here; ordering the delete
    // ahead of the migration's own steps keeps it before that migration's DROP TABLE bam.
    //
    // No guard against a build that is genuinely running: the uninstall steps drop the index the build
    // holds a ShareUpdateExclusiveLock on, so a live build already makes the whole rollback fail on the
    // transaction's lock_timeout, taking this delete with it.
    const clearAsync = result.async?.length ? [
        `DELETE FROM ${schema}.bam WHERE version = ${result.version} AND status <> 'completed'`
    ] : [];
    return flatten(schema, [
        ...clearAsync,
        ...result.uninstall || []
    ], result.previous, noAdvisoryLocks);
}
function next(schema, version, migrations, noAdvisoryLocks) {
    migrations = migrations || getAll(schema);
    const result = migrations.find((i)=>i.previous === version);
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(result, `Version ${version} not found.`);
    return flatten(schema, result.install, result.version, noAdvisoryLocks);
}
// Builds the migration as separate pieces: the transactional block plus any inlined
// CONCURRENTLY index builds (when options.inlineAsync). Callers that execute SQL
// programmatically must run `concurrent` statements individually, outside a transaction.
function migrateCommands(schema, version, migrations, noAdvisoryLocks, options = {}) {
    migrations = migrations || getAll(schema);
    // Refuse to migrate from a real DB version older than the oldest migration can start from.
    // Without this floor, `filter(i => i.previous >= version)` happily selects the whole chain for any
    // version below the minimum `previous`, applying migrations over missing intermediate steps — a
    // cryptic mid-transaction failure, or worse a "success" that stamps the latest version onto an
    // incomplete schema. Version 0 is the sentinel for a full "from scratch" export (getMigrationPlans)
    // and is intentionally exempt.
    // Only floor a valid numeric version; a non-numeric/garbage version falls through to the
    // "Version X not found" assert below. Version 0 is the full-export sentinel and is exempt.
    if (Number.isInteger(version) && version !== 0) {
        const minPrevious = Math.min(...migrations.map((i)=>i.previous));
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(version >= minPrevious, `Cannot migrate pg-boss schema from version ${version}: the oldest supported starting version is ${minPrevious}. ` + 'Upgrade to a schema at or above that version using an older pg-boss release first.');
    }
    assertPartitionMetadata(options.partitionTables || []);
    const concurrent = [];
    const result = migrations.filter((i)=>i.previous >= version).sort((a, b)=>a.version - b.version).reduce((acc, migration)=>{
        acc.install = acc.install.concat(migration.install);
        if (migration.async) {
            if (options.inlineAsync) {
                // Bypass BAM: emit the real index DDL (run after COMMIT) instead of enqueuing it.
                for (const cmd of migration.async){
                    concurrent.push(...inlineAsyncCommand(schema, cmd, migration.version, options.partitionTables || []));
                }
            } else {
                const bamCommands = migration.async.map((cmd)=>renderAsyncCommand(schema, cmd, migration.version));
                acc.install = acc.install.concat(bamCommands);
            }
        }
        acc.version = migration.version;
        return acc;
    }, {
        install: [],
        version
    });
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(result.install.length > 0, `Version ${version} not found.`);
    return {
        sql: flatten(schema, result.install, result.version, noAdvisoryLocks),
        concurrent
    };
}
// Renders a migration as a single SQL script. The inlined CONCURRENTLY builds are appended
// after COMMIT; this form is meant for printing/export (psql runs them individually). To
// apply programmatically, use migrateCommands() and execute `concurrent` separately.
function migrate(schema, version, migrations, noAdvisoryLocks, options = {}) {
    const { sql, concurrent } = migrateCommands(schema, version, migrations, noAdvisoryLocks, options);
    return concurrent.length ? `${sql}\n${concurrent.join(';\n')};` : sql;
}
const createQueueFn = {
    26: (schema)=>`
    CREATE OR REPLACE FUNCTION ${schema}.create_queue(queue_name text, options jsonb)
    RETURNS VOID AS
    $$
    DECLARE
      tablename varchar := CASE WHEN options->>'partition' = 'true'
                            THEN 'j' || encode(sha224(queue_name::bytea), 'hex')
                            ELSE 'job_common'
                            END;
      queue_created_on timestamptz;
    BEGIN

      WITH q as (
        INSERT INTO ${schema}.queue (
          name,
          policy,
          retry_limit,
          retry_delay,
          retry_backoff,
          retry_delay_max,
          expire_seconds,
          retention_seconds,
          deletion_seconds,
          warning_queued,
          dead_letter,
          partition,
          table_name
        )
        VALUES (
          queue_name,
          options->>'policy',
          COALESCE((options->>'retryLimit')::int, 2),
          COALESCE((options->>'retryDelay')::int, 0),
          COALESCE((options->>'retryBackoff')::bool, false),
          (options->>'retryDelayMax')::int,
          COALESCE((options->>'expireInSeconds')::int, 900),
          COALESCE((options->>'retentionSeconds')::int, 1209600),
          COALESCE((options->>'deleteAfterSeconds')::int, 604800),
          COALESCE((options->>'warningQueueSize')::int, 0),
          options->>'deadLetter',
          COALESCE((options->>'partition')::bool, false),
          tablename
        )
        ON CONFLICT DO NOTHING
        RETURNING created_on
      )
      SELECT created_on into queue_created_on from q;

      IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN
        RETURN;
      END IF;

      EXECUTE format('CREATE TABLE ${schema}.%I (LIKE ${schema}.job INCLUDING DEFAULTS)', tablename);

      EXECUTE format('ALTER TABLE ${schema}.%1$I ADD PRIMARY KEY (name, id)', tablename);
      EXECUTE format('ALTER TABLE ${schema}.%1$I ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED', tablename);
      EXECUTE format('ALTER TABLE ${schema}.%1$I ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED', tablename);

      EXECUTE format('CREATE INDEX %1$s_i5 ON ${schema}.%1$I (name, start_after) INCLUDE (priority, created_on, id) WHERE state < ''active''', tablename);
      EXECUTE format('CREATE UNIQUE INDEX %1$s_i4 ON ${schema}.%1$I (name, singleton_on, COALESCE(singleton_key, '''')) WHERE state <> ''cancelled'' AND singleton_on IS NOT NULL', tablename);

      IF options->>'policy' = 'short' THEN
        EXECUTE format('CREATE UNIQUE INDEX %1$s_i1 ON ${schema}.%1$I (name, COALESCE(singleton_key, '''')) WHERE state = ''created'' AND policy = ''short''', tablename);
      ELSIF options->>'policy' = 'singleton' THEN
        EXECUTE format('CREATE UNIQUE INDEX %1$s_i2 ON ${schema}.%1$I (name, COALESCE(singleton_key, '''')) WHERE state = ''active'' AND policy = ''singleton''', tablename);
      ELSIF options->>'policy' = 'stately' THEN
        EXECUTE format('CREATE UNIQUE INDEX %1$s_i3 ON ${schema}.%1$I (name, state, COALESCE(singleton_key, '''')) WHERE state <= ''active'' AND policy = ''stately''', tablename);
      ELSIF options->>'policy' = 'exclusive' THEN
        EXECUTE format('CREATE UNIQUE INDEX %1$s_i6 ON ${schema}.%1$I (name, COALESCE(singleton_key, '''')) WHERE state <= ''active'' AND policy = ''exclusive''', tablename);
      END IF;

      EXECUTE format('ALTER TABLE ${schema}.%I ADD CONSTRAINT cjc CHECK (name=%L)', tablename, queue_name);
      EXECUTE format('ALTER TABLE ${schema}.job ATTACH PARTITION ${schema}.%I FOR VALUES IN (%L)', tablename, queue_name);
    END;
    $$
    LANGUAGE plpgsql;
  `,
    27: (schema)=>`
    CREATE OR REPLACE FUNCTION ${schema}.create_queue(queue_name text, options jsonb)
    RETURNS VOID AS
    $$
    DECLARE
      tablename varchar := CASE WHEN options->>'partition' = 'true'
                            THEN 'j' || encode(sha224(queue_name::bytea), 'hex')
                            ELSE 'job_common'
                            END;
      queue_created_on timestamptz;
    BEGIN

      WITH q as (
        INSERT INTO ${schema}.queue (
          name,
          policy,
          retry_limit,
          retry_delay,
          retry_backoff,
          retry_delay_max,
          expire_seconds,
          retention_seconds,
          deletion_seconds,
          warning_queued,
          dead_letter,
          partition,
          table_name
        )
        VALUES (
          queue_name,
          options->>'policy',
          COALESCE((options->>'retryLimit')::int, 2),
          COALESCE((options->>'retryDelay')::int, 0),
          COALESCE((options->>'retryBackoff')::bool, false),
          (options->>'retryDelayMax')::int,
          COALESCE((options->>'expireInSeconds')::int, 900),
          COALESCE((options->>'retentionSeconds')::int, 1209600),
          COALESCE((options->>'deleteAfterSeconds')::int, 604800),
          COALESCE((options->>'warningQueueSize')::int, 0),
          options->>'deadLetter',
          COALESCE((options->>'partition')::bool, false),
          tablename
        )
        ON CONFLICT DO NOTHING
        RETURNING created_on
      )
      SELECT created_on into queue_created_on from q;

      IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN
        RETURN;
      END IF;

      EXECUTE format('CREATE TABLE ${schema}.%I (LIKE ${schema}.job INCLUDING DEFAULTS)', tablename);

      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD PRIMARY KEY (name, id)$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);

      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i5 ON ${schema}.job (name, start_after) INCLUDE (priority, created_on, id) WHERE state < 'active'$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i4 ON ${schema}.job (name, singleton_on, COALESCE(singleton_key, '')) WHERE state <> 'cancelled' AND singleton_on IS NOT NULL$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i7 ON ${schema}.job (name, group_id) WHERE state = 'active' AND group_id IS NOT NULL$cmd$, tablename);

      IF options->>'policy' = 'short' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i1 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = 'created' AND policy = 'short'$cmd$, tablename);
      ELSIF options->>'policy' = 'singleton' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i2 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = 'active' AND policy = 'singleton'$cmd$, tablename);
      ELSIF options->>'policy' = 'stately' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i3 ON ${schema}.job (name, state, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'stately'$cmd$, tablename);
      ELSIF options->>'policy' = 'exclusive' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i6 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'exclusive'$cmd$, tablename);
      END IF;

      EXECUTE format('ALTER TABLE ${schema}.%I ADD CONSTRAINT cjc CHECK (name=%L)', tablename, queue_name);
      EXECUTE format('ALTER TABLE ${schema}.job ATTACH PARTITION ${schema}.%I FOR VALUES IN (%L)', tablename, queue_name);
    END;
    $$
    LANGUAGE plpgsql;
  `,
    28: (schema)=>`
    CREATE OR REPLACE FUNCTION ${schema}.create_queue(queue_name text, options jsonb)
    RETURNS VOID AS
    $$
    DECLARE
      tablename varchar := CASE WHEN options->>'partition' = 'true'
                            THEN 'j' || encode(sha224(queue_name::bytea), 'hex')
                            ELSE 'job_common'
                            END;
      queue_created_on timestamptz;
    BEGIN

      WITH q as (
        INSERT INTO ${schema}.queue (
          name,
          policy,
          retry_limit,
          retry_delay,
          retry_backoff,
          retry_delay_max,
          expire_seconds,
          retention_seconds,
          deletion_seconds,
          warning_queued,
          dead_letter,
          partition,
          table_name
        )
        VALUES (
          queue_name,
          options->>'policy',
          COALESCE((options->>'retryLimit')::int, 2),
          COALESCE((options->>'retryDelay')::int, 0),
          COALESCE((options->>'retryBackoff')::bool, false),
          (options->>'retryDelayMax')::int,
          COALESCE((options->>'expireInSeconds')::int, 900),
          COALESCE((options->>'retentionSeconds')::int, 1209600),
          COALESCE((options->>'deleteAfterSeconds')::int, 604800),
          COALESCE((options->>'warningQueueSize')::int, 0),
          options->>'deadLetter',
          COALESCE((options->>'partition')::bool, false),
          tablename
        )
        ON CONFLICT DO NOTHING
        RETURNING created_on
      )
      SELECT created_on into queue_created_on from q;

      IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN
        RETURN;
      END IF;

      EXECUTE format('CREATE TABLE ${schema}.%I (LIKE ${schema}.job INCLUDING DEFAULTS)', tablename);

      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD PRIMARY KEY (name, id)$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);

      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i5 ON ${schema}.job (name, start_after) INCLUDE (priority, created_on, id) WHERE state < 'active'$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i4 ON ${schema}.job (name, singleton_on, COALESCE(singleton_key, '')) WHERE state <> 'cancelled' AND singleton_on IS NOT NULL$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i7 ON ${schema}.job (name, group_id) WHERE state = 'active' AND group_id IS NOT NULL$cmd$, tablename);

      IF options->>'policy' = 'short' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i1 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = 'created' AND policy = 'short'$cmd$, tablename);
      ELSIF options->>'policy' = 'singleton' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i2 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = 'active' AND policy = 'singleton'$cmd$, tablename);
      ELSIF options->>'policy' = 'stately' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i3 ON ${schema}.job (name, state, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'stately'$cmd$, tablename);
      ELSIF options->>'policy' = 'exclusive' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i6 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'exclusive'$cmd$, tablename);
      ELSIF options->>'policy' = 'key_strict_fifo' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i8 ON ${schema}.job (name, singleton_key) WHERE state IN ('active', 'retry', 'failed') AND policy = 'key_strict_fifo'$cmd$, tablename);
        EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT job_key_strict_fifo_singleton_key_check CHECK (NOT (policy = 'key_strict_fifo' AND singleton_key IS NULL))$cmd$, tablename);
      END IF;

      EXECUTE format('ALTER TABLE ${schema}.%I ADD CONSTRAINT cjc CHECK (name=%L)', tablename, queue_name);
      EXECUTE format('ALTER TABLE ${schema}.job ATTACH PARTITION ${schema}.%I FOR VALUES IN (%L)', tablename, queue_name);
    END;
    $$
    LANGUAGE plpgsql;
  `,
    30: (schema)=>`
    CREATE OR REPLACE FUNCTION ${schema}.create_queue(queue_name text, options jsonb)
    RETURNS VOID AS
    $$
    DECLARE
      tablename varchar := CASE WHEN options->>'partition' = 'true'
                            THEN 'j' || encode(sha224(queue_name::bytea), 'hex')
                            ELSE 'job_common'
                            END;
      queue_created_on timestamptz;
    BEGIN

      WITH q as (
        INSERT INTO ${schema}.queue (
          name,
          policy,
          retry_limit,
          retry_delay,
          retry_backoff,
          retry_delay_max,
          expire_seconds,
          retention_seconds,
          deletion_seconds,
          warning_queued,
          dead_letter,
          partition,
          table_name,
          heartbeat_seconds
        )
        VALUES (
          queue_name,
          options->>'policy',
          COALESCE((options->>'retryLimit')::int, 2),
          COALESCE((options->>'retryDelay')::int, 0),
          COALESCE((options->>'retryBackoff')::bool, false),
          (options->>'retryDelayMax')::int,
          COALESCE((options->>'expireInSeconds')::int, 900),
          COALESCE((options->>'retentionSeconds')::int, 1209600),
          COALESCE((options->>'deleteAfterSeconds')::int, 604800),
          COALESCE((options->>'warningQueueSize')::int, 0),
          options->>'deadLetter',
          COALESCE((options->>'partition')::bool, false),
          tablename,
          (options->>'heartbeatSeconds')::int
        )
        ON CONFLICT DO NOTHING
        RETURNING created_on
      )
      SELECT created_on into queue_created_on from q;

      IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN
        RETURN;
      END IF;

      EXECUTE format('CREATE TABLE ${schema}.%I (LIKE ${schema}.job INCLUDING DEFAULTS)', tablename);

      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD PRIMARY KEY (name, id)$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);

      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i5 ON ${schema}.job (name, start_after) INCLUDE (priority, created_on, id) WHERE state < 'active'$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i4 ON ${schema}.job (name, singleton_on, COALESCE(singleton_key, '')) WHERE state <> 'cancelled' AND singleton_on IS NOT NULL$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i7 ON ${schema}.job (name, group_id) WHERE state = 'active' AND group_id IS NOT NULL$cmd$, tablename);

      IF options->>'policy' = 'short' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i1 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = 'created' AND policy = 'short'$cmd$, tablename);
      ELSIF options->>'policy' = 'singleton' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i2 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = 'active' AND policy = 'singleton'$cmd$, tablename);
      ELSIF options->>'policy' = 'stately' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i3 ON ${schema}.job (name, state, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'stately'$cmd$, tablename);
      ELSIF options->>'policy' = 'exclusive' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i6 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'exclusive'$cmd$, tablename);
      ELSIF options->>'policy' = 'key_strict_fifo' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i8 ON ${schema}.job (name, singleton_key) WHERE state IN ('active', 'retry', 'failed') AND policy = 'key_strict_fifo'$cmd$, tablename);
        EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT job_key_strict_fifo_singleton_key_check CHECK (NOT (policy = 'key_strict_fifo' AND singleton_key IS NULL))$cmd$, tablename);
      END IF;

      EXECUTE format('ALTER TABLE ${schema}.%I ADD CONSTRAINT cjc CHECK (name=%L)', tablename, queue_name);
      EXECUTE format('ALTER TABLE ${schema}.job ATTACH PARTITION ${schema}.%I FOR VALUES IN (%L)', tablename, queue_name);
    END;
    $$
    LANGUAGE plpgsql;
  `,
    31: (schema)=>`
    CREATE OR REPLACE FUNCTION ${schema}.create_queue(queue_name text, options jsonb)
    RETURNS VOID AS
    $$
    DECLARE
      tablename varchar := CASE WHEN options->>'partition' = 'true'
                            THEN 'j' || encode(sha224(queue_name::bytea), 'hex')
                            ELSE 'job_common'
                            END;
      queue_created_on timestamptz;
    BEGIN

      WITH q as (
        INSERT INTO ${schema}.queue (
          name,
          policy,
          retry_limit,
          retry_delay,
          retry_backoff,
          retry_delay_max,
          expire_seconds,
          retention_seconds,
          deletion_seconds,
          warning_queued,
          dead_letter,
          partition,
          table_name,
          heartbeat_seconds
        )
        VALUES (
          queue_name,
          options->>'policy',
          COALESCE((options->>'retryLimit')::int, 2),
          COALESCE((options->>'retryDelay')::int, 0),
          COALESCE((options->>'retryBackoff')::bool, false),
          (options->>'retryDelayMax')::int,
          COALESCE((options->>'expireInSeconds')::int, 900),
          COALESCE((options->>'retentionSeconds')::int, 1209600),
          COALESCE((options->>'deleteAfterSeconds')::int, 604800),
          COALESCE((options->>'warningQueueSize')::int, 0),
          options->>'deadLetter',
          COALESCE((options->>'partition')::bool, false),
          tablename,
          (options->>'heartbeatSeconds')::int
        )
        ON CONFLICT DO NOTHING
        RETURNING created_on
      )
      SELECT created_on into queue_created_on from q;

      IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN
        RETURN;
      END IF;

      EXECUTE format('CREATE TABLE ${schema}.%I (LIKE ${schema}.job INCLUDING DEFAULTS)', tablename);

      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD PRIMARY KEY (name, id)$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);

      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i5 ON ${schema}.job (name, start_after) INCLUDE (priority, created_on, id) WHERE state < 'active' AND NOT blocked$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i4 ON ${schema}.job (name, singleton_on, COALESCE(singleton_key, '')) WHERE state <> 'cancelled' AND singleton_on IS NOT NULL$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i7 ON ${schema}.job (name, group_id) WHERE state = 'active' AND group_id IS NOT NULL$cmd$, tablename);

      IF options->>'policy' = 'short' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i1 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = 'created' AND policy = 'short'$cmd$, tablename);
      ELSIF options->>'policy' = 'singleton' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i2 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = 'active' AND policy = 'singleton'$cmd$, tablename);
      ELSIF options->>'policy' = 'stately' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i3 ON ${schema}.job (name, state, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'stately'$cmd$, tablename);
      ELSIF options->>'policy' = 'exclusive' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i6 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'exclusive'$cmd$, tablename);
      ELSIF options->>'policy' = 'key_strict_fifo' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i8 ON ${schema}.job (name, singleton_key) WHERE state IN ('active', 'retry', 'failed') AND policy = 'key_strict_fifo'$cmd$, tablename);
        EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT job_key_strict_fifo_singleton_key_check CHECK (NOT (policy = 'key_strict_fifo' AND singleton_key IS NULL))$cmd$, tablename);
      END IF;

      EXECUTE format('ALTER TABLE ${schema}.%I ADD CONSTRAINT cjc CHECK (name=%L)', tablename, queue_name);
      EXECUTE format('ALTER TABLE ${schema}.job ATTACH PARTITION ${schema}.%I FOR VALUES IN (%L)', tablename, queue_name);
    END;
    $$
    LANGUAGE plpgsql;
  `,
    32: (schema)=>`
    CREATE OR REPLACE FUNCTION ${schema}.create_queue(queue_name text, options jsonb)
    RETURNS VOID AS
    $$
    DECLARE
      tablename varchar := CASE WHEN options->>'partition' = 'true'
                            THEN 'j' || encode(sha224(queue_name::bytea), 'hex')
                            ELSE 'job_common'
                            END;
      queue_created_on timestamptz;
    BEGIN

      WITH q as (
        INSERT INTO ${schema}.queue (
          name,
          policy,
          retry_limit,
          retry_delay,
          retry_backoff,
          retry_delay_max,
          expire_seconds,
          retention_seconds,
          deletion_seconds,
          warning_queued,
          dead_letter,
          partition,
          table_name,
          heartbeat_seconds,
          notify
        )
        VALUES (
          queue_name,
          options->>'policy',
          COALESCE((options->>'retryLimit')::int, 2),
          COALESCE((options->>'retryDelay')::int, 0),
          COALESCE((options->>'retryBackoff')::bool, false),
          (options->>'retryDelayMax')::int,
          COALESCE((options->>'expireInSeconds')::int, 900),
          COALESCE((options->>'retentionSeconds')::int, 1209600),
          COALESCE((options->>'deleteAfterSeconds')::int, 604800),
          COALESCE((options->>'warningQueueSize')::int, 0),
          options->>'deadLetter',
          COALESCE((options->>'partition')::bool, false),
          tablename,
          (options->>'heartbeatSeconds')::int,
          COALESCE((options->>'notify')::bool, false)
        )
        ON CONFLICT DO NOTHING
        RETURNING created_on
      )
      SELECT created_on into queue_created_on from q;

      IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN
        RETURN;
      END IF;

      EXECUTE format('CREATE TABLE ${schema}.%I (LIKE ${schema}.job INCLUDING DEFAULTS)', tablename);

      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD PRIMARY KEY (name, id)$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);

      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i5 ON ${schema}.job (name, start_after) INCLUDE (priority, created_on, id) WHERE state < 'active' AND NOT blocked$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i4 ON ${schema}.job (name, singleton_on, COALESCE(singleton_key, '')) WHERE state <> 'cancelled' AND singleton_on IS NOT NULL$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i7 ON ${schema}.job (name, group_id) WHERE state = 'active' AND group_id IS NOT NULL$cmd$, tablename);

      IF options->>'policy' = 'short' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i1 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = 'created' AND policy = 'short'$cmd$, tablename);
      ELSIF options->>'policy' = 'singleton' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i2 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = 'active' AND policy = 'singleton'$cmd$, tablename);
      ELSIF options->>'policy' = 'stately' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i3 ON ${schema}.job (name, state, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'stately'$cmd$, tablename);
      ELSIF options->>'policy' = 'exclusive' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i6 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'exclusive'$cmd$, tablename);
      ELSIF options->>'policy' = 'key_strict_fifo' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i8 ON ${schema}.job (name, singleton_key) WHERE state IN ('active', 'retry', 'failed') AND policy = 'key_strict_fifo'$cmd$, tablename);
        EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT job_key_strict_fifo_singleton_key_check CHECK (NOT (policy = 'key_strict_fifo' AND singleton_key IS NULL))$cmd$, tablename);
      END IF;

      EXECUTE format('ALTER TABLE ${schema}.%I ADD CONSTRAINT cjc CHECK (name=%L)', tablename, queue_name);
      EXECUTE format('ALTER TABLE ${schema}.job ATTACH PARTITION ${schema}.%I FOR VALUES IN (%L)', tablename, queue_name);
    END;
    $$
    LANGUAGE plpgsql;
  `,
    33: (schema)=>`
    CREATE OR REPLACE FUNCTION ${schema}.create_queue(queue_name text, options jsonb)
    RETURNS VOID AS
    $$
    DECLARE
      tablename varchar := CASE WHEN options->>'partition' = 'true'
                            THEN 'j' || encode(sha224(queue_name::bytea), 'hex')
                            ELSE 'job_common'
                            END;
      queue_created_on timestamptz;
    BEGIN

      WITH q as (
        INSERT INTO ${schema}.queue (
          name,
          policy,
          retry_limit,
          retry_delay,
          retry_backoff,
          retry_delay_max,
          expire_seconds,
          retention_seconds,
          deletion_seconds,
          warning_queued,
          dead_letter,
          partition,
          table_name,
          heartbeat_seconds,
          notify
        )
        VALUES (
          queue_name,
          options->>'policy',
          COALESCE((options->>'retryLimit')::int, 2),
          COALESCE((options->>'retryDelay')::int, 0),
          COALESCE((options->>'retryBackoff')::bool, false),
          (options->>'retryDelayMax')::int,
          COALESCE((options->>'expireInSeconds')::int, 900),
          COALESCE((options->>'retentionSeconds')::int, 1209600),
          COALESCE((options->>'deleteAfterSeconds')::int, 604800),
          COALESCE((options->>'warningQueueSize')::int, 0),
          options->>'deadLetter',
          COALESCE((options->>'partition')::bool, false),
          tablename,
          (options->>'heartbeatSeconds')::int,
          COALESCE((options->>'notify')::bool, false)
        )
        ON CONFLICT DO NOTHING
        RETURNING created_on
      )
      SELECT created_on into queue_created_on from q;

      IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN
        RETURN;
      END IF;

      EXECUTE format('CREATE TABLE ${schema}.%I (LIKE ${schema}.job INCLUDING DEFAULTS)', tablename);

      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD PRIMARY KEY (name, id)$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);

      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i5 ON ${schema}.job (name, start_after) WHERE state < 'active' AND NOT blocked$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i4 ON ${schema}.job (name, singleton_on, COALESCE(singleton_key, '')) WHERE state <> 'cancelled' AND singleton_on IS NOT NULL$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i7 ON ${schema}.job (name, group_id) WHERE state = 'active' AND group_id IS NOT NULL$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i9 ON ${schema}.job (name, id) WHERE blocking AND state = 'completed'$cmd$, tablename);

      IF options->>'policy' = 'short' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i1 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = 'created' AND policy = 'short'$cmd$, tablename);
      ELSIF options->>'policy' = 'singleton' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i2 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = 'active' AND policy = 'singleton'$cmd$, tablename);
      ELSIF options->>'policy' = 'stately' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i3 ON ${schema}.job (name, state, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'stately'$cmd$, tablename);
      ELSIF options->>'policy' = 'exclusive' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i6 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'exclusive'$cmd$, tablename);
      ELSIF options->>'policy' = 'key_strict_fifo' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i8 ON ${schema}.job (name, singleton_key) WHERE state IN ('active', 'retry', 'failed') AND policy = 'key_strict_fifo'$cmd$, tablename);
        EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT job_key_strict_fifo_singleton_key_check CHECK (NOT (policy = 'key_strict_fifo' AND singleton_key IS NULL))$cmd$, tablename);
      END IF;

      EXECUTE format('ALTER TABLE ${schema}.%I ADD CONSTRAINT cjc CHECK (name=%L)', tablename, queue_name);
      EXECUTE format('ALTER TABLE ${schema}.job ATTACH PARTITION ${schema}.%I FOR VALUES IN (%L)', tablename, queue_name);
    END;
    $$
    LANGUAGE plpgsql;
  `,
    38: (schema)=>`
    CREATE OR REPLACE FUNCTION ${schema}.create_queue(queue_name text, options jsonb)
    RETURNS VOID AS
    $$
    DECLARE
      tablename varchar := CASE WHEN options->>'partition' = 'true'
                            THEN 'j' || encode(sha224(queue_name::bytea), 'hex')
                            ELSE 'job_common'
                            END;
      queue_created_on timestamptz;
    BEGIN

      WITH q as (
        INSERT INTO ${schema}.queue (
          name,
          policy,
          retry_limit,
          retry_delay,
          retry_backoff,
          retry_delay_max,
          expire_seconds,
          retention_seconds,
          deletion_seconds,
          warning_queued,
          dead_letter,
          partition,
          table_name,
          heartbeat_seconds,
          notify
        )
        VALUES (
          queue_name,
          options->>'policy',
          COALESCE((options->>'retryLimit')::int, 2),
          COALESCE((options->>'retryDelay')::int, 0),
          COALESCE((options->>'retryBackoff')::bool, false),
          (options->>'retryDelayMax')::int,
          COALESCE((options->>'expireInSeconds')::int, 900),
          COALESCE((options->>'retentionSeconds')::int, 1209600),
          COALESCE((options->>'deleteAfterSeconds')::int, 604800),
          COALESCE((options->>'warningQueueSize')::int, 0),
          options->>'deadLetter',
          COALESCE((options->>'partition')::bool, false),
          tablename,
          (options->>'heartbeatSeconds')::int,
          COALESCE((options->>'notify')::bool, false)
        )
        ON CONFLICT DO NOTHING
        RETURNING created_on
      )
      SELECT created_on into queue_created_on from q;

      IF queue_created_on IS NULL OR options->>'partition' IS DISTINCT FROM 'true' THEN
        RETURN;
      END IF;

      EXECUTE format('CREATE TABLE ${schema}.%I (LIKE ${schema}.job INCLUDING DEFAULTS)', tablename);

      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD PRIMARY KEY (name, id)$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT q_fkey FOREIGN KEY (name) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT dlq_fkey FOREIGN KEY (dead_letter) REFERENCES ${schema}.queue (name) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED$cmd$, tablename);

      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i5 ON ${schema}.job (name, start_after) WHERE state < 'active' AND NOT blocked$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i4 ON ${schema}.job (name, singleton_on, COALESCE(singleton_key, '')) WHERE state <> 'cancelled' AND singleton_on IS NOT NULL$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i7 ON ${schema}.job (name, group_id) WHERE state = 'active' AND group_id IS NOT NULL$cmd$, tablename);
      EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i9 ON ${schema}.job (name, id) WHERE blocking AND state = 'completed'$cmd$, tablename);

      IF options->>'policy' = 'short' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i1 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = 'created' AND policy = 'short'$cmd$, tablename);
      ELSIF options->>'policy' = 'singleton' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i2 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state = 'active' AND policy = 'singleton'$cmd$, tablename);
      ELSIF options->>'policy' = 'stately' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i3 ON ${schema}.job (name, state, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'stately'$cmd$, tablename);
      ELSIF options->>'policy' = 'exclusive' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i6 ON ${schema}.job (name, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'exclusive'$cmd$, tablename);
      ELSIF options->>'policy' = 'key_strict_fifo' THEN
        EXECUTE ${schema}.job_table_format($cmd$CREATE UNIQUE INDEX job_i8 ON ${schema}.job (name, singleton_key) WHERE state IN ('active', 'retry', 'failed') AND policy = 'key_strict_fifo'$cmd$, tablename);
        EXECUTE ${schema}.job_table_format($cmd$CREATE INDEX job_i10 ON ${schema}.job (name, singleton_key, state DESC, created_on, id) INCLUDE (start_after) WHERE state < 'active' AND NOT blocked AND policy = 'key_strict_fifo'$cmd$, tablename);
        EXECUTE ${schema}.job_table_format($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT job_key_strict_fifo_singleton_key_check CHECK (NOT (policy = 'key_strict_fifo' AND singleton_key IS NULL))$cmd$, tablename);
      END IF;

      EXECUTE format('ALTER TABLE ${schema}.%I ADD CONSTRAINT cjc CHECK (name=%L)', tablename, queue_name);
      EXECUTE format('ALTER TABLE ${schema}.job ATTACH PARTITION ${schema}.%I FOR VALUES IN (%L)', tablename, queue_name);
    END;
    $$
    LANGUAGE plpgsql;
  `
};
// Frozen per-version snapshots of the queue_stats DDL, version-keyed like createQueueFn above. A
// migration must always emit the DDL as it was authored for that schema version; the plans.* builders
// track the *current* schema and will drift as it evolves, so the migration copies the DDL here
// rather than importing it. When a later version changes queue_stats, add a new keyed entry and leave
// the older ones untouched.
const createTableQueueStatsFn = {
    35: (schema, noPartitioning)=>noPartitioning ? `
      CREATE TABLE ${schema}.queue_stats (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        name text NOT NULL,
        deferred_count int NOT NULL DEFAULT 0,
        queued_count   int NOT NULL DEFAULT 0,
        ready_count    int NOT NULL DEFAULT 0,
        active_count   int NOT NULL DEFAULT 0,
        failed_count   int NOT NULL DEFAULT 0,
        total_count    int NOT NULL DEFAULT 0,
        captured_on timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (id)
      )
    ` : `
    CREATE TABLE ${schema}.queue_stats (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      name text NOT NULL,
      deferred_count int NOT NULL DEFAULT 0,
      queued_count   int NOT NULL DEFAULT 0,
      ready_count    int NOT NULL DEFAULT 0,
      active_count   int NOT NULL DEFAULT 0,
      failed_count   int NOT NULL DEFAULT 0,
      total_count    int NOT NULL DEFAULT 0,
      captured_on timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (id, captured_on)
    ) PARTITION BY RANGE (captured_on)
  `
};
const createIndexQueueStatsFn = {
    35: (schema, noCovering)=>{
        const cols = '(name, captured_on DESC)';
        const include = 'INCLUDE (deferred_count, queued_count, ready_count, active_count, failed_count, total_count)';
        return noCovering ? `CREATE INDEX queue_stats_i1 ON ${schema}.queue_stats ${cols}` : `CREATE INDEX queue_stats_i1 ON ${schema}.queue_stats ${cols} ${include}`;
    }
};
// The nspname comparison needs the resolved catalog name, same as plans.ensureQueueStatsPartitions.
// This does change the SQL a frozen migration emits, but only for names the check could never have
// matched anyway (quoted, or bare mixed-case), and only from "silently creates a partition it
// already believes is missing" to "checks correctly".
const ensureQueueStatsPartitionsFn = {
    35: (schema)=>`
    DO $$
    DECLARE
      d date;
      i int;
      part_name text;
    BEGIN
      FOR i IN 0..1 LOOP
        d := (now() AT TIME ZONE 'UTC')::date + i;
        part_name := 'queue_stats_' || to_char(d, 'YYYYMMDD');
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = '${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveSchemaName"])(schema)}' AND c.relname = part_name
        ) THEN
          EXECUTE format(
            'CREATE TABLE ${schema}.%I PARTITION OF ${schema}.queue_stats FOR VALUES FROM (%L) TO (%L)',
            part_name,
            to_char(d, 'YYYY-MM-DD') || ' 00:00:00+00',
            to_char(d + 1, 'YYYY-MM-DD') || ' 00:00:00+00'
          );
        END IF;
      END LOOP;
    END;
    $$
  `
};
// Frozen job_table_format() bodies, one per schema version, so the v37 migration is an immutable
// snapshot even if plans.jobTableFormatFunction drifts later. 37 is the anchored regexp_replace
// fix (matches only the base table reference and bare job_iN tokens); 36 is the prior naive
// replace(), kept solely so v37's rollback restores the exact previous definition.
const jobTableFormatFn = {
    36: (schema)=>`
    CREATE OR REPLACE FUNCTION ${schema}.job_table_format(command text, table_name text)
    RETURNS text AS
    $$
      SELECT format(
        replace(
          replace(command, '.job', '.%1$I'),
          'job_i', '%1$s_i'
        ),
        table_name
      );
    $$
    LANGUAGE sql IMMUTABLE;
  `,
    37: (schema)=>`
    CREATE OR REPLACE FUNCTION ${schema}.job_table_format(command text, table_name text)
    RETURNS text AS
    $$
      SELECT format(
        regexp_replace(
          regexp_replace(command, '\\.job\\y', '.%1$I', 'g'),
          '\\yjob_i(\\d+)', '%1$s_i\\1', 'g'
        ),
        table_name
      );
    $$
    LANGUAGE sql IMMUTABLE;
  `
};
// Lowest schema version a migration can start from (the smallest `previous` in the set). Below
// this there is no chain to apply; callers use it as an honest floor / offline fallback.
function getMinVersion(schema) {
    return Math.min(...getAll(schema).map((i)=>i.previous));
}
function getAll(schema, noPartitioning = false, noCovering = false) {
    return [
        {
            release: '11.1.0',
            version: 26,
            previous: 25,
            install: [
                createQueueFn[26](schema),
                `CREATE UNIQUE INDEX job_i6 ON ${schema}.job_common (name, COALESCE(singleton_key, '')) WHERE state <= 'active' AND policy = 'exclusive'`
            ],
            uninstall: [
                `DROP INDEX ${schema}.job_i6`
            ]
        },
        {
            release: '12.6.0',
            version: 27,
            previous: 26,
            install: [
                `ALTER TABLE ${schema}.version ADD COLUMN IF NOT EXISTS bam_on timestamp with time zone`,
                `
        CREATE TABLE IF NOT EXISTS ${schema}.bam (
          id uuid PRIMARY KEY default gen_random_uuid(),
          name text NOT NULL,
          version int NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          queue text,
          table_name text NOT NULL,
          command text NOT NULL,
          error text,
          created_on timestamp with time zone NOT NULL DEFAULT now(),
          started_on timestamp with time zone,
          completed_on timestamp with time zone
        )
        `,
                `CREATE FUNCTION ${schema}.job_table_format(command text, table_name text)
          RETURNS text AS
          $$
            SELECT format(
              replace(
                replace(command, '.job', '.%1$I'),
                'job_i', '%1$s_i'
              ),
              table_name
            );
          $$
          LANGUAGE sql IMMUTABLE;
        `,
                `
        CREATE OR REPLACE FUNCTION ${schema}.job_table_run_async(command_name text, version int, command text, tbl_name text DEFAULT NULL, queue_name text DEFAULT NULL)
        RETURNS VOID AS
        $$
        BEGIN
          IF queue_name IS NOT NULL THEN
            SELECT table_name INTO tbl_name FROM ${schema}.queue WHERE name = queue_name;
          END IF;

          IF tbl_name IS NOT NULL THEN
            INSERT INTO ${schema}.bam (name, version, status, queue, table_name, command)
            VALUES (
              command_name,
              version,
              'pending',
              queue_name,
              tbl_name,
              ${schema}.job_table_format(command, tbl_name)
            );
            RETURN;
          END IF;

          INSERT INTO ${schema}.bam (name, version, status, queue, table_name, command)
          SELECT
            command_name,
            version,
            'pending',
            NULL,
            'job_common',
            ${schema}.job_table_format(command, 'job_common')
          UNION ALL
          SELECT
            command_name,
            version,
            'pending',
            queue.name,
            queue.table_name,
            ${schema}.job_table_format(command, queue.table_name)
          FROM ${schema}.queue
          WHERE partition = true;
        END;
        $$
        LANGUAGE plpgsql;
        `,
                `
        CREATE OR REPLACE FUNCTION ${schema}.job_table_run(command text, tbl_name text DEFAULT NULL, queue_name text DEFAULT NULL)
        RETURNS VOID AS
        $$
        DECLARE
          tbl RECORD;
        BEGIN
          IF queue_name IS NOT NULL THEN
            SELECT table_name INTO tbl_name FROM ${schema}.queue WHERE name = queue_name;
          END IF;

          IF tbl_name IS NOT NULL THEN
            EXECUTE ${schema}.job_table_format(command, tbl_name);
            RETURN;
          END IF;

          EXECUTE ${schema}.job_table_format(command, 'job_common');

          FOR tbl IN SELECT table_name FROM ${schema}.queue WHERE partition = true
          LOOP
            EXECUTE ${schema}.job_table_format(command, tbl.table_name);
          END LOOP;
        END;
        $$
        LANGUAGE plpgsql;
        `,
                `ALTER TABLE ${schema}.job ADD COLUMN IF NOT EXISTS group_id text`,
                `ALTER TABLE ${schema}.job ADD COLUMN IF NOT EXISTS group_tier text`,
                createQueueFn[27](schema),
                `ALTER INDEX IF EXISTS ${schema}.job_i1 RENAME TO job_common_i1`,
                `ALTER INDEX IF EXISTS ${schema}.job_i2 RENAME TO job_common_i2`,
                `ALTER INDEX IF EXISTS ${schema}.job_i3 RENAME TO job_common_i3`,
                `ALTER INDEX IF EXISTS ${schema}.job_i4 RENAME TO job_common_i4`,
                `ALTER INDEX IF EXISTS ${schema}.job_i5 RENAME TO job_common_i5`,
                `ALTER INDEX IF EXISTS ${schema}.job_i6 RENAME TO job_common_i6`,
                `ALTER INDEX IF EXISTS ${schema}.job_i7 RENAME TO job_common_i7`
            ],
            async: [
                `SELECT ${schema}.job_table_run_async(
          'group_concurency_index',
          $VERSION$,
          $$
          CREATE INDEX CONCURRENTLY job_i7 ON ${schema}.job (name, group_id) WHERE state = 'active' AND group_id IS NOT NULL
          $$
        )`
            ],
            uninstall: [
                `ALTER INDEX ${schema}.job_common_i6 RENAME TO job_i6`,
                `ALTER INDEX ${schema}.job_common_i5 RENAME TO job_i5`,
                `ALTER INDEX ${schema}.job_common_i4 RENAME TO job_i4`,
                `ALTER INDEX ${schema}.job_common_i3 RENAME TO job_i3`,
                `ALTER INDEX ${schema}.job_common_i2 RENAME TO job_i2`,
                `ALTER INDEX ${schema}.job_common_i1 RENAME TO job_i1`,
                `SELECT ${schema}.job_table_run('DROP INDEX IF EXISTS ${schema}.job_i7')`,
                createQueueFn[26](schema),
                `DROP FUNCTION ${schema}.job_table_run(text, text, text)`,
                `DROP FUNCTION ${schema}.job_table_run_async(text, int, text, text, text)`,
                `DROP FUNCTION ${schema}.job_table_format(text, text)`,
                `DROP TABLE ${schema}.bam`,
                `ALTER TABLE ${schema}.version DROP COLUMN bam_on`,
                `ALTER TABLE ${schema}.job DROP COLUMN group_tier`,
                `ALTER TABLE ${schema}.job DROP COLUMN group_id`
            ]
        },
        {
            release: '12.10.0',
            version: 28,
            previous: 27,
            install: [
                // Create key_strict_fifo CHECK constraint on job_common (the default partition)
                `SELECT ${schema}.job_table_run($cmd$ALTER TABLE ${schema}.job ADD CONSTRAINT job_key_strict_fifo_singleton_key_check CHECK (NOT (policy = 'key_strict_fifo' AND singleton_key IS NULL))$cmd$, 'job_common')`,
                createQueueFn[28](schema)
            ],
            async: [
                `SELECT ${schema}.job_table_run_async(
          'key_strict_fifo_index',
          $VERSION$,
          $$
          CREATE UNIQUE INDEX CONCURRENTLY job_i8 ON ${schema}.job (name, singleton_key) WHERE state IN ('active', 'retry', 'failed') AND policy = 'key_strict_fifo'
          $$
        , 'job_common')`
            ],
            uninstall: [
                `SELECT ${schema}.job_table_run('DROP INDEX IF EXISTS ${schema}.job_i8')`,
                `SELECT ${schema}.job_table_run('ALTER TABLE ${schema}.job DROP CONSTRAINT IF EXISTS job_key_strict_fifo_singleton_key_check')`,
                createQueueFn[27](schema)
            ]
        },
        {
            release: '12.11.0',
            version: 29,
            previous: 28,
            install: [
                `CREATE TABLE ${schema}.warning (
          id uuid PRIMARY KEY default gen_random_uuid(),
          type text NOT NULL,
          message text NOT NULL,
          data jsonb,
          created_on timestamp with time zone NOT NULL DEFAULT now()
        )`,
                `CREATE INDEX warning_i1 ON ${schema}.warning (created_on DESC)`
            ],
            uninstall: [
                `DROP INDEX ${schema}.warning_i1`,
                `DROP TABLE ${schema}.warning`
            ]
        },
        {
            release: '12.12.0',
            version: 30,
            previous: 29,
            install: [
                `ALTER TABLE ${schema}.job ADD COLUMN heartbeat_on timestamp with time zone`,
                `ALTER TABLE ${schema}.job ADD COLUMN heartbeat_seconds int`,
                `ALTER TABLE ${schema}.queue ADD COLUMN heartbeat_seconds int`,
                createQueueFn[30](schema)
            ],
            uninstall: [
                createQueueFn[28](schema),
                `ALTER TABLE ${schema}.queue DROP COLUMN heartbeat_seconds`,
                `ALTER TABLE ${schema}.job DROP COLUMN heartbeat_seconds`,
                `ALTER TABLE ${schema}.job DROP COLUMN heartbeat_on`
            ]
        },
        {
            release: '12.19.0',
            version: 31,
            previous: 30,
            install: [
                `ALTER TABLE ${schema}.job ADD COLUMN blocked boolean NOT NULL DEFAULT false`,
                `ALTER TABLE ${schema}.job ADD COLUMN blocking boolean NOT NULL DEFAULT false`,
                `ALTER TABLE ${schema}.job ADD COLUMN pending_dependencies int NOT NULL DEFAULT 0`,
                `
        CREATE TABLE IF NOT EXISTS ${schema}.job_dependency (
          child_name text NOT NULL,
          child_id uuid NOT NULL,
          parent_name text NOT NULL,
          parent_id uuid NOT NULL,
          PRIMARY KEY (child_name, child_id, parent_name, parent_id)
        )
        `,
                `CREATE INDEX IF NOT EXISTS job_dep_parent_idx ON ${schema}.job_dependency (parent_name, parent_id)`,
                // NOTE: the v31 job_i5 rebuild (adding `AND NOT blocked`) is intentionally omitted — v33
                // drops and rebuilds job_i5 again (slimming off the covering INCLUDE), so on a multi-version
                // upgrade (<= v31 -> >= v33, applied as one migration transaction) this only built a covering
                // index that v33 immediately throws away. The whole migration runs in a single transaction,
                // so no worker observes the pre-v33 shape; the old job_i5 simply persists untouched until v33
                // replaces it. Anyone who already migrated to exactly v31/v32 keeps the index they built then,
                // so removing the build here does not affect them. New partitions created while on v31 still
                // get the correct shape from createQueueFn[31] below.
                // `SELECT ${schema}.job_table_run($cmd$DROP INDEX IF EXISTS ${schema}.job_i5$cmd$)`,
                // `SELECT ${schema}.job_table_run($cmd$CREATE INDEX job_i5 ON ${schema}.job (name, start_after) INCLUDE (priority, created_on, id) WHERE state < 'active' AND NOT blocked$cmd$)`,
                createQueueFn[31](schema)
            ],
            uninstall: [
                `DROP INDEX IF EXISTS ${schema}.job_dep_parent_idx`,
                `DROP TABLE IF EXISTS ${schema}.job_dependency`,
                createQueueFn[30](schema),
                `SELECT ${schema}.job_table_run($cmd$DROP INDEX IF EXISTS ${schema}.job_i5$cmd$)`,
                `SELECT ${schema}.job_table_run($cmd$CREATE INDEX job_i5 ON ${schema}.job (name, start_after) INCLUDE (priority, created_on, id) WHERE state < 'active'$cmd$)`,
                `ALTER TABLE ${schema}.job DROP COLUMN pending_dependencies`,
                `ALTER TABLE ${schema}.job DROP COLUMN blocking`,
                `ALTER TABLE ${schema}.job DROP COLUMN blocked`
            ]
        },
        {
            release: '12.21.0',
            version: 32,
            previous: 31,
            install: [
                `ALTER TABLE ${schema}.queue ADD COLUMN notify boolean NOT NULL DEFAULT false`,
                createQueueFn[32](schema),
                `ALTER TABLE ${schema}.queue ADD COLUMN failed_count int NOT NULL DEFAULT 0`,
                `ALTER TABLE ${schema}.queue ADD COLUMN ready_count int NOT NULL DEFAULT 0`
            ],
            uninstall: [
                `ALTER TABLE ${schema}.queue DROP COLUMN ready_count`,
                `ALTER TABLE ${schema}.queue DROP COLUMN failed_count`,
                createQueueFn[31](schema),
                `ALTER TABLE ${schema}.queue DROP COLUMN notify`
            ]
        },
        {
            release: '12.22.0',
            version: 33,
            previous: 32,
            install: [
                `ALTER TABLE ${schema}.version ADD COLUMN IF NOT EXISTS flow_on timestamp with time zone`,
                // The job_i9 build and job_i5 reshape are run OFF the migration transaction, via BAM as
                // CONCURRENTLY DDL — see the `async` block below. The original v33 ran them synchronously here
                // via job_table_run(), taking SHARE/ACCESS EXCLUSIVE locks on job_common + every partition
                // inside the migration transaction, which deadlocked live workers polling job_common during a
                // rolling deploy (issue #832).
                //
                // Only databases that have NOT yet passed v33 execute this install, and they always have the
                // covering job_i5 (the slim form is introduced here) — so the reshape never needlessly
                // rebuilds an already-slim index. Databases already past v33 keep what they built then; they
                // pick up only the bam default change, carried separately by migration v36.
                //
                // Set the bam queue's created_on default to clock_timestamp() BEFORE the enqueues below. BAM
                // applies queued commands in created_on order, and the job_i5 reshape is an ordered
                // drop-then-rebuild; now() is constant within this migration transaction and would tie them.
                // (Migrations run in version order, so this must be in v33 — v36 runs after these enqueues.)
                `ALTER TABLE ${schema}.bam ALTER COLUMN created_on SET DEFAULT clock_timestamp()`,
                createQueueFn[33](schema)
            ],
            async: [
                // Partial index backing the background flow resolver.
                `SELECT ${schema}.job_table_run_async(
          'flow_resolver_index',
          $VERSION$,
          $$
          CREATE INDEX CONCURRENTLY IF NOT EXISTS job_i9 ON ${schema}.job (name, id) WHERE blocking AND state = 'completed'
          $$
        )`,
                // Slim the fetch index job_i5: drop the covering INCLUDE (priority, created_on, id) — the
                // fetch's FOR UPDATE ... SKIP LOCKED forces heap access, so the payload was never read from
                // the index. Drop-then-rebuild (CONCURRENTLY can't reshape in place); BAM runs them in
                // created_on order, drop before rebuild (see the clock_timestamp() default set above).
                `SELECT ${schema}.job_table_run_async(
          'fetch_index_drop',
          $VERSION$,
          $$
          DROP INDEX CONCURRENTLY IF EXISTS ${schema}.job_i5
          $$
        )`,
                `SELECT ${schema}.job_table_run_async(
          'fetch_index',
          $VERSION$,
          $$
          CREATE INDEX CONCURRENTLY IF NOT EXISTS job_i5 ON ${schema}.job (name, start_after) WHERE state < 'active' AND NOT blocked
          $$
        )`
            ],
            uninstall: [
                createQueueFn[32](schema),
                // Restore the covering INCLUDE on the fetch index (the v32 shape).
                `SELECT ${schema}.job_table_run($cmd$DROP INDEX IF EXISTS ${schema}.job_i5$cmd$)`,
                `SELECT ${schema}.job_table_run($cmd$CREATE INDEX job_i5 ON ${schema}.job (name, start_after) INCLUDE (priority, created_on, id) WHERE state < 'active' AND NOT blocked$cmd$)`,
                `SELECT ${schema}.job_table_run($cmd$DROP INDEX IF EXISTS ${schema}.job_i9$cmd$)`,
                `ALTER TABLE ${schema}.version DROP COLUMN flow_on`
            ]
        },
        {
            release: '12.23.0',
            version: 34,
            previous: 33,
            // Dead-letter source provenance. Plain columns on the partitioned parent cascade to
            // job_common (DEFAULT partition) and every existing/future partition, so no job_table_run
            // fan-out or createQueueFn bump is needed (queue-creation/index logic is unchanged).
            install: [
                `ALTER TABLE ${schema}.job ADD COLUMN IF NOT EXISTS source_name text`,
                `ALTER TABLE ${schema}.job ADD COLUMN IF NOT EXISTS source_id uuid`,
                `ALTER TABLE ${schema}.job ADD COLUMN IF NOT EXISTS source_created_on timestamp with time zone`,
                `ALTER TABLE ${schema}.job ADD COLUMN IF NOT EXISTS source_retry_count int`
            ],
            uninstall: [
                `ALTER TABLE ${schema}.job DROP COLUMN source_name`,
                `ALTER TABLE ${schema}.job DROP COLUMN source_id`,
                `ALTER TABLE ${schema}.job DROP COLUMN source_created_on`,
                `ALTER TABLE ${schema}.job DROP COLUMN source_retry_count`
            ]
        },
        {
            release: '12.24.0',
            version: 35,
            previous: 34,
            // Mirror plans.create(): honor noTablePartitioning so upgrades on non-partitioning
            // deployments (e.g. CockroachDB, which rejects declarative RANGE partitioning) get a plain
            // queue_stats table instead of a partitioned one they could never maintain. noCovering is a
            // separate axis (CockroachDB sets it, YugabyteDB doesn't) gating the index's covering INCLUDE.
            // Also adds queue.ready_history: an always-on sliding window of recent ready counts on the
            // queue row for the dashboard sparkline (maintained by cacheQueueStats every monitor cycle,
            // independent of persistQueueStats). NOT NULL DEFAULT '{}' backfills existing rows with an
            // empty window that fills in over the next monitor cycles.
            install: [
                ...noPartitioning ? [
                    createTableQueueStatsFn[35](schema, true),
                    createIndexQueueStatsFn[35](schema, noCovering)
                ] : [
                    createTableQueueStatsFn[35](schema, false),
                    createIndexQueueStatsFn[35](schema, noCovering),
                    ensureQueueStatsPartitionsFn[35](schema)
                ],
                `ALTER TABLE ${schema}.queue ADD COLUMN ready_history int[] NOT NULL DEFAULT '{}'`
            ],
            uninstall: [
                `ALTER TABLE ${schema}.queue DROP COLUMN ready_history`,
                `DROP TABLE IF EXISTS ${schema}.queue_stats`
            ]
        },
        {
            release: '12.24.1',
            version: 36,
            previous: 35,
            // Carry only the bam.created_on default change (now() -> clock_timestamp()) to databases that
            // already ran v33 and so won't re-run its install. This keeps a fully-migrated database's schema
            // identical to a fresh install (plans.create builds the bam table with this default), and lets a
            // future async migration enqueue an ordered drop-then-rebuild without the now() tie. The ALTER
            // is idempotent, so databases that just ran v33's copy of it (a multi-version upgrade) are
            // unaffected. No index work here — that lives in v33, which the deadlock-affected (pre-v33)
            // databases run; databases already past v33 keep the indexes they built and skip the churn.
            install: [
                `ALTER TABLE ${schema}.bam ALTER COLUMN created_on SET DEFAULT clock_timestamp()`
            ],
            // The default change is forward-compatible and harmless to keep, so rollback leaves it in place.
            uninstall: []
        },
        {
            release: '12.26.0',
            version: 37,
            previous: 36,
            // Fix job_table_format(): the naive replace() mangled schema names containing `.job` or
            // `job_i` (e.g. `job_intake`), rewriting index builds to a nonexistent schema. The anchored
            // regexp_replace version matches only the base table reference and bare job_iN index tokens.
            // Only installed where partitioning is enabled — the function is created by plans.create()
            // solely in that case (plans.ts), so a noPartitioning database has none to replace.
            install: noPartitioning ? [] : [
                jobTableFormatFn[37](schema)
            ],
            // Restore the prior (naive) definition on rollback so the schema matches v36 exactly.
            uninstall: noPartitioning ? [] : [
                jobTableFormatFn[36](schema)
            ]
        },
        {
            release: '12.28.0',
            version: 38,
            previous: 37,
            install: noPartitioning ? [
                `CREATE INDEX job_i10 ON ${schema}.job (name, singleton_key, state DESC, created_on, id)${noCovering ? '' : ' INCLUDE (start_after)'} WHERE state < 'active' AND NOT blocked AND policy = 'key_strict_fifo'`
            ] : [
                createQueueFn[38](schema)
            ],
            async: noPartitioning ? [] : [
                {
                    name: 'key_strict_fifo_head_index',
                    partitionPolicy: 'key_strict_fifo',
                    command: `CREATE INDEX CONCURRENTLY IF NOT EXISTS job_i10 ON ${schema}.job (name, singleton_key, state DESC, created_on, id) INCLUDE (start_after) WHERE state < 'active' AND NOT blocked AND policy = 'key_strict_fifo'`
                }
            ],
            uninstall: noPartitioning ? [
                `DROP INDEX IF EXISTS ${schema}.job_i10`
            ] : [
                createQueueFn[33](schema),
                `SELECT ${schema}.job_table_run($cmd$DROP INDEX IF EXISTS ${schema}.job_i10$cmd$)`
            ]
        }
    ];
}
;
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/package.json (json)", ((__turbopack_context__) => {

__turbopack_context__.v(JSON.parse("{\"name\":\"pg-boss\",\"version\":\"12.28.0\",\"description\":\"Queueing jobs in Postgres from Node.js like a boss\",\"type\":\"module\",\"main\":\"./dist/index.js\",\"types\":\"./dist/index.d.ts\",\"bin\":{\"pg-boss\":\"./dist/cli.js\"},\"engines\":{\"node\":\">=22.12.0\"},\"dependencies\":{\"cron-parser\":\"^5.10.0\",\"pg\":\"^8.23.0\",\"serialize-error\":\"^13.0.1\"},\"devDependencies\":{\"@electric-sql/pglite\":\"^0.5.7\",\"@prisma/adapter-pg\":\"^7.9.1\",\"@prisma/client\":\"^7.9.1\",\"@tsconfig/node-ts\":\"^23.6.4\",\"@tsconfig/node22\":\"^22.0.6\",\"@types/luxon\":\"^3.7.5\",\"@types/node\":\"^22.20.1\",\"@types/pg\":\"^8.23.1\",\"@vitest/coverage-v8\":\"^4.1.2\",\"cli-testlab\":\"^6.0.1\",\"cross-env\":\"^10.1.0\",\"drizzle-orm\":\"^1.0.0-rc.5-ab785fc\",\"eslint\":\"^9.39.5\",\"knex\":\"^3.3.0\",\"kysely\":\"^0.29.5\",\"luxon\":\"^3.7.2\",\"neostandard\":\"^0.13.0\",\"postgres\":\"^3.4.9\",\"prisma\":\"^7.9.1\",\"tsx\":\"^4.23.12\",\"typescript\":\"^6.0.3\",\"vitest\":\"^4.0.18\"},\"scripts\":{\"build\":\"npm run clean && tsc --project tsconfig.build.json\",\"clean\":\"node -e \\\"fs.rmSync('dist',{recursive:true,force:true})\\\"\",\"prepublishOnly\":\"npm install && npm test && npm run build\",\"pretest\":\"prisma generate --schema=test/prisma/schema.prisma && npm run tsc && npm run gen:manifest:check\",\"test\":\"eslint . && vitest run\",\"test:distributed\":\"cross-env DISTRIBUTED=true npm test\",\"test:ci\":\"npm run cover && cross-env DISTRIBUTED=true npm run cover && npm run test:pglite\",\"test:cockroachdb\":\"cross-env DB_TYPE=cockroachdb COCKROACH_HOST=localhost npm test -- test/distributedDatabaseTest.ts\",\"test:cockroachdb:full\":\"cross-env DB_TYPE=cockroachdb COCKROACH_HOST=localhost npm test -- --no-file-parallelism\",\"test:yugabytedb:full\":\"cross-env DB_TYPE=yugabytedb YUGABYTE_HOST=localhost npm test -- --no-file-parallelism\",\"test:citus:full\":\"cross-env DB_TYPE=citus CITUS_HOST=localhost npm test\",\"test:pglite\":\"cross-env DB_TYPE=pglite npm test\",\"lint:fix\":\"eslint . --fix\",\"cover\":\"npm test -- --coverage\",\"tsc\":\"tsc --noEmit\",\"cli\":\"node ./dist/cli.js\",\"gen:manifest\":\"tsx scripts/gen-manifest.ts\",\"gen:manifest:check\":\"tsx scripts/gen-manifest.ts --check\",\"console\":\"tsx scripts/console.js\",\"seed\":\"tsx scripts/seed-queue-stats.js\",\"readme\":\"node ./examples/readme.js\",\"docs\":\"npm run docs:dev --prefix docs\",\"docs:readme\":\"node ./scripts/sync-readme.js\",\"docs:sponsors\":\"node --env-file-if-exists=.env ./scripts/sync-sponsors.js\"},\"pgboss\":{\"schema\":38},\"repository\":{\"type\":\"git\",\"url\":\"git+https://github.com/timgit/pg-boss.git\"},\"author\":\"timgit\",\"license\":\"MIT\",\"bugs\":{\"url\":\"https://github.com/timgit/pg-boss/issues\"},\"homepage\":\"https://pgboss.io\",\"keywords\":[\"postgresql\",\"postgres\",\"queue\",\"job\"],\"files\":[\"dist\",\"README.md\",\"LICENSE\",\"package.json\"]}"));}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/contractor.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:assert [external] (node:assert, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/plans.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/drifter.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$migrationStore$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/migrationStore.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$package$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/package.json (json)");
;
;
;
;
;
const schemaVersion = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$package$2e$json__$28$json$29$__["default"].pgboss.schema;
// A name postgres would store unchanged if written without quotes.
const BARE_LOWER_IDENTIFIER_REGEX = /^[a-z_][a-z0-9_]*$/;
class Contractor {
    static constructionPlans(schema = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["DEFAULT_SCHEMA"], options = {
        createSchema: true
    }) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["create"](schema, schemaVersion, options);
    }
    static migrationPlans(schema = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["DEFAULT_SCHEMA"], version = schemaVersion - 1, options = {}) {
        // Exported plans run without a BAM worker, so inline the async index builds as direct
        // DDL rather than job_table_run_async() enqueues (see issue #766). Callers that hold a
        // live connection can pass partition metadata to fan the builds out across partitions.
        return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$migrationStore$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["migrate"](schema, version, undefined, undefined, {
            inlineAsync: true,
            partitionTables: options.partitionTables
        });
    }
    static rollbackPlans(schema = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["DEFAULT_SCHEMA"], version = schemaVersion) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$migrationStore$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["rollback"](schema, version);
    }
    config;
    db;
    migrations;
    constructor(db, config){
        this.config = config;
        this.db = db;
        this.migrations = this.config.migrations || __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$migrationStore$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getAll"](this.config.schema, this.config.noTablePartitioning, this.config.noCoveringIndexes);
    }
    async schemaVersion() {
        const result = await this.db.executeSql(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getVersion"](this.config.schema));
        return result.rows.length ? parseInt(result.rows[0].version) : null;
    }
    async isInstalled() {
        const result = await this.db.executeSql(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["versionTableExists"](this.config.schema));
        return !!result.rows[0].name;
    }
    async start() {
        const installed = await this.isInstalled();
        if (installed) {
            const version = await this.schemaVersion();
            if (version !== null && schemaVersion > version) {
                await this.migrate(version);
            }
        } else {
            await this.assertNoSchemaCaseVariant();
            await this.create();
        }
    }
    // `schema: 'MySchema'` and `schema: '"MySchema"'` are two different schemas - postgres folds the
    // bare form to `myschema` and stores the quoted one verbatim - but the two configs differ by two
    // characters and are indistinguishable in logs. Getting it wrong is not an error on its own: the
    // version table simply isn't there, so pg-boss installs a second, empty schema alongside the
    // populated one and every existing job silently disappears. Fires only on the install path, and
    // only when the variant actually holds a pg-boss install, so an unrelated schema that happens to
    // share a folded name never blocks a legitimate install.
    async assertNoSchemaCaseVariant() {
        if (this.config.allowSchemaCaseVariant) {
            return;
        }
        const schema = this.config.schema;
        let variants;
        try {
            const result = await this.db.executeSql(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getSchemaCaseVariants"](schema));
            variants = result.rows.map((r)=>r.name);
        } catch  {
            // Catalog access varies across backends and permission setups. A probe that cannot run is
            // not evidence of a problem, so it must never block an install that would otherwise succeed.
            return;
        }
        if (variants.length === 0) {
            return;
        }
        // A variant that is already a legal lower-case bare identifier is reached by writing it bare;
        // anything else (mixed case, or a name needing quotes) has to be configured quoted.
        const spellings = variants.map((name)=>BARE_LOWER_IDENTIFIER_REGEX.test(name) ? `'${name}'` : `'"${name}"'`);
        throw new Error(`pg-boss is not installed in schema ${schema}, but is installed in ${variants.map((n)=>`"${n}"`).join(', ')}, which differs only in case. ` + 'PostgreSQL folds unquoted names to lower case and stores quoted names verbatim, so these are different schemas. ' + `To use the existing installation, set schema: ${spellings.join(' or ')}. ` + 'To install a new schema beside it anyway, set allowSchemaCaseVariant: true.');
    }
    // Presence-level schema drift scan: compares the managed indexes the code expects against the live
    // catalog. Partitioned vs. non-partitioned is read from the database (job_common presence), and the
    // per-queue policy indexes are computed from the queue table, so conditional indexes are handled.
    async detectDrift() {
        const schema = this.config.schema;
        const probe = await this.db.executeSql(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobCommonExists"](schema));
        const partitioned = !!probe.rows[0].name;
        const partitions = partitioned ? (await this.db.executeSql(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getManagedQueuePartitions"](schema))).rows : [];
        const liveResult = await this.db.executeSql(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getSchemaIndexes"](schema));
        const live = liveResult.rows.map((r)=>({
                name: r.name,
                table: r.table,
                valid: r.valid,
                def: r.def,
                constraintBacked: r.constraintBacked
            }));
        // The bam table only exists from schema v27; ignore its absence on very old schemas.
        let bamCommands = [];
        try {
            const bamResult = await this.db.executeSql(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getIncompleteBamCommands"](schema));
            bamCommands = bamResult.rows.map((r)=>r.command);
        } catch  {
            bamCommands = [];
        }
        // Function-body and enum drift are best-effort: pg_get_functiondef is unsupported on some backends
        // (CockroachDB), so a failure here SKIPS the function check rather than aborting the whole scan.
        // `functionsSupported` must be tracked separately from an empty result: an empty `liveFunctions`
        // means "query failed / unsupported", which is NOT the same as "no functions found" — feeding
        // `live: []` to the drift check would report every expected function as missing and flip `ok` to
        // false on every CockroachDB scan. So the check is gated (passed `undefined`) when the query throws.
        let liveFunctions = [];
        let functionsSupported = true;
        try {
            const fnResult = await this.db.executeSql(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getSchemaFunctions"](schema));
            liveFunctions = fnResult.rows.map((r)=>({
                    name: r.name,
                    def: r.def
                }));
        } catch  {
            functionsSupported = false;
        }
        let enumLabels = [];
        try {
            const enumResult = await this.db.executeSql(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getEnumDefinition"](schema));
            enumLabels = enumResult.rows.map((r)=>r.label);
        } catch  {
            enumLabels = [];
        }
        // Table presence is read from a catalog-only query independent of the column diff below. The column
        // query uses pg_get_expr (unsupported on some backends) and is best-effort; if it throws, the column
        // check is skipped — but table presence must NOT collapse to "everything missing", so it comes from
        // its own pg_class probe. pg_class is available everywhere, so this rarely throws; if it somehow
        // does, fall back to the columns-derived set rather than aborting the scan.
        let liveTables = null;
        try {
            const tableResult = await this.db.executeSql(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getSchemaTables"](schema));
            liveTables = tableResult.rows.map((r)=>r.table);
        } catch  {
            liveTables = null;
        }
        let liveColumns = [];
        try {
            const colResult = await this.db.executeSql(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getSchemaColumns"](schema));
            liveColumns = colResult.rows.map((r)=>({
                    table: r.table,
                    column: r.column,
                    default: r.default,
                    type: r.type,
                    notNull: r.notNull
                }));
        } catch  {
            liveColumns = [];
        }
        let liveConstraints = [];
        try {
            const conResult = await this.db.executeSql(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getSchemaConstraints"](schema));
            liveConstraints = conResult.rows.map((r)=>({
                    table: r.table,
                    def: r.def
                }));
        } catch  {
            liveConstraints = [];
        }
        const building = new Set(bamCommands.map(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["bamCommandIndexName"]).filter((n)=>n !== null));
        // CockroachDB renders column types (INT8 vs integer), default expressions, and constraint
        // definitions differently from standard Postgres, so the canonical-form checks would false-positive
        // there. Restrict type/default/constraint drift to Postgres-typed backends; the presence checks
        // (tables, indexes, column names, functions, enum) still run everywhere.
        const canonicalPg = this.config.backend !== 'cockroachdb';
        const expectedColumns = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["expectedManagedColumns"](schema, partitioned, partitions).map((c)=>canonicalPg ? c : {
                table: c.table,
                columns: c.columns
            });
        // The manifest is generated against standard Postgres, so every index that carries an INCLUDE
        // payload records one. Backends without covering indexes build the narrow form of those indexes
        // on purpose (see the noCovering branches in plans.ts / migrationStore.ts), so expect no payload
        // there instead of reporting each one as drifted.
        const expectedIndexes = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["expectedManagedIndexes"](schema, partitioned, partitions).map((i)=>this.config.noCoveringIndexes ? {
                ...i,
                include: ''
            } : i);
        return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$drifter$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["computeSchemaDrift"]({
            indexes: {
                expected: expectedIndexes,
                live,
                building
            },
            tables: {
                expected: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["expectedManagedTables"](schema, partitioned, partitions),
                live: liveTables ?? [
                    ...new Set(liveColumns.map((c)=>c.table))
                ]
            },
            functions: functionsSupported ? {
                expected: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["expectedManagedFunctions"](schema, partitioned),
                live: liveFunctions
            } : undefined,
            columns: {
                expected: expectedColumns,
                live: liveColumns
            },
            constraints: canonicalPg ? {
                expected: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["expectedManagedConstraints"](schema, partitioned),
                live: liveConstraints
            } : undefined,
            enum: {
                name: 'job_state',
                expected: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["EXPECTED_JOB_STATES"],
                actual: enumLabels
            }
        });
    }
    async check() {
        const installed = await this.isInstalled();
        if (!installed) {
            throw new Error('pg-boss is not installed');
        }
        const version = await this.schemaVersion();
        if (schemaVersion !== version) {
            throw new Error('pg-boss database requires migrations');
        }
    }
    async create() {
        try {
            const commands = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["create"](this.config.schema, schemaVersion, this.config);
            await this.db.executeSql(commands);
        } catch (err) {
            (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(err.message.includes(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["CREATE_RACE_MESSAGE"]), err);
        }
    }
    async migrate(version) {
        try {
            const commands = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$migrationStore$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["migrate"](this.config.schema, version, this.migrations, this.config.noAdvisoryLocks);
            await this.db.executeSql(commands);
        } catch (err) {
            (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(err.message.includes(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["MIGRATE_RACE_MESSAGE"]), err);
        }
    }
    async next(version) {
        const commands = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$migrationStore$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["next"](this.config.schema, version, this.migrations, this.config.noAdvisoryLocks);
        await this.db.executeSql(commands);
    }
    async rollback(version) {
        const commands = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$migrationStore$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["rollback"](this.config.schema, version, this.migrations, this.config.noAdvisoryLocks);
        await this.db.executeSql(commands);
    }
}
const __TURBOPACK__default__export__ = Contractor;
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/warning.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "emitAndPersistWarning",
    ()=>emitAndPersistWarning
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/plans.js [instrumentation] (ecmascript)");
;
async function emitAndPersistWarning(ctx, type, message, data) {
    ctx.emitter.emit(ctx.warningEvent, {
        message,
        data
    });
    if (ctx.persistWarnings) {
        try {
            const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["insertWarning"](ctx.schema);
            await ctx.db.executeSql(sql, [
                type,
                message,
                JSON.stringify(data)
            ]);
        } catch (err) {
            ctx.emitter.emit(ctx.errorEvent, err);
        }
    }
}
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/timekeeper.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "QUEUES",
    ()=>QUEUES,
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$cron$2d$parser$2f$dist$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/cron-parser/dist/index.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:events [external] (node:events, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/attorney.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/plans.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/tools.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$types$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/types.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$warning$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/warning.js [instrumentation] (ecmascript)");
;
;
;
;
;
;
;
const QUEUES = {
    SEND_IT: '__pgboss__send-it'
};
const EVENTS = {
    error: 'error',
    schedule: 'schedule',
    warning: 'warning'
};
const WARNINGS = {
    CLOCK_SKEW: {
        message: 'Warning: Clock skew between this instance and the database server. This will not break scheduling, but is emitted any time the skew exceeds 60 seconds.'
    }
};
const WARNING_TYPES = {
    CLOCK_SKEW: 'clock_skew',
    INVALID_SCHEDULE: 'invalid_schedule'
};
/**
 * Asserts that `tz` is a time zone cron evaluation can actually use.
 *
 * cron-parser validates `tz` lazily: parsing without a reference date never constructs a CronDate,
 * so every string is accepted and a bad zone only surfaces later, when a date is computed, as an
 * opaque "CronDate: unhandled timestamp". Passing a reference date here forces that construction so
 * a typo like 'America/New_Yrok' is rejected by schedule() rather than persisted to the schedule
 * table. Deliberately reuses cron-parser rather than an independent Intl check, so what schedule()
 * accepts is exactly what the cron pass can evaluate.
 *
 * The caller validates the cron expression first, so a failure here is attributable to the zone.
 */ function assertTimezone(tz) {
    try {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$cron$2d$parser$2f$dist$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["CronExpressionParser"].parse('* * * * *', {
            tz,
            strict: false,
            currentDate: new Date()
        });
    } catch  {
        // Quoted so an empty string renders as `""` rather than a dangling colon
        throw new Error(`Unknown or unsupported time zone: "${tz}"`);
    }
}
class Timekeeper extends __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__["default"] {
    db;
    config;
    manager;
    stopped = true;
    cronMonitorInterval;
    skewMonitorInterval;
    timekeeping;
    _checkingSkew = false;
    // Rows already warned about, keyed on (name, key, cron, timezone). Unlike every other warning
    // type, an unusable schedule never heals on its own: clock skew converges, a backlog drains, a
    // slow query is a one-off, but a bad row sits there until a human edits it. Warning every pass
    // would persist a row every cronMonitorIntervalSeconds forever, and warningRetentionDays has no
    // default, so a single typo could grow the warning table without bound. Rebuilt each pass from
    // the rows still broken, so a fixed or deleted schedule drops out and would warn again if it
    // came back.
    warnedSchedules = new Set();
    clockSkew = 0;
    events = EVENTS;
    constructor(db, manager, config){
        super();
        this.db = db;
        this.config = config;
        this.manager = manager;
    }
    get checkingSkew() {
        return this._checkingSkew;
    }
    get warningContext() {
        return {
            emitter: this,
            db: this.db,
            schema: this.config.schema,
            persistWarnings: this.config.persistWarnings,
            warningEvent: this.events.warning,
            errorEvent: this.events.error
        };
    }
    async start() {
        this.stopped = false;
        // A restart should re-surface a row nobody has fixed yet
        this.warnedSchedules.clear();
        await this.cacheClockSkew();
        await this.manager.createQueue(QUEUES.SEND_IT);
        const options = {
            pollingIntervalSeconds: this.config.cronWorkerIntervalSeconds,
            batchSize: 50
        };
        await this.manager.work(QUEUES.SEND_IT, options, (jobs)=>this.onSendIt(jobs));
        setImmediate(()=>this.onCron());
        this.cronMonitorInterval = setInterval(async ()=>await this.onCron(), this.config.cronMonitorIntervalSeconds * 1000);
        this.skewMonitorInterval = setInterval(async ()=>await this.cacheClockSkew(), this.config.clockMonitorIntervalSeconds * 1000);
    }
    async stop() {
        if (this.stopped) {
            return;
        }
        this.stopped = true;
        await this.manager.offWork(QUEUES.SEND_IT, {
            wait: true
        });
        if (this.skewMonitorInterval) {
            clearInterval(this.skewMonitorInterval);
            this.skewMonitorInterval = null;
        }
        if (this.cronMonitorInterval) {
            clearInterval(this.cronMonitorInterval);
            this.cronMonitorInterval = null;
        }
        while(this.timekeeping || this._checkingSkew){
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["delay"])(10);
        }
    }
    async cacheClockSkew() {
        let skew = 0;
        this._checkingSkew = true;
        try {
            if (this.config.__test__force_clock_monitoring_error) {
                throw new Error(this.config.__test__force_clock_monitoring_error);
            }
            if (this.config.__test__delay_clock_skew_ms) {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["delay"])(this.config.__test__delay_clock_skew_ms);
            }
            const { rows } = await this.db.executeSql(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getTime"]());
            const local = Date.now();
            const dbTime = parseFloat(rows[0].time);
            skew = dbTime - local;
            const skewSeconds = Math.abs(skew) / 1000;
            if (skewSeconds >= 60 || this.config.__test__force_clock_skew_warning) {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$warning$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["emitAndPersistWarning"])(this.warningContext, WARNING_TYPES.CLOCK_SKEW, WARNINGS.CLOCK_SKEW.message, {
                    seconds: skewSeconds,
                    direction: skew > 0 ? 'slower' : 'faster'
                });
            }
            this.clockSkew = skew;
        } catch (err) {
            this.emit(this.events.error, err);
        } finally{
            this._checkingSkew = false;
        }
    }
    async onCron() {
        try {
            if (this.stopped || this.timekeeping) return;
            if (this.config.__test__force_cron_monitoring_error) {
                throw new Error(this.config.__test__force_cron_monitoring_error);
            }
            this.timekeeping = true;
            const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["trySetCronTime"](this.config.schema, this.config.cronMonitorIntervalSeconds);
            if (!this.stopped) {
                const { rows } = await this.db.executeSql(sql);
                if (!this.stopped && rows.length === 1) {
                    await this.cron();
                }
            }
        } catch (err) {
            this.emit(this.events.error, err);
        } finally{
            this.timekeeping = false;
        }
    }
    async cron() {
        const schedules = await this.getSchedules();
        const scheduled = [];
        const stillBroken = new Set();
        for (const { name, key, data, options, cron, timezone } of schedules){
            let due;
            try {
                due = this.shouldSendIt(cron, timezone);
            } catch (err) {
                // Evaluating one row must not decide the fate of the others. schedule() now rejects an
                // unusable time zone, but a row written by an earlier release — or straight into the table —
                // still throws here. This was a single filter() over every schedule, so one such row
                // propagated out of cron() and silently stopped scheduling for every queue in the
                // deployment, on every pass, until someone found the row. Skip it and warn instead, naming
                // the schedule so it is actually fixable.
                const warned = JSON.stringify([
                    name,
                    key,
                    cron,
                    timezone
                ]);
                stillBroken.add(warned);
                if (!this.warnedSchedules.has(warned)) {
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$warning$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["emitAndPersistWarning"])(this.warningContext, WARNING_TYPES.INVALID_SCHEDULE, `Warning: schedule for queue "${name}" (key "${key}") could not be evaluated and was skipped: ${err.message}`, {
                        queue: name,
                        key,
                        cron,
                        timezone
                    });
                }
                continue;
            }
            if (due) {
                scheduled.push({
                    data: {
                        name,
                        data,
                        options
                    },
                    singletonKey: `${name}__${key}`,
                    singletonSeconds: 60
                });
            }
        }
        this.warnedSchedules = stillBroken;
        if (scheduled.length > 0 && !this.stopped) {
            await this.manager.insert(QUEUES.SEND_IT, scheduled);
        }
    }
    shouldSendIt(cron, tz) {
        const databaseTime = Date.now() + this.clockSkew;
        const interval = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$cron$2d$parser$2f$dist$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["CronExpressionParser"].parse(cron, {
            tz,
            strict: false,
            currentDate: new Date(databaseTime)
        });
        const prevTime = interval.prev();
        const prevDiff = (databaseTime - prevTime.getTime()) / 1000;
        return prevDiff < 60;
    }
    async onSendIt(jobs) {
        const results = await Promise.allSettled(jobs.map(({ data })=>this.manager.send(data)));
        // Surface any failed forward so a lost cron tick isn't silent
        for (const result of results){
            if (result.status === 'rejected') {
                this.emit(this.events.error, result.reason);
            }
        }
    }
    async getSchedules(name, key) {
        let sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getSchedules"](this.config.schema);
        let params = [];
        if (name && key !== undefined) {
            sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getSchedulesByQueueAndKey"](this.config.schema);
            params = [
                name,
                key
            ];
        } else if (name) {
            sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getSchedulesByQueue"](this.config.schema);
            params = [
                name
            ];
        }
        const { rows } = await this.db.executeSql(sql, params);
        return rows;
    }
    async schedule(name, cron, data, options = {}) {
        const { tz = 'UTC', key = '', ...rest } = options;
        // Expression first, so a bad expression reports as one rather than as a time zone problem. The
        // check is deliberately run against UTC rather than the supplied tz: it only works today
        // because cron-parser is lazy about an unusable zone, and if that ever changes this call would
        // throw the opaque "CronDate: unhandled timestamp" that assertTimezone exists to replace.
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$cron$2d$parser$2f$dist$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["CronExpressionParser"].parse(cron, {
            tz: 'UTC',
            strict: false
        });
        assertTimezone(tz);
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["checkSendArgs"]([
            name,
            data,
            {
                ...rest
            }
        ]);
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertKey"](key);
        try {
            const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["schedule"](this.config.schema);
            await this.db.executeSql(sql, [
                name,
                key,
                cron,
                tz,
                data,
                options
            ]);
        } catch (err) {
            if (err.message.includes('foreign key')) {
                err.message = `Queue ${name} not found`;
            }
            throw err;
        }
    }
    async unschedule(name, key = '') {
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["unschedule"](this.config.schema);
        await this.db.executeSql(sql, [
            name,
            key
        ]);
    }
}
const __TURBOPACK__default__export__ = Timekeeper;
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/worker.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/tools.js [instrumentation] (ecmascript)");
;
const WORKER_STATES = {
    created: 'created',
    active: 'active',
    stopping: 'stopping',
    stopped: 'stopped'
};
class Worker {
    id;
    workId;
    name;
    options;
    fetch;
    onFetch;
    onError;
    resolveInterval;
    jobs = [];
    createdOn = Date.now();
    state = WORKER_STATES.created;
    lastFetchedOn = null;
    lastJobStartedOn = null;
    lastJobEndedOn = null;
    lastJobDuration = null;
    lastError = null;
    lastErrorOn = null;
    stopping = false;
    stopped = false;
    abortController = null;
    loopDelayPromise = null;
    beenNotified = false;
    runPromise = null;
    constructor({ id, workId, name, options, resolveInterval, fetch, onFetch, onError }){
        this.id = id;
        this.workId = workId;
        this.name = name;
        this.options = options;
        this.fetch = fetch;
        this.onFetch = onFetch;
        this.onError = onError;
        this.resolveInterval = resolveInterval;
    }
    start() {
        this.runPromise = this.run();
    }
    async run() {
        this.state = WORKER_STATES.active;
        while(!this.stopping){
            const started = Date.now();
            // Number of jobs the last fetch returned; stays 0 on error so a failed fetch backs
            // off to normal polling instead of hot-looping in burst mode.
            let fetchedCount = 0;
            try {
                this.beenNotified = false;
                const jobs = await this.fetch();
                this.lastFetchedOn = Date.now();
                if (jobs) {
                    fetchedCount = jobs.length;
                    this.jobs = jobs;
                    this.lastJobStartedOn = this.lastFetchedOn;
                    await this.onFetch(jobs);
                    this.lastJobEndedOn = Date.now();
                    this.jobs = [];
                }
            } catch (err) {
                this.lastErrorOn = Date.now();
                this.lastError = err;
                err.message = `${err.message} (Queue: ${this.name}, Worker: ${this.id})`;
                this.onError(err);
            }
            const duration = Date.now() - started;
            this.lastJobDuration = duration;
            // Resolve the effective delay each iteration: burst (continuous), NOTIFY backstop, or
            // the base poll (see Manager.work). fetchedCount lets the resolver keep going only while
            // fetches come back full — a short fetch resumes normal polling. A returned interval
            // <= duration + 100 (0 in burst mode) skips the delay and re-fetches immediately.
            const interval = this.resolveInterval(fetchedCount);
            if (!this.stopping && !this.beenNotified && interval - duration > 100) {
                this.loopDelayPromise = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["delay"])(interval - duration);
                await this.loopDelayPromise;
                this.loopDelayPromise = null;
            }
        }
        this.stopping = false;
        this.stopped = true;
        this.state = WORKER_STATES.stopped;
    }
    notify() {
        this.beenNotified = true;
        if (this.loopDelayPromise) {
            this.loopDelayPromise.abort();
        }
    }
    async stop() {
        this.stopping = true;
        this.state = WORKER_STATES.stopping;
        if (this.loopDelayPromise) {
            this.loopDelayPromise.abort();
        }
        await this.runPromise;
    }
    abort() {
        if (this.abortController && !this.abortController.signal.aborted) {
            this.abortController.abort();
        }
    }
    toWipData() {
        return {
            id: this.id,
            workId: this.workId,
            name: this.name,
            options: this.options,
            state: this.state,
            count: this.jobs.length,
            createdOn: this.createdOn,
            lastFetchedOn: this.lastFetchedOn,
            lastJobStartedOn: this.lastJobStartedOn,
            lastJobEndedOn: this.lastJobEndedOn,
            lastError: this.lastError,
            lastErrorOn: this.lastErrorOn,
            lastJobDuration: this.lastJobDuration
        };
    }
}
const __TURBOPACK__default__export__ = Worker;
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/spy.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "JobSpy",
    ()=>JobSpy
]);
class JobSpy {
    #jobResults = new Map();
    #pendingPromises = [];
    clear() {
        this.#jobResults.clear();
        this.#pendingPromises = [];
    }
    waitForJobWithId(id, awaitedState) {
        return this.waitForJob(()=>true, awaitedState, id);
    }
    waitForJob(dataSelector, awaitedState, specificId) {
        const selector = (job)=>{
            if (specificId && job.id !== specificId) {
                return false;
            }
            return dataSelector(job.data);
        };
        // Check if we already have a matching job
        for (const job of this.#jobResults.values()){
            if (job.state === awaitedState && selector(job)) {
                return Promise.resolve(this.#cloneJob(job));
            }
        }
        // Register promise to be resolved when job arrives
        return this.#registerPromise(selector, awaitedState);
    }
    #registerPromise(selector, awaitedState) {
        let resolve;
        const promise = new Promise((_resolve)=>{
            resolve = _resolve;
        });
        this.#pendingPromises.push({
            selector,
            awaitedState,
            resolve
        });
        return promise;
    }
    #getJobResultKey(id, state) {
        return `${id}:${state}`;
    }
    #cloneJob(job) {
        return {
            id: job.id,
            name: job.name,
            data: structuredClone(job.data),
            state: job.state,
            output: job.output ? structuredClone(job.output) : undefined
        };
    }
    addJob(id, name, data, state, output) {
        const job = {
            id,
            name,
            data: structuredClone(data),
            state,
            output: output ? structuredClone(output) : undefined
        };
        const key = this.#getJobResultKey(id, state);
        this.#jobResults.set(key, job);
        // Resolve any pending promises that match this job
        const matchingPromises = [];
        const remainingPromises = [];
        for (const pending of this.#pendingPromises){
            if (pending.awaitedState === state && pending.selector(job)) {
                matchingPromises.push(pending);
            } else {
                remainingPromises.push(pending);
            }
        }
        this.#pendingPromises = remainingPromises;
        for (const pending of matchingPromises){
            pending.resolve(this.#cloneJob(job));
        }
    }
}
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/manager.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:assert [external] (node:assert, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:events [external] (node:events, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$serialize$2d$error$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/serialize-error/index.js [instrumentation] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/attorney.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/plans.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$timekeeper$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/timekeeper.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/tools.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$types$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/types.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$worker$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/worker.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$spy$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/spy.js [instrumentation] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
const INTERNAL_QUEUES = Object.values(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$timekeeper$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUES"]).reduce((acc, i)=>({
        ...acc,
        [i]: i
    }), {});
// CockroachDB returns integer columns (INT8) as strings; these aliased metadata
// fields must be coerced back to numbers when backend === 'cockroachdb'.
const NUMERIC_METADATA_FIELDS = [
    'priority',
    'retryLimit',
    'retryCount',
    'retryDelay',
    'retryDelayMax',
    'expireInSeconds',
    'heartbeatSeconds',
    'deleteAfterSeconds',
    'pendingDependencies'
];
// Queue rows (plans.getQueues) return these integer columns as strings on CockroachDB too.
const NUMERIC_QUEUE_FIELDS = [
    'retryLimit',
    'retryDelay',
    'retryDelayMax',
    'expireInSeconds',
    'retentionSeconds',
    'deleteAfterSeconds',
    'heartbeatSeconds',
    'deferredCount',
    'warningQueueSize',
    'queuedCount',
    'activeCount',
    'totalCount'
];
// The count columns shared by live stats and recorded snapshots (the QueueStats shape).
const STATS_COUNT_FIELDS = [
    'deferredCount',
    'queuedCount',
    'readyCount',
    'activeCount',
    'failedCount',
    'totalCount'
];
// Stale-cache budget for getQueueStats when persistQueueStats is off. A queue-table cache older than
// this means monitoring isn't keeping it current (e.g. supervise was enabled once but isn't now), so
// the counts are recomputed and re-cached instead of returned. Defaults to one hour, raised to the
// configured monitor/supervise interval when that's larger (both capped at MAX_EXPIRATION_HOURS).
const QUEUE_STATS_CACHE_TTL_SECONDS = 60 * 60;
// Tighter budget applied when getQueueStats is called with { force: true }: recompute for a fresh
// reading, but still reuse anything computed within the last minute so back-to-back forced calls
// don't each re-run the job-table aggregate.
const QUEUE_STATS_FORCE_TTL_SECONDS = 60;
const events = {
    error: 'error',
    wip: 'wip'
};
// Standard translation of low-level Postgres errors raised by job-creation SQL
// into actionable pg-boss errors. Centralized so any write path can reuse it.
// Always throws; rethrows untranslated errors unchanged.
function rethrowWriteError(err) {
    // the in-SQL insert guard raises division_by_zero when ON CONFLICT skipped a job
    if (err?.code === __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["PG_ERROR"].divisionByZero) {
        throw new Error('one or more jobs could not be created. This usually means a job id was duplicated, collided with an existing job, or was rejected by a queue policy (short, singleton, stately, or exclusive).', {
            cause: err
        });
    }
    throw err;
}
class Manager extends __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__["default"] {
    events = events;
    db;
    config;
    wipTs;
    workers;
    stopped;
    queueCacheInterval;
    wipInterval;
    timekeeper;
    notifier;
    queues;
    pendingOffWorkCleanups;
    #spies;
    #localGroupActive;
    #localGroupConfig;
    #localGroupMaxLimit;
    constructor(db, config){
        super();
        this.config = config;
        this.db = db;
        this.wipTs = Date.now();
        this.workers = new Map();
        this.queues = {};
        this.pendingOffWorkCleanups = new Set();
        this.#spies = new Map();
        this.#localGroupActive = new Map();
        this.#localGroupConfig = new Map();
        this.#localGroupMaxLimit = new Map();
    }
    getSpy(name) {
        if (!this.config.__test__enableSpies) {
            throw new Error('Spy is not enabled. Set __test__enableSpies: true in constructor options to use spies.');
        }
        let spy = this.#spies.get(name);
        if (!spy) {
            spy = new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$spy$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["JobSpy"]();
            this.#spies.set(name, spy);
        }
        return spy;
    }
    clearSpies() {
        for (const spy of this.#spies.values()){
            spy.clear();
        }
        this.#spies.clear();
    }
    #getLocalGroupLimit(queueName, groupTier) {
        const config = this.#localGroupConfig.get(queueName);
        if (!config) return Infinity;
        if (groupTier && config.tiers && groupTier in config.tiers) {
            return config.tiers[groupTier];
        }
        return config.default;
    }
    #getGroupsAtLocalCapacity(queueName) {
        const config = this.#localGroupConfig.get(queueName);
        if (!config) return [];
        const queueGroups = this.#localGroupActive.get(queueName);
        if (!queueGroups) return [];
        // Only exclude a group from fetching when it has no remaining capacity for
        // any tier. Using config.default alone would exclude groups that still have
        // room for higher tier jobs. Those jobs never reach the per tier check in
        // #trackLocalGroupStart because ignoreGroups filters them out of the fetch
        // query before that point. maxLimit is precomputed once at setup time so
        // Object.values is not called on every fetch cycle.
        const maxLimit = this.#localGroupMaxLimit.get(queueName) ?? config.default;
        const atCapacity = [];
        for (const [groupId, activeCount] of queueGroups.entries()){
            if (activeCount >= maxLimit) {
                atCapacity.push(groupId);
            }
        }
        return atCapacity;
    }
    #incrementLocalGroupCount(queueName, groupId) {
        let queueGroups = this.#localGroupActive.get(queueName);
        if (!queueGroups) {
            queueGroups = new Map();
            this.#localGroupActive.set(queueName, queueGroups);
        }
        const current = queueGroups.get(groupId) || 0;
        queueGroups.set(groupId, current + 1);
    }
    #decrementLocalGroupCount(queueName, groupId) {
        const queueGroups = this.#localGroupActive.get(queueName);
        if (!queueGroups) return;
        const current = queueGroups.get(groupId) || 0;
        if (current <= 1) {
            queueGroups.delete(groupId);
        } else {
            queueGroups.set(groupId, current - 1);
        }
    }
    #trackJobsActive(name, jobs) {
        const spy = this.config.__test__enableSpies ? this.#spies.get(name) : undefined;
        if (spy) {
            for (const job of jobs){
                spy.addJob(job.id, name, job.data, 'active');
            }
        }
    }
    async #trackJobsCompleted(name, jobs, result, affected) {
        const spy = this.config.__test__enableSpies ? this.#spies.get(name) : undefined;
        if (!spy) return;
        // Fast path: complete() transitioned every job (it only touches jobs still in the
        // active state), so the handler's return value is the output for each one.
        if (affected === jobs.length) {
            const output = jobs.length === 1 ? result : undefined;
            for (const job of jobs){
                spy.addJob(job.id, name, job.data, 'completed', output);
            }
            return;
        }
        // Otherwise the handler transitioned one or more jobs itself before returning (e.g. a
        // validation failure routed through boss.fail()), making complete() a no-op for those.
        // Reflect each job's real persisted state rather than assuming completion.
        for (const job of jobs){
            const persisted = await this.getJobById(name, job.id);
            const state = persisted?.state;
            if (state === 'completed' || state === 'failed' || state === 'active' || state === 'created') {
                spy.addJob(job.id, name, job.data, state, persisted?.output);
            } else if (!persisted) {
                // The handler deleted the job itself (e.g. boss.deleteJob in the handler), so there is
                // no persisted row to inspect. The handler still returned normally, so from the spy's
                // perspective the work succeeded — record 'completed', matching the behavior before
                // manual-failure tracking was added.
                spy.addJob(job.id, name, job.data, 'completed', undefined);
            }
        // 'retry' / 'cancelled' have no spy-state equivalent, so they are intentionally skipped
        }
    }
    async #trackJobsFailed(name, jobs, err) {
        const spy = this.config.__test__enableSpies ? this.#spies.get(name) : undefined;
        if (!spy) return;
        // A handler throw routes through fail(), but fail() only lands the job in the terminal
        // 'failed' state once its retries are exhausted (retry_count >= retry_limit). While retries
        // remain the job goes back to 'retry' and will run again, so recording 'failed' here would be
        // wrong — the spy would report a permanent failure for a job that may yet succeed on retry,
        // and (if the retry does succeed) it would hold contradictory 'failed' + 'completed' entries.
        // Read the real persisted state and only record 'failed' when the job actually failed for good.
        // The eventual outcome of a retried job — success, or terminal failure when retries run out —
        // is recorded by whichever attempt produces it. Mirrors the slow path in #trackJobsCompleted.
        for (const job of jobs){
            const persisted = await this.getJobById(name, job.id);
            if (persisted?.state === 'failed') {
                spy.addJob(job.id, name, job.data, 'failed', persisted.output ?? {
                    message: err?.message,
                    stack: err?.stack
                });
            }
        // 'retry' / 'created' (retries remaining) have no terminal spy state, so they are skipped.
        }
    }
    #trackJobsSettled(name, completed, failed) {
        const spy = this.config.__test__enableSpies ? this.#spies.get(name) : undefined;
        if (!spy) return;
        for (const { job, output } of completed){
            spy.addJob(job.id, name, job.data, 'completed', output);
        }
        for (const { job, output } of failed){
            spy.addJob(job.id, name, job.data, 'failed', (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$serialize$2d$error$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__["serializeError"])(output));
        }
    }
    // Per-job settlement for `perJobResults` batch handlers. The handler resolves with a JobResult[]
    // describing each job's outcome; we settle completed and failed jobs individually, each with its
    // own output. All completed jobs are settled in a single statement and all failed jobs in another
    // (each output carried per-id via a JSON recordset), so batch size never drives the statement
    // count. Any batch job the handler omits (or returns with an invalid shape) is failed with a
    // descriptive error so it retries / dead-letters per queue config.
    async #settlePerJob(name, jobs, result) {
        if (!Array.isArray(result)) {
            // The handler opted into perJobResults but did not return an array: a contract violation.
            // Fail the whole batch so the mistake surfaces and the jobs are retried.
            const err = new Error('perJobResults handler must resolve with an array of job results');
            await this.fail(name, jobs.map((job)=>job.id), err);
            await this.#trackJobsFailed(name, jobs, err);
            return;
        }
        // Index the handler's dispositions by job id, keeping only valid entries that reference a job
        // from this batch. Last write wins on duplicate ids.
        const batch = new Map(jobs.map((job)=>[
                job.id,
                job
            ]));
        const disposition = new Map();
        for (const item of result){
            if (item && batch.has(item.id) && (item.status === 'completed' || item.status === 'failed' || item.status === 'deadletter')) {
                disposition.set(item.id, item);
            }
        }
        // Partition the batch (the authoritative set of jobs) by disposition. `deadletter` jobs fail
        // terminally and route straight to the dead letter queue, bypassing remaining retries.
        const completed = [];
        const failed = [];
        const deadLettered = [];
        for (const job of jobs){
            const item = disposition.get(job.id);
            if (item?.status === 'completed') {
                completed.push({
                    job,
                    output: item.output
                });
            } else if (item?.status === 'failed') {
                failed.push({
                    job,
                    output: item.output
                });
            } else if (item?.status === 'deadletter') {
                deadLettered.push({
                    job,
                    output: item.output
                });
            } else {
                failed.push({
                    job,
                    output: new Error('no disposition returned by handler')
                });
            }
        }
        if (completed.length > 0) {
            await this.#completeWithOutputs(name, completed.map((c)=>({
                    id: c.job.id,
                    output: c.output
                })));
        }
        if (failed.length > 0) {
            await this.#failWithOutputs(name, failed.map((f)=>({
                    id: f.job.id,
                    output: f.output
                })));
        }
        if (deadLettered.length > 0) {
            await this.#failWithOutputs(name, deadLettered.map((d)=>({
                    id: d.job.id,
                    output: d.output
                })), true);
        }
        // Dead lettered jobs end in the same terminal `failed` state as failed jobs on the source queue.
        this.#trackJobsSettled(name, completed, [
            ...failed,
            ...deadLettered
        ]);
    }
    // Complete a set of active jobs, each with its own output, in a constant number of statements
    // (one on Postgres, two on a distributed backend). Outputs are serialized like complete()/fail()
    // and passed as a JSON recordset so the batch size doesn't drive the statement count.
    async #completeWithOutputs(name, items) {
        const { table } = await this.getQueueCache(name);
        const payload = items.map((item)=>({
                id: item.id,
                output: this.mapCompletionDataArg(item.output)
            }));
        const ids = items.map((item)=>item.id);
        if (this.config.noMultiMutationCte) {
            // Dependency unblocking is handled out of band by the background resolver (Navigator), so
            // completion is a single statement here too.
            const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["completeJobsWithOutputsDistributed"](this.config.schema, table);
            const { rows } = await this.db.executeSql(sql, [
                name,
                JSON.stringify(payload)
            ]);
            return {
                jobs: ids,
                requested: ids.length,
                affected: rows.length
            };
        }
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["completeJobsWithOutputs"](this.config.schema, table);
        const result = await this.db.executeSql(sql, [
            name,
            JSON.stringify(payload)
        ]);
        return this.mapCommandResponse(ids, result);
    }
    // Fail a set of active jobs, each with its own output, in a constant number of statements. On a
    // distributed backend this reuses the select -> delete -> reinsert split, passing per-id outputs
    // to reinsertFailedJobs so each job keeps its own failure detail. When `forceTerminal` is set the
    // jobs fail terminally and route straight to the dead letter queue, bypassing remaining retries.
    async #failWithOutputs(name, items, forceTerminal = false) {
        const { table } = await this.getQueueCache(name);
        const ids = items.map((item)=>item.id);
        if (this.config.noMultiMutationCte) {
            const outputById = new Map(items.map((item)=>[
                    item.id,
                    this.mapCompletionDataArg(item.output)
                ]));
            return this.ensureTransaction(this.db, async (tx)=>{
                const selectQuery = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["selectJobsToFailById"](this.config.schema, table);
                const { rows: jobs } = await tx.executeSql(selectQuery.text, [
                    name,
                    ids
                ]);
                if (jobs.length === 0) {
                    return {
                        jobs: ids,
                        requested: ids.length,
                        affected: 0
                    };
                }
                const deleteQuery = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["deleteJobsToFail"](this.config.schema, table);
                await tx.executeSql(deleteQuery.text, [
                    name,
                    ids
                ]);
                const count = await this.reinsertFailedJobs(tx, table, jobs, null, outputById, forceTerminal);
                return {
                    jobs: ids,
                    requested: ids.length,
                    affected: count
                };
            });
        }
        const payload = items.map((item)=>({
                id: item.id,
                output: this.mapCompletionDataArg(item.output)
            }));
        const sql = forceTerminal ? __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["deadLetterJobsByIdWithOutputs"](this.config.schema, table) : __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["failJobsByIdWithOutputs"](this.config.schema, table);
        const result = await this.db.executeSql(sql, [
            name,
            JSON.stringify(payload)
        ]);
        return this.mapCommandResponse(ids, result);
    }
    #storeLocalGroupConfig(name, localGroupConcurrency) {
        const config = typeof localGroupConcurrency === 'number' ? {
            default: localGroupConcurrency
        } : localGroupConcurrency;
        this.#localGroupConfig.set(name, config);
        this.#localGroupMaxLimit.set(name, config.tiers ? Math.max(config.default, ...Object.values(config.tiers)) : config.default);
    }
    #cleanupLocalGroupTracking(name) {
        // Only cleanup if no more workers exist for this queue
        const hasWorkersForQueue = this.getWorkers().some((w)=>w.name === name && !w.stopping && !w.stopped);
        if (!hasWorkersForQueue) {
            this.#localGroupConfig.delete(name);
            this.#localGroupActive.delete(name);
            this.#localGroupMaxLimit.delete(name);
        }
    }
    #trackLocalGroupStart(name, jobs) {
        const allowed = [];
        const excess = [];
        const groupedJobs = [];
        for (const job of jobs){
            if (!job.groupId) {
                // Jobs without group bypass local group limits
                allowed.push(job);
                continue;
            }
            const currentCount = this.#localGroupActive.get(name)?.get(job.groupId) || 0;
            const limit = this.#getLocalGroupLimit(name, job.groupTier);
            if (currentCount < limit) {
                this.#incrementLocalGroupCount(name, job.groupId);
                allowed.push(job);
                groupedJobs.push(job);
            } else {
                excess.push(job);
            }
        }
        return {
            allowed,
            excess,
            groupedJobs
        };
    }
    #trackLocalGroupEnd(name, groupedJobs) {
        for (const job of groupedJobs){
            if (job.groupId) {
                this.#decrementLocalGroupCount(name, job.groupId);
            }
        }
    }
    async #processJobs(name, jobs, callback, worker, heartbeatRefreshSeconds, perJobResults = false) {
        const jobIds = jobs.map((job)=>job.id);
        const maxExpiration = jobs.reduce((acc, i)=>Math.max(acc, i.expireInSeconds), 0);
        // Minimum, not maximum: heartbeatSeconds is per-job, and failJobsByHeartbeat fails a job once
        // its OWN heartbeat_on is stale by ITS OWN heartbeat_seconds. A refresh cadence derived from
        // the batch max would let a small-heartbeat job in a mixed batch go stale and get failed out
        // from under a still-running handler before the shared timer ever touches it.
        const heartbeatCandidates = jobs.map((j)=>j.heartbeatSeconds || 0).filter((s)=>s > 0);
        const heartbeatSeconds = heartbeatCandidates.length ? Math.min(...heartbeatCandidates) : 0;
        const ac = new AbortController();
        jobs.forEach((job)=>{
            job.signal = ac.signal;
        });
        // Store AbortController on worker so it can be aborted after graceful shutdown
        if (worker) {
            worker.abortController = ac;
        }
        let heartbeatTimer = null;
        if (heartbeatSeconds > 0) {
            const refreshSeconds = heartbeatRefreshSeconds ?? heartbeatSeconds / 2;
            const intervalMs = refreshSeconds * 1000;
            heartbeatTimer = setInterval(async ()=>{
                try {
                    await this.touch(name, jobIds);
                } catch (err) {
                    this.emit(events.error, err);
                }
            }, intervalMs);
        }
        let completedResult;
        let completedAffected = 0;
        let failedError;
        let didFail = false;
        try {
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveWithinSeconds"])(callback(jobs), maxExpiration, `handler execution exceeded ${maxExpiration}s`, ac);
            if (perJobResults) {
                // #settlePerJob settles each job individually and does its own (synchronous,
                // lookup-free) spy tracking via #trackJobsSettled, so the deferred tracker below
                // is skipped for this path.
                await this.#settlePerJob(name, jobs, result);
            } else {
                const completion = await this.complete(name, jobIds, jobIds.length === 1 ? result : undefined);
                completedResult = result;
                completedAffected = completion.affected;
            }
        } catch (err) {
            await this.fail(name, jobIds, err);
            failedError = err;
            didFail = true;
        } finally{
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            if (worker) {
                // Clear between jobs
                worker.abortController = null;
            }
        }
        // Spy tracking runs after the completion/failure logic so a spy lookup error can never
        // be mistaken for a handler failure and re-route the job through fail(). The flag is
        // gated here, not just inside the trackers, so the production hot path (spies off) never
        // even calls the async tracker — no promise allocated, no microtask tick. The checks
        // inside the trackers stay as a safety net.
        if (this.config.__test__enableSpies && this.#spies.has(name)) {
            if (didFail) {
                await this.#trackJobsFailed(name, jobs, failedError);
            } else if (!perJobResults) {
                // perJobResults already tracked inside #settlePerJob; tracking again here would
                // double-record (and overwrite per-job outputs with the batch's slow-path lookup).
                await this.#trackJobsCompleted(name, jobs, completedResult, completedAffected);
            }
        }
    }
    async start() {
        this.stopped = false;
        this.queueCacheInterval = setInterval(()=>this.onCacheQueues({
                emit: true
            }), this.config.queueCacheIntervalSeconds * 1000);
        this.wipInterval = setInterval(()=>{
            const now = Date.now();
            if (now - this.wipTs < 2000) {
                return;
            }
            const wip = this.getWipData();
            if (wip.some((w)=>w.count > 0)) {
                this.emit(events.wip, wip);
                this.wipTs = now;
            }
        }, 2000);
        await this.onCacheQueues();
    }
    async onCacheQueues({ emit = false } = {}) {
        try {
            (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(!this.config.__test__throw_queueCache, 'test error');
            const queues = await this.getQueues();
            this.queues = queues.reduce((acc, i)=>{
                acc[i.name] = i;
                return acc;
            }, {});
        } catch (error) {
            emit && this.emit(events.error, {
                ...error,
                message: error.message,
                stack: error.stack
            });
        }
    }
    async getQueueCache(name) {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(this.queues, 'Queue cache is not initialized');
        let queue = this.queues[name];
        if (queue) {
            return queue;
        }
        queue = await this.getQueue(name);
        if (!queue) {
            throw new Error(`Queue ${name} does not exist`);
        }
        this.queues[name] = queue;
        return queue;
    }
    #evictQueueCache(name) {
        if (this.queues) delete this.queues[name];
    }
    async stop() {
        this.stopped = true;
        clearInterval(this.queueCacheInterval);
        clearInterval(this.wipInterval);
        await Promise.allSettled([
            ...this.workers.values()
        ].filter((worker)=>!INTERNAL_QUEUES[worker.name]).map(async (worker)=>await this.offWork(worker.name, {
                wait: false
            })));
        // Clean up all local group tracking on full stop
        this.#localGroupConfig.clear();
        this.#localGroupActive.clear();
        this.#localGroupMaxLimit.clear();
    }
    async failWip() {
        for (const worker of this.workers.values()){
            const jobIds = worker.jobs.map((j)=>j.id);
            if (jobIds.length) {
                await this.fail(worker.name, jobIds, 'pg-boss shut down while active');
            }
            worker.abort();
        }
    }
    async work(name, ...args) {
        const { options, callback } = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["checkWorkArgs"](name, args);
        if (this.stopped) {
            throw new Error('Workers are disabled. pg-boss is stopped');
        }
        const { pollingInterval: interval, notifyPollingInterval: notifyInterval, burstWhenReadyExceeds, burstWhenBatchFull = false, batchSize = 1, includeMetadata = false, priority = true, localConcurrency = 1, localGroupConcurrency, groupConcurrency, orderByCreatedOn = true, heartbeatRefreshSeconds, minPriority, maxPriority, perJobResults = false } = options;
        if (localGroupConcurrency != null) {
            this.#storeLocalGroupConfig(name, localGroupConcurrency);
        }
        const firstWorkerId = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])({
            disableEntropyCache: true
        });
        // NOTIFY is only doing the fast-path wakeups when the queue opted in (notify) AND the
        // instance listener is established.
        const isNotifyActive = ()=>!!(this.notifier?.available && this.queues?.[name]?.notify);
        // Runnable backlog from the cached queue stats, refreshed every queueCacheIntervalSeconds.
        const getReadyCount = ()=>this.queues?.[name]?.readyCount ?? 0;
        // Resolve the delay before each fetch. Precedence: burst (fetch continuously) > NOTIFY
        // backstop > base poll. Evaluated per-iteration so it tracks live cache/notify state and
        // any updateQueue notify toggles.
        //
        // A burst trigger only engages while the last fetch came back full (>= batchSize). That is
        // both the meaning of burstWhenBatchFull and the anti-hot-loop guard for burstWhenReadyExceeds:
        // the cached ready count lags reality, so a short fetch (including 0 < 1 at the default batchSize)
        // means the queue has likely caught up — fall back to normal polling instead of spinning on
        // empty fetches. burstWhenBatchFull is ignored at batchSize 1 (every fetch would be "full").
        const resolveInterval = (lastFetchCount)=>{
            const fullBatch = lastFetchCount >= batchSize;
            const burst = fullBatch && (burstWhenReadyExceeds !== undefined && getReadyCount() > burstWhenReadyExceeds || burstWhenBatchFull && batchSize > 1);
            if (burst) return 0;
            return isNotifyActive() ? notifyInterval : interval;
        };
        const createWorker = (workerId, workId)=>{
            const fetch = ()=>{
                const ignoreGroups = localGroupConcurrency != null ? this.#getGroupsAtLocalCapacity(name) : undefined;
                return this.fetch(name, {
                    batchSize,
                    includeMetadata,
                    priority,
                    orderByCreatedOn,
                    groupConcurrency,
                    ignoreGroups,
                    minPriority,
                    maxPriority
                });
            };
            const onFetch = async (jobs)=>{
                if (!jobs.length) return;
                if (this.config.__test__throw_worker) throw new Error('__test__throw_worker');
                this.emitWip(name);
                this.#trackJobsActive(name, jobs);
                // Get the worker instance for abort controller tracking
                const worker = this.workers.get(workerId);
                // Skip all in-memory group tracking when localGroupConcurrency is not enabled
                if (localGroupConcurrency == null) {
                    await this.#processJobs(name, jobs, callback, worker, heartbeatRefreshSeconds, perJobResults);
                } else {
                    const { allowed, excess, groupedJobs } = this.#trackLocalGroupStart(name, jobs);
                    try {
                        if (excess.length > 0) {
                            const excessIds = excess.map((job)=>job.id);
                            await this.restore(name, excessIds);
                        }
                        if (allowed.length > 0) {
                            await this.#processJobs(name, allowed, callback, worker, heartbeatRefreshSeconds, perJobResults);
                        }
                    } finally{
                        this.#trackLocalGroupEnd(name, groupedJobs);
                    }
                }
                this.emitWip(name);
            };
            const onError = (error)=>{
                this.emit(events.error, {
                    ...error,
                    message: error.message,
                    stack: error.stack,
                    queue: name,
                    worker: workerId
                });
            };
            return new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$worker$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["default"]({
                id: workerId,
                workId,
                name,
                options,
                resolveInterval,
                fetch,
                onFetch,
                onError
            });
        };
        // Spawn workers based on localConcurrency setting
        for(let i = 0; i < localConcurrency; i++){
            const workerId = i === 0 ? firstWorkerId : (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])({
                disableEntropyCache: true
            });
            const worker = createWorker(workerId, firstWorkerId);
            this.addWorker(worker);
            worker.start();
        }
        return firstWorkerId;
    }
    addWorker(worker) {
        this.workers.set(worker.id, worker);
    }
    removeWorker(worker) {
        this.workers.delete(worker.id);
    }
    getWorkers() {
        return Array.from(this.workers.values());
    }
    emitWip(name) {
        if (!INTERNAL_QUEUES[name]) {
            const now = Date.now();
            if (now - this.wipTs > 2000) {
                this.emit(events.wip, this.getWipData());
                this.wipTs = now;
            }
        }
    }
    getWipData(options = {}) {
        const { includeInternal = false } = options;
        const data = this.getWorkers().map((i)=>i.toWipData()).filter((i)=>i.state !== 'stopped' && (!INTERNAL_QUEUES[i.name] || includeInternal));
        return data;
    }
    hasPendingCleanups() {
        return this.pendingOffWorkCleanups.size > 0;
    }
    async offWork(name, options = {
        wait: true
    }) {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(name, 'queue name is required');
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(typeof name === 'string', 'queue name must be a string');
        // work() returns only the first spawned worker's id (shared as `workId` across every worker
        // it spawned under localConcurrency), so { id } must match on workId too — otherwise only
        // worker 0 of a localConcurrency > 1 call ever stops, and the rest poll forever with no other
        // way to reach them. i.id is still checked so a specific worker id from getWipData() still
        // targets just that one worker. name is always required so a stray/mismatched id can't stop
        // a worker on a different queue.
        const query = (i)=>i.name === name && (options?.id ? i.id === options.id || i.workId === options.id : true);
        const workers = this.getWorkers().filter((i)=>query(i) && !i.stopping && !i.stopped);
        if (workers.length === 0) {
            return;
        }
        const cleanupPromise = Promise.allSettled(workers.map(async (worker)=>{
            await worker.stop();
            this.removeWorker(worker);
        }));
        if (options.wait) {
            await cleanupPromise;
            this.#cleanupLocalGroupTracking(name);
        } else {
            this.pendingOffWorkCleanups.add(cleanupPromise);
            cleanupPromise.finally(()=>{
                this.pendingOffWorkCleanups.delete(cleanupPromise);
                this.#cleanupLocalGroupTracking(name);
            });
        }
    }
    notifyWorker(workerId) {
        this.workers.get(workerId)?.notify();
    }
    // Whether a queue's `notify` opt-in actually emits a transactional pg_notify. Backends that
    // don't implement LISTEN/NOTIFY (noListenNotify, e.g. CockroachDB) would error on the inlined
    // pg_notify, so the producer falls back to polling-only delivery on those.
    #notifyEnabled(queueNotify) {
        return !!queueNotify && !this.config.noListenNotify;
    }
    // Wake every worker on a queue so it fetches now instead of waiting out its poll delay.
    // Called by the LISTEN/NOTIFY listener when a job lands on a notify-enabled queue.
    notifyQueue(name) {
        for (const worker of this.workers.values()){
            if (worker.name === name) {
                worker.notify();
            }
        }
    }
    // Gap recovery: after the listener (re)connects, notifications emitted during the
    // outage were missed, so force every worker on a notify-enabled queue to fetch once.
    forceFetchLnWorkers() {
        for (const worker of this.workers.values()){
            if (this.queues?.[worker.name]?.notify) {
                worker.notify();
            }
        }
    }
    async subscribe(event, name) {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(event, 'Missing required argument');
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(name, 'Missing required argument');
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["subscribe"](this.config.schema);
        await this.db.executeSql(sql, [
            event,
            name
        ]);
    }
    async unsubscribe(event, name) {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(event, 'Missing required argument');
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(name, 'Missing required argument');
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["unsubscribe"](this.config.schema);
        await this.db.executeSql(sql, [
            event,
            name
        ]);
    }
    async publish(event, data, options) {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(event, 'Missing required argument');
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getQueuesForEvent"](this.config.schema);
        const { rows } = await this.db.executeSql(sql, [
            event
        ]);
        await Promise.allSettled(rows.map(({ name })=>this.send(name, data, options)));
    }
    async send(...args) {
        const result = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["checkSendArgs"](args);
        return await this.createJob(result);
    }
    async sendAfter(name, data, options, after) {
        options = options ? {
            ...options
        } : {};
        options.startAfter = after;
        const result = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["checkSendArgs"]([
            name,
            data,
            options
        ]);
        return await this.createJob(result);
    }
    async sendThrottled(name, data, options, seconds, key) {
        options = options ? {
            ...options
        } : {};
        options.singletonSeconds = seconds;
        options.singletonNextSlot = false;
        options.singletonKey = key;
        const result = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["checkSendArgs"]([
            name,
            data,
            options
        ]);
        return await this.createJob(result);
    }
    async sendDebounced(name, data, options, seconds, key) {
        options = options ? {
            ...options
        } : {};
        options.singletonSeconds = seconds;
        options.singletonNextSlot = true;
        options.singletonKey = key;
        const result = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["checkSendArgs"]([
            name,
            data,
            options
        ]);
        return await this.createJob(result);
    }
    // Shapes a validated request into the JSON job payload consumed by plans.insertJobs and
    // plans.updateJob. Shared by createJob (send) and update/upsert so all three derive
    // start_after/keep_until/singleton the same way.
    #toJobPayload(name, data, options) {
        const { id = null, priority, startAfter, singletonKey = null, singletonSeconds, expireInSeconds, deleteAfterSeconds, retentionSeconds, retryLimit, retryDelay, retryBackoff, retryDelayMax, heartbeatSeconds, group, deadLetter = null } = options;
        return {
            id,
            name,
            data,
            priority,
            startAfter,
            singletonKey,
            singletonSeconds,
            singletonOffset: 0,
            groupId: group?.id ?? null,
            groupTier: group?.tier ?? null,
            expireInSeconds,
            deleteAfterSeconds,
            retentionSeconds,
            retryLimit,
            retryDelay,
            retryBackoff,
            retryDelayMax,
            heartbeatSeconds,
            deadLetter
        };
    }
    async createJob(request) {
        const { name, data = null, options = {} } = request;
        const { db: wrapper, singletonSeconds, singletonNextSlot } = options;
        const job = this.#toJobPayload(name, data, options);
        const db = wrapper || this.db;
        const { table, policy, notify } = await this.getQueueCache(name);
        if (policy === __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUE_POLICIES"].key_strict_fifo && !job.singletonKey) {
            throw new Error(`${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUE_POLICIES"].key_strict_fifo} queues require a singletonKey`);
        }
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["insertJobs"](this.config.schema, {
            table,
            name,
            returnId: true,
            notify: this.#notifyEnabled(notify)
        });
        const { rows: try1 } = await db.executeSql(sql, [
            JSON.stringify([
                job
            ])
        ]);
        if (try1.length === 1) {
            const jobId = try1[0].id;
            if (this.config.__test__enableSpies) {
                const spy = this.#spies.get(name);
                if (spy) {
                    spy.addJob(jobId, name, data || {}, 'created');
                }
            }
            return jobId;
        }
        if (singletonNextSlot) {
            // delay starting by the offset to honor throttling config
            job.startAfter = this.getDebounceStartAfter(singletonSeconds, this.timekeeper.clockSkew);
            job.singletonOffset = singletonSeconds;
            const { rows: try2 } = await db.executeSql(sql, [
                JSON.stringify([
                    job
                ])
            ]);
            if (try2.length === 1) {
                const jobId = try2[0].id;
                if (this.config.__test__enableSpies) {
                    const spy = this.#spies.get(name);
                    if (spy) {
                        spy.addJob(jobId, name, data || {}, 'created');
                    }
                }
                return jobId;
            }
        }
        return null;
    }
    // Builds the partial-edit payload for update()/upsert(): ONLY the fields the caller actually
    // supplied end up as keys (undefined is dropped by JSON.stringify), so plans.updateJob leaves
    // every other column untouched. Compatible with both plans.updateJob ($1 = this object) and
    // plans.insertJobs ($1 = [this object]), whose json_to_recordset treats absent keys as null.
    #toUpdatePayload(data, options) {
        return {
            data,
            priority: options.priority,
            startAfter: options.startAfter,
            retentionSeconds: options.retentionSeconds,
            expireInSeconds: options.expireInSeconds,
            deleteAfterSeconds: options.deleteAfterSeconds,
            retryLimit: options.retryLimit,
            retryDelay: options.retryDelay,
            retryBackoff: options.retryBackoff,
            retryDelayMax: options.retryDelayMax,
            deadLetter: options.deadLetter,
            heartbeatSeconds: options.heartbeatSeconds,
            groupId: options.group?.id,
            groupTier: options.group?.tier,
            id: options.id,
            singletonKey: options.singletonKey
        };
    }
    async update(...args) {
        const request = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["checkUpdateArgs"](args);
        const { name, data } = request;
        const opts = request.options ?? {};
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const db = this.assertDb(opts);
        const { table, notify } = await this.getQueueCache(name);
        const by = opts.id ? 'id' : 'singletonKey';
        const match = opts.match ?? 'newest';
        const payload = JSON.stringify(this.#toUpdatePayload(data, opts));
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["updateJob"](this.config.schema, table, name, by, match, this.#notifyEnabled(notify));
        const { rows } = await db.executeSql(sql, [
            payload
        ]);
        const jobs = rows.map((row)=>row.id);
        return {
            jobs,
            updated: jobs.length
        };
    }
    async upsert(...args) {
        const request = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["checkUpdateArgs"](args, {
            upsert: true
        });
        const { name, data } = request;
        const opts = request.options ?? {};
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const db = this.assertDb(opts);
        const { table, policy, notify } = await this.getQueueCache(name);
        const by = opts.id ? 'id' : 'singletonKey';
        const match = opts.match ?? 'newest';
        // The insert-on-miss path needs a singletonKey on key_strict_fifo queues (a keyless job would
        // violate the queue's check constraint), so reject upfront — including the id-target case.
        if (policy === __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUE_POLICIES"].key_strict_fifo && !opts.singletonKey) {
            throw new Error(`${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUE_POLICIES"].key_strict_fifo} queues require a singletonKey`);
        }
        const notifyEnabled = this.#notifyEnabled(notify);
        const updateSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["updateJob"](this.config.schema, table, name, by, match, notifyEnabled);
        const insertSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["insertJobs"](this.config.schema, {
            table,
            name,
            returnId: true,
            notify: notifyEnabled
        });
        const job = this.#toUpdatePayload(data, opts);
        const updatePayload = JSON.stringify(job);
        const insertPayload = JSON.stringify([
            job
        ]);
        const result = await this.ensureTransaction(db, async (tx)=>{
            const { rows: updated } = await tx.executeSql(updateSql, [
                updatePayload
            ]);
            if (updated.length) {
                const jobs = updated.map((row)=>row.id);
                return {
                    jobs,
                    updated: jobs.length,
                    inserted: 0
                };
            }
            const { rows: inserted } = await tx.executeSql(insertSql, [
                insertPayload
            ]);
            if (inserted.length) {
                const jobs = inserted.map((row)=>row.id);
                return {
                    jobs,
                    updated: 0,
                    inserted: jobs.length
                };
            }
            // The insert was skipped by ON CONFLICT (a concurrent send/upsert won the race); the
            // conflicting row is now visible, so edit it.
            const { rows: retry } = await tx.executeSql(updateSql, [
                updatePayload
            ]);
            const jobs = retry.map((row)=>row.id);
            return {
                jobs,
                updated: jobs.length,
                inserted: 0
            };
        });
        // Track inserted (newly created) jobs for spies, matching createJob/insert. Runs after the
        // transaction commits so a rolled-back insert never leaves a phantom spy entry.
        if (result.inserted && this.config.__test__enableSpies) {
            const spy = this.#spies.get(name);
            if (spy) {
                for (const id of result.jobs){
                    spy.addJob(id, name, data || {}, 'created');
                }
            }
        }
        return result;
    }
    async insert(name, jobs, options = {}) {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(Array.isArray(jobs), 'jobs argument should be an array');
        const seenIds = new Set();
        for (const job of jobs){
            if (job.id != null) {
                if (seenIds.has(job.id)) {
                    throw new Error(`duplicate job id in insert batch: ${job.id}`);
                }
                seenIds.add(job.id);
            }
            // insert() otherwise skips Attorney on purpose (it is the raw, high-volume path), but an
            // invalid group is worth rejecting here: send() already throws on it, and an empty-string
            // group.id would silently become a real concurrency group named '' once persisted.
            __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["validateGroupConfig"](job);
        }
        const { table, policy, notify } = await this.getQueueCache(name);
        if (policy === __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUE_POLICIES"].key_strict_fifo) {
            for (const job of jobs){
                if (!job.singletonKey) {
                    throw new Error(`${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUE_POLICIES"].key_strict_fifo} queues require a singletonKey`);
                }
            }
        }
        const spy = this.config.__test__enableSpies ? this.#spies.get(name) : undefined;
        // insertJobs ends in ON CONFLICT DO NOTHING, so skipped rows shift the returned rows out of
        // alignment with the input jobs — a positional rows[i] <-> jobs[i] pairing attributes the wrong
        // data to the wrong id. When a spy is watching, assign every job an explicit id up front (the
        // insert COALESCEs id, so this is equivalent to letting the DB generate one) and index data by
        // id, so returned rows can be matched back to their job regardless of any conflicts.
        const dataById = spy ? new Map() : undefined;
        const insertPayload = jobs.map((j)=>{
            const { blocked, blocking, pendingDependencies, group, ...rest } = j;
            // Flatten group to the column names insertJobs' json_to_recordset declares, matching
            // send()/upsert()/flow(). Assigned only when a group is present: those same raw column
            // names are accepted by the recordset directly, and unconditional keys would overwrite
            // them with undefined — silently breaking anyone who passed groupId/groupTier as a
            // workaround while insert() was dropping `group` entirely.
            if (group) {
                Object.assign(rest, {
                    groupId: group.id,
                    groupTier: group.tier
                });
            }
            // insert() otherwise skips Attorney, but a zone-less date time string still has to be pinned
            // to UTC: without it the same string resolves in the database session's TimeZone here while
            // resolving as UTC through send(), so one API would schedule a different instant than the other.
            if (typeof rest.startAfter === 'string') {
                rest.startAfter = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pinZonelessDateTime"](rest.startAfter);
            }
            if (dataById) {
                // Best-effort spy bookkeeping, only reached when __test__enableSpies is set (a test-intended
                // opt-in, off by default). The id we assign here is exactly what the DB would otherwise
                // COALESCE in, so generating it client-side is harmless — and if randomUUID ever fell short,
                // only spy attribution would degrade, never the insert itself.
                rest.id ??= (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])();
                dataById.set(rest.id, j.data ?? {});
            }
            return rest;
        });
        const db = this.assertDb(options);
        // Return IDs if spy is active for this queue (needed for job tracking)
        const returnId = !!spy || !!options.returnId;
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["insertJobs"](this.config.schema, {
            table,
            name,
            returnId,
            notify: this.#notifyEnabled(notify)
        });
        const { rows } = await db.executeSql(sql, [
            JSON.stringify(insertPayload)
        ]);
        if (rows.length) {
            if (spy) {
                // dataById is populated for every job when a spy is active
                for (const row of rows){
                    spy.addJob(row.id, name, dataById.get(row.id), 'created');
                }
            }
            return rows.map((i)=>i.id);
        }
        return null;
    }
    async flow(jobs, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["validateFlowJobs"](jobs);
        // validate and normalize each job's options the same way send()/insert() do
        const flowJobs = jobs.map((job)=>({
                ...job,
                options: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["checkSendArgs"]([
                    {
                        name: job.name,
                        data: job.data,
                        options: job.options
                    }
                ]).options
            }));
        const refToId = {};
        for (const job of flowJobs){
            refToId[job.ref] = job.options?.id ?? (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])();
        }
        const refToJob = new Map(flowJobs.map((job)=>[
                job.ref,
                job
            ]));
        const dependencyCountByRef = new Map();
        const parentRefs = new Set();
        const depRows = [];
        for (const job of flowJobs){
            const dependsOn = [
                ...new Set(job.dependsOn ?? [])
            ];
            dependencyCountByRef.set(job.ref, dependsOn.length);
            for (const depRef of dependsOn){
                const parentJob = refToJob.get(depRef);
                parentRefs.add(depRef);
                depRows.push({
                    child_name: job.name,
                    child_id: refToId[job.ref],
                    parent_name: parentJob.name,
                    parent_id: refToId[depRef]
                });
            }
        }
        const byQueue = new Map();
        for (const job of flowJobs){
            const group = byQueue.get(job.name) || [];
            group.push(job);
            byQueue.set(job.name, group);
        }
        // Build one self-contained, parameter-less statement list so the whole flow
        // commits atomically in a single executeSql call, regardless of db adapter.
        // Each insert is guarded so a skipped row (ON CONFLICT) aborts the transaction.
        const statements = [];
        for (const [queueName, queueJobs] of byQueue){
            const { table, notify } = await this.getQueueCache(queueName);
            const insertPayload = queueJobs.map((j)=>{
                const dependencyCount = dependencyCountByRef.get(j.ref) ?? 0;
                return {
                    id: refToId[j.ref],
                    name: queueName,
                    data: j.data ?? null,
                    priority: j.options?.priority,
                    startAfter: j.options?.startAfter,
                    singletonKey: j.options?.singletonKey ?? undefined,
                    singletonSeconds: j.options?.singletonSeconds,
                    groupId: j.options?.group?.id ?? undefined,
                    groupTier: j.options?.group?.tier ?? undefined,
                    expireInSeconds: j.options?.expireInSeconds,
                    deleteAfterSeconds: j.options?.deleteAfterSeconds,
                    retentionSeconds: j.options?.retentionSeconds,
                    retryLimit: j.options?.retryLimit,
                    retryDelay: j.options?.retryDelay,
                    retryBackoff: j.options?.retryBackoff,
                    retryDelayMax: j.options?.retryDelayMax,
                    heartbeatSeconds: j.options?.heartbeatSeconds,
                    deadLetter: j.options?.deadLetter ?? undefined,
                    blocked: dependencyCount > 0 || undefined,
                    blocking: parentRefs.has(j.ref) || undefined,
                    pendingDependencies: dependencyCount || undefined
                };
            });
            statements.push(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["insertFlowJobs"](this.config.schema, {
                table,
                name: queueName
            }, insertPayload));
            // Wake workers for notify-enabled queues. Runs in the same transaction as the
            // inserts above, so it commits atomically. Blocked children and future-dated roots
            // are harmless: the fetch query filters them out, so a wake just triggers one fetch
            // that picks up whatever roots are immediately runnable.
            if (this.#notifyEnabled(notify)) {
                statements.push(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifyQueue"](this.config.schema, queueName));
            }
        }
        if (depRows.length > 0) {
            statements.push(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["insertDependencies"](this.config.schema, depRows));
        }
        // When the caller provides a db they own the transaction; otherwise wrap the
        // statements so they run atomically as a single round-trip on any adapter.
        const db = options.db ?? this.db;
        const sql = options.db ? statements.join(';\n') : __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["transaction"](statements);
        try {
            await db.executeSql(sql);
        } catch (err) {
            rethrowWriteError(err);
        }
        return refToId;
    }
    getDebounceStartAfter(singletonSeconds, clockOffset) {
        const debounceInterval = singletonSeconds * 1000;
        const now = Date.now() + clockOffset;
        const slot = Math.floor(now / debounceInterval) * debounceInterval;
        // prevent startAfter=0 during debouncing
        let startAfter = singletonSeconds - Math.floor((now - slot) / 1000) || 1;
        if (singletonSeconds > 1) {
            startAfter++;
        }
        return startAfter;
    }
    async fetch(name, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["checkFetchArgs"](name, options);
        const db = this.assertDb(options);
        const { table, policy, singletonsActive } = await this.getQueueCache(name);
        const fetchOptions = {
            ...options,
            schema: this.config.schema,
            table,
            name,
            policy,
            limit: options.batchSize || 1,
            ignoreSingletons: singletonsActive
        };
        const query = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["fetchNextJob"](fetchOptions, this.config.noSkipLocked);
        let result;
        try {
            result = await db.executeSql(query.text, query.values);
        } catch (err) {
            // The only fetch error we tolerate is a unique-constraint violation (SQLSTATE 23505) from a
            // policy/singleton index when a concurrent fetch won the same slot — treat that as an empty
            // fetch. Anything else (a DB outage, a malformed query) must surface: swallowing it turned
            // every failed fetch into a silent [] with no error event, indistinguishable from an empty
            // queue. Rethrowing routes it to the worker's onError (emits `error`) or to a direct caller.
            if (err?.code !== '23505') throw err;
        }
        const rows = result?.rows || [];
        // CockroachDB returns integer columns as strings; normalize them. Even a minimal fetch
        // (JOB_COLUMNS_MIN) returns numeric fields like expireInSeconds/heartbeatSeconds, so normalize
        // regardless of includeMetadata. The columns are aliased to camelCase, so use those keys.
        if (this.config.backend === 'cockroachdb') {
            for (const row of rows){
                for (const field of NUMERIC_METADATA_FIELDS){
                    if (row[field] !== undefined && row[field] !== null) row[field] = Number(row[field]);
                }
            }
        }
        return rows;
    }
    mapCompletionIdArg(id, funcName) {
        const errorMessage = `${funcName}() requires an id`;
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(id, errorMessage);
        const ids = Array.isArray(id) ? id : [
            id
        ];
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(ids.length, errorMessage);
        return ids;
    }
    mapCompletionDataArg(data) {
        if (data === null || typeof data === 'undefined' || typeof data === 'function') {
            return null;
        }
        const result = typeof data === 'object' && !Array.isArray(data) ? data : {
            value: data
        };
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$serialize$2d$error$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__["serializeError"])(result);
    }
    mapCommandResponse(ids, result) {
        return {
            jobs: ids,
            requested: ids.length,
            affected: result && result.rows ? parseInt(result.rows[0].count) : 0
        };
    }
    async complete(name, id, data, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const db = this.assertDb(options);
        const ids = this.mapCompletionIdArg(id, 'complete');
        const { table } = await this.getQueueCache(name);
        const outputData = this.mapCompletionDataArg(data);
        // noMultiMutationCte: split the dependency-unblocking into a separate statement to
        // avoid CockroachDB's multi-mutation CTE limitation (completeJobs updates two tables).
        if (this.config.noMultiMutationCte) {
            return this.completeDistributed(name, ids, outputData, table, db, options.includeQueued);
        }
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["completeJobs"](this.config.schema, table, options.includeQueued);
        const result = await db.executeSql(sql, [
            name,
            ids,
            outputData
        ]);
        return this.mapCommandResponse(ids, result);
    }
    // Distributed complete/fail need several statements run atomically. When we own the pooled
    // connection we pin a single client via withTransaction(); when the caller supplied their own
    // db (options.db) we run the statements inline so they compose inside the caller's transaction
    // rather than issuing a BEGIN/COMMIT that would commit or roll back their outer work.
    async ensureTransaction(db, fn) {
        if (db === this.db && this.db._pgbdb) {
            return this.db.withTransaction(fn);
        }
        return fn(db);
    }
    async completeDistributed(name, ids, outputData, table, db, includeQueued) {
        // Dependency unblocking is handled out of band by the background resolver (Navigator), so
        // completion is a single statement on every backend.
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["completeJobsDistributed"](this.config.schema, table, includeQueued);
        const { rows } = await db.executeSql(sql, [
            name,
            ids,
            outputData
        ]);
        return {
            jobs: ids,
            requested: ids.length,
            affected: rows.length
        };
    }
    async fail(name, id, data, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const db = this.assertDb(options);
        const ids = this.mapCompletionIdArg(id, 'fail');
        const { table } = await this.getQueueCache(name);
        const outputData = this.mapCompletionDataArg(data);
        // noMultiMutationCte: use separate queries to avoid CockroachDB's multi-mutation CTE limitation.
        // The delete and re-insert run in a single transaction (see ensureTransaction) so the
        // job cannot be lost between the two statements.
        if (this.config.noMultiMutationCte) {
            return this.failDistributed(name, ids, outputData, table, db);
        }
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["failJobsById"](this.config.schema, table);
        const result = await db.executeSql(sql, [
            name,
            ids,
            outputData
        ]);
        return this.mapCommandResponse(ids, result);
    }
    async failDistributed(name, ids, outputData, table, db) {
        // CockroachDB doesn't support multi-mutation CTEs, but does support transactions, so the
        // delete + re-insert is split into separate statements run atomically.
        return this.ensureTransaction(db, async (tx)=>{
            // Step 1: Select jobs to fail
            const selectQuery = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["selectJobsToFailById"](this.config.schema, table);
            const { rows: jobs } = await tx.executeSql(selectQuery.text, [
                name,
                ids
            ]);
            if (jobs.length === 0) {
                return {
                    jobs: ids,
                    requested: ids.length,
                    affected: 0
                };
            }
            // Step 2: Delete the jobs
            const deleteQuery = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["deleteJobsToFail"](this.config.schema, table);
            await tx.executeSql(deleteQuery.text, [
                name,
                ids
            ]);
            // Step 3: Re-insert jobs with updated state
            const count = await this.reinsertFailedJobs(tx, table, jobs, outputData);
            return {
                jobs: ids,
                requested: ids.length,
                affected: count
            };
        });
    }
    // Distributed equivalents of the supervisor's failJobsByTimeout/failJobsByHeartbeat maintenance.
    // Those use the multi-mutation failJobs() CTE, which CockroachDB rejects, so on a distributed
    // database we select the expired/timed-out jobs, delete them, and re-insert as retry/failed in a
    // single transaction (the same split as failDistributed). Always run on the pooled connection.
    async failJobsByTimeoutDistributed(table, queues) {
        const select = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["selectJobsToFailByTimeout"](this.config.schema, table, queues);
        return this.expireJobsDistributed(table, select, {
            value: {
                message: 'job timed out'
            }
        });
    }
    async failJobsByHeartbeatDistributed(table, queues) {
        const select = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["selectJobsToFailByHeartbeat"](this.config.schema, table, queues);
        return this.expireJobsDistributed(table, select, {
            value: {
                message: 'job heartbeat timeout'
            }
        });
    }
    // Distributed flow audit for one partition table (CockroachDB / noMultiMutationCte): lock a
    // batch of completed blocking parents, then decrement their children and clear blocking per
    // parent queue (decrementDependents and clearBlocking are each keyed by a single name). Returns
    // the number of parents resolved so the resolver can loop until a batch drains.
    async resolveFlowJobsDistributed(table, names) {
        const select = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["selectBlockingParents"](this.config.schema, table, names, this.config.noSkipLocked);
        return this.ensureTransaction(this.db, async (tx)=>{
            const { rows } = await tx.executeSql(select.text, select.values);
            if (rows.length === 0) {
                return 0;
            }
            const idsByName = new Map();
            for (const row of rows){
                const list = idsByName.get(row.name) || [];
                list.push(row.id);
                idsByName.set(row.name, list);
            }
            const decrementSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["decrementDependents"](this.config.schema);
            const clearSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["clearBlocking"](this.config.schema);
            for (const [name, ids] of idsByName){
                await tx.executeSql(decrementSql, [
                    name,
                    ids
                ]);
                await tx.executeSql(clearSql, [
                    name,
                    ids
                ]);
            }
            return rows.length;
        });
    }
    async expireJobsDistributed(table, select, outputData) {
        return this.ensureTransaction(this.db, async (tx)=>{
            const { rows: jobs } = await tx.executeSql(select.text, []);
            if (jobs.length === 0) {
                return 0;
            }
            const ids = jobs.map((job)=>job.id);
            const deleteSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["deleteJobsByIds"](this.config.schema, table);
            await tx.executeSql(deleteSql.text, [
                ids
            ]);
            return this.reinsertFailedJobs(tx, table, jobs, outputData);
        });
    }
    // Re-insert a set of just-deleted jobs as retry (when retries remain) or failed (+ dead letter),
    // preserving the flow/heartbeat columns. Shared by failDistributed and the distributed
    // maintenance expiry above. Returns the number of jobs processed.
    async reinsertFailedJobs(tx, table, jobs, outputData, outputById, forceTerminal = false) {
        const insertSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["insertRetryJob"](this.config.schema, table);
        const dlqSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["insertDeadLetterJob"](this.config.schema);
        let count = 0;
        for (const job of jobs){
            // Per-job output when supplied (perJobResults), otherwise the single shared output.
            const jobOutput = outputById ? outputById.get(job.id) ?? null : outputData;
            // CockroachDB returns INT8 columns as strings. These rows come straight from a SELECT *, so
            // unlike fetch/getJobById they are never normalized. Coerce the fields used in arithmetic and
            // comparison below — otherwise `retry_count < retry_limit` is a lexicographic string compare
            // ("9" < "10" === false, wrongly failing a retriable job) and `retry_count + 1` concatenates.
            const retryCount = Number(job.retry_count);
            const retryLimit = Number(job.retry_limit);
            const retryDelay = Number(job.retry_delay);
            const retryDelayMax = job.retry_delay_max != null ? Number(job.retry_delay_max) : null;
            // forceTerminal (perJobResults `deadletter`) skips retries so the job fails terminally and
            // routes straight to the dead letter queue below.
            const canRetry = !forceTerminal && retryCount < retryLimit;
            let retried = false;
            if (canRetry) {
                // Calculate start_after for retry
                let startAfter = job.start_after;
                if (!job.retry_backoff) {
                    startAfter = new Date(Date.now() + retryDelay * 1000);
                } else {
                    const exp = Math.min(16, retryCount + 1);
                    const delay = Math.max(retryDelay, 1) * (Math.pow(2, exp) / 2 + Math.pow(2, exp) / 2 * Math.random());
                    // Match the canonical failJobs() SQL: LEAST(retry_delay_max, delay) caps the backoff,
                    // treating NULL as "no cap" and 0 as a real cap. (`?:` would wrongly treat 0 as no cap.)
                    const cappedDelay = retryDelayMax != null ? Math.min(retryDelayMax, delay) : delay;
                    startAfter = new Date(Date.now() + cappedDelay * 1000);
                }
                // heartbeat_on resets to NULL on re-insert; heartbeat_seconds/blocked/blocking/
                // pending_dependencies are preserved so flows and heartbeat detection survive a retry
                // (matches the non-distributed failJobs() CTE).
                const { rows } = await tx.executeSql(insertSql, [
                    job.id,
                    job.name,
                    job.priority,
                    job.data,
                    'retry',
                    job.retry_limit,
                    job.retry_count,
                    job.retry_delay,
                    job.retry_backoff,
                    job.retry_delay_max,
                    startAfter,
                    job.started_on,
                    job.singleton_key,
                    job.singleton_on,
                    job.group_id,
                    job.group_tier,
                    job.expire_seconds,
                    job.deletion_seconds,
                    job.created_on,
                    null,
                    job.keep_until,
                    job.policy,
                    jobOutput,
                    job.dead_letter,
                    null,
                    job.heartbeat_seconds,
                    job.blocked,
                    job.blocking,
                    job.pending_dependencies
                ]);
                // The retry insert can be dropped by ON CONFLICT when the queue policy (e.g. stately,
                // singleton, key_strict_fifo) already has a non-terminal job. Mirror the failed_jobs
                // fallback of the non-distributed failJobs() CTE in that case.
                retried = rows.length > 0;
            }
            if (!retried) {
                await tx.executeSql(insertSql, [
                    job.id,
                    job.name,
                    job.priority,
                    job.data,
                    'failed',
                    job.retry_limit,
                    job.retry_count,
                    job.retry_delay,
                    job.retry_backoff,
                    job.retry_delay_max,
                    job.start_after,
                    job.started_on,
                    job.singleton_key,
                    job.singleton_on,
                    job.group_id,
                    job.group_tier,
                    job.expire_seconds,
                    job.deletion_seconds,
                    job.created_on,
                    new Date(),
                    job.keep_until,
                    job.policy,
                    jobOutput,
                    job.dead_letter,
                    null,
                    job.heartbeat_seconds,
                    job.blocked,
                    job.blocking,
                    job.pending_dependencies
                ]);
                // Insert to dead letter queue if failed and has dead_letter configured
                if (job.dead_letter) {
                    await tx.executeSql(dlqSql, [
                        job.dead_letter,
                        job.data,
                        jobOutput,
                        job.name,
                        job.id,
                        job.created_on,
                        job.retry_count,
                        job.singleton_key,
                        job.priority,
                        job.group_id,
                        job.group_tier
                    ]);
                }
            }
            count++;
        }
        return count;
    }
    async deleteJob(name, id, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const db = this.assertDb(options);
        const ids = this.mapCompletionIdArg(id, 'deleteJob');
        const { table } = await this.getQueueCache(name);
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["deleteJobsById"](this.config.schema, table);
        const result = await db.executeSql(sql, [
            name,
            ids
        ]);
        return this.mapCommandResponse(ids, result);
    }
    async redrive(name, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const { destination, sourceName, limit = 1000 } = options;
        if (destination !== undefined) {
            __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](destination);
        }
        if (sourceName !== undefined) {
            __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](sourceName);
        }
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(Number.isInteger(limit) && limit >= 1, 'limit must be an integer >= 1');
        const db = this.assertDb(options);
        const { table } = await this.getQueueCache(name);
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["redriveJobs"](this.config.schema, table);
        const result = await db.executeSql(sql, [
            name,
            destination ?? null,
            sourceName ?? null,
            limit
        ]);
        return result.rows[0].moved;
    }
    async cancel(name, id, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const db = this.assertDb(options);
        const ids = this.mapCompletionIdArg(id, 'cancel');
        const { table } = await this.getQueueCache(name);
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["cancelJobs"](this.config.schema, table);
        const result = await db.executeSql(sql, [
            name,
            ids
        ]);
        return this.mapCommandResponse(ids, result);
    }
    async resume(name, id, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const db = this.assertDb(options);
        const ids = this.mapCompletionIdArg(id, 'resume');
        const { table } = await this.getQueueCache(name);
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resumeJobs"](this.config.schema, table);
        const result = await db.executeSql(sql, [
            name,
            ids
        ]);
        return this.mapCommandResponse(ids, result);
    }
    async restore(name, id, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const db = this.assertDb(options);
        const ids = this.mapCompletionIdArg(id, 'restore');
        const { table } = await this.getQueueCache(name);
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["restoreJobs"](this.config.schema, table);
        await db.executeSql(sql, [
            name,
            ids
        ]);
    }
    async retry(name, id, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const db = options.db || this.db;
        const ids = this.mapCompletionIdArg(id, 'retry');
        const { table } = await this.getQueueCache(name);
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["retryJobs"](this.config.schema, table);
        const result = await db.executeSql(sql, [
            name,
            ids
        ]);
        return this.mapCommandResponse(ids, result);
    }
    async touch(name, id, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const db = this.assertDb(options);
        const ids = this.mapCompletionIdArg(id, 'touch');
        const { table } = await this.getQueueCache(name);
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["touchJobs"](this.config.schema, table);
        const result = await db.executeSql(sql, [
            name,
            ids
        ]);
        return this.mapCommandResponse(ids, result);
    }
    async createQueue(name, options = {}) {
        name = name || options.name;
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const policy = options.policy || __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUE_POLICIES"].standard;
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(policy in __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUE_POLICIES"], `${policy} is not a valid queue policy`);
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["validateQueueArgs"](options);
        if (options.deadLetter) {
            __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](options.deadLetter);
            (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["notStrictEqual"])(name, options.deadLetter, 'deadLetter cannot be itself');
            await this.getQueueCache(options.deadLetter);
        }
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["createQueue"](this.config.schema, name, {
            ...options,
            policy
        }, this.config.noAdvisoryLocks);
        await this.db.executeSql(sql);
        this.#evictQueueCache(name);
    }
    async getBlockedKeys(name) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const { table, policy } = await this.getQueueCache(name);
        if (policy !== __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUE_POLICIES"].key_strict_fifo) {
            throw new Error(`getBlockedKeys is only available for ${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUE_POLICIES"].key_strict_fifo} queues`);
        }
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getBlockedKeys"](this.config.schema, table);
        const { rows } = await this.db.executeSql(sql, [
            name
        ]);
        return rows.map((row)=>row.singletonKey);
    }
    async getQueues(names) {
        names = Array.isArray(names) ? names : typeof names === 'string' ? [
            names
        ] : undefined;
        if (names) {
            for (const name of names){
                __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
            }
        }
        const query = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getQueues"](this.config.schema, names);
        const { rows } = await this.db.executeSql(query.text, query.values);
        // CockroachDB returns integer columns as strings; normalize the numeric queue fields.
        if (this.config.backend === 'cockroachdb') {
            for (const row of rows){
                for (const field of NUMERIC_QUEUE_FIELDS){
                    if (row[field] !== undefined && row[field] !== null) row[field] = Number(row[field]);
                }
            }
        }
        return rows;
    }
    async updateQueue(name, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(Object.keys(options).length > 0, 'no properties found to update');
        if ('policy' in options) {
            throw new Error('queue policy cannot be changed after creation');
        }
        if ('partition' in options) {
            throw new Error('queue partitioning cannot be changed after creation');
        }
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["validateQueueArgs"](options);
        const { deadLetter } = options;
        // null is the documented way to clear the dead letter queue, so it has to reach the update as a
        // present-but-null key. Only a non-null value is a queue name worth validating.
        if (deadLetter !== null && deadLetter !== undefined) {
            __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](deadLetter);
            (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["notStrictEqual"])(name, deadLetter, 'deadLetter cannot be itself');
        }
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["updateQueue"](this.config.schema);
        await this.db.executeSql(sql, [
            name,
            options
        ]);
        this.#evictQueueCache(name);
    }
    async getQueue(name) {
        const rows = await this.getQueues([
            name
        ]);
        return rows[0] || null;
    }
    async deleteQueue(name) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        // Scope the catch to the cache lookup only: a queue that doesn't exist is a no-op. The DELETE
        // and cache eviction must NOT be swallowed — a transient connection error there previously
        // resolved as success while the queue (and its stale cache entry) survived.
        try {
            await this.getQueueCache(name);
        } catch  {
            return;
        }
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["deleteQueue"](this.config.schema, name, this.config.noAdvisoryLocks);
        await this.db.executeSql(sql);
        this.#evictQueueCache(name);
    }
    async deleteQueuedJobs(name) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const { table } = await this.getQueueCache(name);
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["deleteQueuedJobs"](this.config.schema, table);
        await this.db.executeSql(sql, [
            name
        ]);
    }
    async deleteStoredJobs(name) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const { table } = await this.getQueueCache(name);
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["deleteStoredJobs"](this.config.schema, table);
        await this.db.executeSql(sql, [
            name
        ]);
    }
    async deleteAllJobs(name) {
        if (!name) {
            const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["truncateTable"](this.config.schema, 'job');
            await this.db.executeSql(sql);
            return;
        }
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const { table, partition } = await this.getQueueCache(name);
        if (partition) {
            const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["truncateTable"](this.config.schema, table);
            await this.db.executeSql(sql);
        } else {
            const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["deleteAllJobs"](this.config.schema, table);
            await this.db.executeSql(sql, [
                name
            ]);
        }
    }
    // Queue stats are a time series, always returned as an array (newest first).
    //
    // With persistQueueStats enabled this returns the recorded history, optionally bounded by
    // from/to/limit. With it disabled there's no series, so it returns a single datapoint built from
    // the cached counts the monitor maintains on the queue table — cheap, and avoids re-running the
    // job-table aggregate on every call. The aggregate runs only when { force: true } is passed or the
    // cache is missing/stale; either way the fresh counts are written back to the cache so later reads
    // stay cheap. Throws if the queue doesn't exist. For the cached counts as a single value, use
    // getQueue(name).
    async getQueueStats(name, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const isCockroach = this.config.backend === 'cockroachdb';
        const toSnapshot = (row)=>{
            const snapshot = {
                name,
                deferredCount: 0,
                queuedCount: 0,
                readyCount: 0,
                activeCount: 0,
                failedCount: 0,
                totalCount: 0,
                capturedOn: row?.capturedOn ?? new Date()
            };
            for (const field of STATS_COUNT_FIELDS){
                const value = row?.[field];
                // CockroachDB returns integer columns as strings; normalize the counts.
                if (value !== undefined && value !== null) snapshot[field] = isCockroach ? Number(value) : value;
            }
            return snapshot;
        };
        if (this.config.persistQueueStats) {
            // Validate the queue exists (consistent with the persistence-off path below); the history
            // query itself would just return an empty series for an unknown name.
            await this.getQueueCache(name);
            const { from = null, to = null, limit = 1000, bucketSeconds, maxDataPoints, aggregate = 'max' } = options;
            (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(Number.isInteger(limit) && limit >= 1 && limit <= 100_000, 'getQueueStats: limit must be an integer between 1 and 100000');
            // Downsample into time buckets when requested. bucketSeconds sets an explicit resolution;
            // maxDataPoints derives the width in-SQL so the series fits in ~N points. Explicit wins.
            if (bucketSeconds !== undefined || maxDataPoints !== undefined) {
                (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(aggregate === 'max' || aggregate === 'min' || aggregate === 'avg', "getQueueStats: aggregate must be 'max', 'min', or 'avg'");
                const mode = bucketSeconds !== undefined ? 'bucket' : 'auto';
                const width = bucketSeconds ?? maxDataPoints;
                (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(Number.isInteger(width) && width >= 1, `getQueueStats: ${mode === 'bucket' ? 'bucketSeconds' : 'maxDataPoints'} must be a positive integer`);
                const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getQueueStatsHistoryBucketed"](this.config.schema, aggregate, mode);
                const { rows } = await this.db.executeSql(sql, [
                    name,
                    from,
                    to,
                    limit,
                    width
                ]);
                return rows.map(toSnapshot);
            }
            const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getQueueStatsHistory"](this.config.schema);
            const { rows } = await this.db.executeSql(sql, [
                name,
                from,
                to,
                limit
            ]);
            return rows.map(toSnapshot);
        }
        // persistQueueStats disabled: serve the cached counts the monitor keeps on the queue table.
        // capturedOn is monitor_on — NULL if never monitored, or old if monitoring has since been turned
        // off. Serve the cache while it's within budget; otherwise recompute and re-cache. { force: true }
        // applies a much tighter budget (a fresh reading), but still reuses a value computed in the last
        // minute so repeated forced calls don't each re-run the aggregate.
        const cacheSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getQueueStatsCache"](this.config.schema);
        const { rows: cacheRows } = await this.db.executeSql(cacheSql, [
            name
        ]);
        const cached = cacheRows.at(0);
        if (!cached) {
            throw new Error(`Queue ${name} does not exist`);
        }
        const maxCacheAgeMs = (options.force ? QUEUE_STATS_FORCE_TTL_SECONDS : Math.max(QUEUE_STATS_CACHE_TTL_SECONDS, this.config.monitorIntervalSeconds ?? 0, this.config.superviseIntervalSeconds ?? 0)) * 1000;
        const cacheAgeMs = cached.capturedOn == null ? Infinity : Date.now() - new Date(cached.capturedOn).getTime();
        if (cacheAgeMs <= maxCacheAgeMs) {
            return [
                toSnapshot(cached)
            ];
        }
        const refreshSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["refreshQueueStats"](this.config.schema, cached.table, name);
        const { rows: refreshed } = await this.db.executeSql(refreshSql);
        return [
            toSnapshot(refreshed.at(0) ?? cached)
        ];
    }
    async getJobById(name, id, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const db = this.assertDb(options);
        const { table } = await this.getQueueCache(name);
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getJobById"](this.config.schema, table);
        const result1 = await db.executeSql(sql, [
            name,
            id
        ]);
        if (result1?.rows?.length === 1) {
            const row = result1.rows[0];
            // CockroachDB returns integer columns as strings; normalize the numeric
            // metadata fields so callers get numbers regardless of the backend.
            if (this.config.backend === 'cockroachdb') {
                for (const field of NUMERIC_METADATA_FIELDS){
                    if (row[field] !== undefined && row[field] !== null) row[field] = Number(row[field]);
                }
            }
            return row;
        } else {
            return null;
        }
    }
    async findJobs(name, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const db = this.assertDb(options);
        const { table } = await this.getQueueCache(name);
        const { id, key, data, queued = false } = options;
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["findJobs"](this.config.schema, table, {
            byId: id !== undefined,
            byKey: key !== undefined,
            byData: data !== undefined,
            queued
        });
        const values = [
            name
        ];
        if (id !== undefined) values.push(id);
        if (key !== undefined) values.push(key);
        if (data !== undefined) values.push(JSON.stringify(data));
        const result = await db.executeSql(sql, values);
        return result?.rows || [];
    }
    async getDependencies(name, id, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const db = this.assertDb(options);
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDependencies"](this.config.schema);
        const { rows } = await db.executeSql(sql, [
            name,
            id
        ]);
        return rows.map((r)=>({
                name: r.parentName,
                id: r.parentId
            }));
    }
    async getDependents(name, id, options = {}) {
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["assertQueueName"](name);
        const db = this.assertDb(options);
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDependents"](this.config.schema);
        const { rows } = await db.executeSql(sql, [
            name,
            id
        ]);
        return rows.map((r)=>({
                name: r.childName,
                id: r.childId
            }));
    }
    assertDb(options) {
        if (options.db) {
            return options.db;
        }
        if (this.db._pgbdb) {
            (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(this.db.opened, 'Database connection is not opened');
        }
        return this.db;
    }
}
const __TURBOPACK__default__export__ = Manager;
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/boss.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:events [external] (node:events, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/plans.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/tools.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$types$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/types.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$warning$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/warning.js [instrumentation] (ecmascript)");
;
;
;
;
;
const events = {
    error: 'error',
    warning: 'warning'
};
// Default thresholds and warning messages
const WARNINGS = {
    SLOW_QUERY: {
        seconds: 30,
        message: 'Warning: slow query. Your queues and/or database server should be reviewed'
    },
    LARGE_QUEUE: {
        size: 10_000,
        message: 'Warning: large queue backlog. Your queue should be reviewed'
    }
};
const WARNING_TYPES = {
    SLOW_QUERY: 'slow_query',
    QUEUE_BACKLOG: 'queue_backlog'
};
class Boss extends __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__["default"] {
    #stopped;
    #stopping;
    #maintaining;
    #superviseInterval;
    #db;
    #config;
    #manager;
    #slowQuerySeconds;
    #largeQueueSize;
    events = events;
    constructor(db, manager, config){
        super();
        this.#db = db;
        this.#config = config;
        this.#manager = manager;
        this.#stopped = true;
        this.#stopping = false;
        this.#slowQuerySeconds = config.warningSlowQuerySeconds || WARNINGS.SLOW_QUERY.seconds;
        this.#largeQueueSize = config.warningQueueSize || WARNINGS.LARGE_QUEUE.size;
    }
    get maintaining() {
        return !!this.#maintaining;
    }
    async start() {
        if (this.#stopped) {
            this.#stopping = false;
            this.#superviseInterval = setInterval(()=>this.#onSupervise(), this.#config.superviseIntervalSeconds * 1000);
            this.#stopped = false;
        }
    }
    async stop() {
        if (!this.#stopped) {
            this.#stopping = true;
            if (this.#superviseInterval) clearInterval(this.#superviseInterval);
            this.#stopped = true;
            while(this.#maintaining){
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["delay"])(10);
            }
        }
    }
    get #warningContext() {
        return {
            emitter: this,
            db: this.#db,
            schema: this.#config.schema,
            persistWarnings: this.#config.persistWarnings,
            warningEvent: events.warning,
            errorEvent: events.error
        };
    }
    async #executeQuery(query) {
        if (typeof query === 'string') {
            query = {
                text: query,
                values: []
            };
        }
        const started = Date.now();
        const result = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["unwrapSQLResult"])(await this.#db.executeSql(query.text, query.values));
        const elapsed = (Date.now() - started) / 1000;
        if (elapsed > this.#slowQuerySeconds || this.#config.__test__warn_slow_query) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$warning$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["emitAndPersistWarning"])(this.#warningContext, WARNING_TYPES.SLOW_QUERY, WARNINGS.SLOW_QUERY.message, {
                elapsed,
                sql: query.text,
                values: query.values
            });
        }
        return result;
    }
    async #onSupervise() {
        try {
            if (this.#stopped) return;
            if (this.#maintaining) return;
            if (this.#config.__test__throw_maint) {
                throw new Error(this.#config.__test__throw_maint);
            }
            this.#maintaining = true;
            if (this.#config.__test__delay_maint_ms) {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["delay"])(this.#config.__test__delay_maint_ms);
            }
            const queues = await this.#manager.getQueues();
            !this.#stopped && await this.supervise(queues);
        } catch (err) {
            this.emit(events.error, err);
        } finally{
            this.#maintaining = false;
        }
    }
    async #maintainWarnings() {
        if (!this.#config.persistWarnings || !this.#config.warningRetentionDays) {
            return;
        }
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["deleteOldWarnings"](this.#config.schema, this.#config.warningRetentionDays);
        await this.#executeQuery(sql);
    }
    async #ensureQueueStatsPartitions() {
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["ensureQueueStatsPartitions"](this.#config.schema);
        await this.#executeQuery(sql);
    }
    async #maintainQueueStats() {
        if (!this.#config.persistQueueStats || !this.#config.queueStatRetentionDays) {
            return;
        }
        const sql = this.#config.noTablePartitioning ? __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["deleteOldQueueStats"](this.#config.schema, this.#config.queueStatRetentionDays) : __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["dropOldQueueStatsPartitions"](this.#config.schema, this.#config.queueStatRetentionDays);
        await this.#executeQuery(sql);
    }
    async supervise(value) {
        let queues;
        if (Array.isArray(value)) {
            queues = value;
        } else {
            queues = await this.#manager.getQueues(value);
        }
        // Ensure today's/tomorrow's partitions exist before any insertQueueStats below. Retention
        // (#maintainWarnings/#maintainQueueStats) runs at the tail. Both live here, in the public
        // supervise() path that also performs the writes, rather than in the timer-only #onSupervise
        // wrapper — so manual supervise() callers (instances run with the built-in supervisor disabled)
        // get partitions provisioned and old data pruned, not just job retention.
        if (this.#config.persistQueueStats && !this.#config.noTablePartitioning && !this.#stopping) {
            await this.#ensureQueueStatsPartitions();
        }
        const queueGroups = queues.reduce((acc, q)=>{
            const { table } = q;
            acc[table] = acc[table] || {
                table,
                queues: []
            };
            acc[table].queues.push(q);
            return acc;
        }, {});
        for (const queueGroup of Object.values(queueGroups)){
            if (this.#stopping) return;
            const { table, queues } = queueGroup;
            const names = queues.map((i)=>i.name);
            while(names.length){
                if (this.#stopping) return;
                const chunk = names.splice(0, 100);
                await this.#monitor(table, chunk);
                await this.#maintain(table, chunk);
            }
        }
        if (this.#stopping) return;
        await this.#maintainWarnings();
        await this.#maintainQueueStats();
    }
    async #monitor(table, names) {
        if (this.#stopping) return;
        const command = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["trySetQueueMonitorTime"](this.#config.schema, names, this.#config.monitorIntervalSeconds);
        const { rows } = await this.#executeQuery(command);
        if (this.#stopping) return;
        if (rows.length) {
            const queues = rows.map((q)=>q.name);
            const cacheStatsSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["cacheQueueStats"](this.#config.schema, table, queues, this.#config.noAdvisoryLocks);
            const { rows: rowsCacheStats } = await this.#executeQuery(cacheStatsSql);
            if (this.#config.persistQueueStats) {
                const insertSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["insertQueueStats"](this.#config.schema, queues, this.#config.noAdvisoryLocks);
                await this.#executeQuery(insertSql);
            }
            if (this.#stopping) return;
            // Coerce with Number(): CockroachDB returns these integer columns as strings, so a bare `>`
            // would compare lexicographically ("100" > "9" === false) and silently miss the backlog. On
            // standard Postgres these are already numbers, so Number() is a no-op.
            const warnings = rowsCacheStats.filter((i)=>Number(i.queuedCount) > (Number(i.warningQueueSize) || this.#largeQueueSize));
            for (const warning of warnings){
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$warning$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["emitAndPersistWarning"])(this.#warningContext, WARNING_TYPES.QUEUE_BACKLOG, WARNINGS.LARGE_QUEUE.message, warning);
            }
            // CockroachDB rejects the multi-mutation failJobs() CTE these use, so under noMultiMutationCte
            // route expiry through the manager's split select/delete/re-insert variants instead.
            if (this.#config.noMultiMutationCte) {
                await this.#manager.failJobsByTimeoutDistributed(table, queues);
            } else {
                const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["failJobsByTimeout"](this.#config.schema, table, queues, this.#config.noAdvisoryLocks);
                await this.#executeQuery(sql);
            }
            if (this.#stopping) return;
            if (this.#config.noMultiMutationCte) {
                await this.#manager.failJobsByHeartbeatDistributed(table, queues);
            } else {
                const heartbeatSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["failJobsByHeartbeat"](this.#config.schema, table, queues, this.#config.noAdvisoryLocks);
                await this.#executeQuery(heartbeatSql);
            }
        }
    }
    async #maintain(table, names) {
        if (this.#stopping) return;
        const command = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["trySetQueueDeletionTime"](this.#config.schema, names, this.#config.maintenanceIntervalSeconds);
        const { rows } = await this.#executeQuery(command);
        if (this.#stopping) return;
        if (rows.length) {
            const queues = rows.map((q)=>q.name);
            const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["deletion"](this.#config.schema, table, queues, this.#config.noAdvisoryLocks);
            await this.#executeQuery(sql);
            const depSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["cleanupDependencies"](this.#config.schema, table, queues, this.#config.noAdvisoryLocks);
            await this.#executeQuery(depSql);
        }
    }
}
const __TURBOPACK__default__export__ = Boss;
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/bam.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:events [external] (node:events, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/plans.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/tools.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$types$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/types.js [instrumentation] (ecmascript)");
;
;
;
;
const events = {
    error: 'error',
    bam: 'bam'
};
class Bam extends __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__["default"] {
    #stopped;
    #working;
    #pollInterval;
    #db;
    #config;
    events = events;
    constructor(db, config){
        super();
        this.#db = db;
        this.#config = config;
        this.#stopped = true;
        this.#working = false;
    }
    get working() {
        return this.#working;
    }
    async start() {
        if (!this.#stopped) return;
        this.#stopped = false;
        setImmediate(()=>this.#onPoll());
        this.#pollInterval = setInterval(()=>this.#onPoll(), this.#config.bamIntervalSeconds * 1000);
    }
    async stop() {
        if (this.#stopped) return;
        this.#stopped = true;
        if (this.#pollInterval) {
            clearInterval(this.#pollInterval);
            this.#pollInterval = undefined;
        }
        while(this.#working){
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["delay"])(10);
        }
    }
    async #onPoll() {
        if (this.#stopped || this.#working || !this.#config.migrate) return;
        this.#working = true;
        try {
            if (this.#config.__test__throw_bam) {
                throw new Error(this.#config.__test__throw_bam);
            }
            if (this.#config.__test__delay_bam_ms) {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["delay"])(this.#config.__test__delay_bam_ms);
            }
            const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["trySetBamTime"](this.#config.schema, this.#config.bamIntervalSeconds);
            const { rows } = await this.#db.executeSql(sql);
            if (rows.length === 1) {
                await this.#processCommands();
            }
        } catch (err) {
            this.emit(events.error, err);
        } finally{
            this.#working = false;
        }
    }
    async #processCommands() {
        if (this.#stopped) return;
        const entry = await this.#getNextCommand();
        if (!entry || this.#stopped) return;
        this.emit(events.bam, {
            id: entry.id,
            name: entry.name,
            status: 'in_progress',
            queue: entry.queue,
            table: entry.table
        });
        try {
            // A re-attempted command (a stale in_progress reclaim, or a retry of a prior 'failed' — including
            // failed rows left by older releases) may have an INVALID index behind it from an interrupted or
            // failed CREATE INDEX CONCURRENTLY. Drop it first (best-effort, IF EXISTS) so the re-run rebuilds
            // cleanly instead of the command's own IF NOT EXISTS skipping over a broken index forever. Only on
            // the liveness path — CockroachDB/YugabyteDB roll interrupted builds back, so there's nothing to
            // heal and DROP ... CONCURRENTLY isn't their model.
            if (entry.reattempt && !this.#config.noIndexProgressView) {
                const dropSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["bamHealDrop"](this.#config.schema, entry.command);
                if (dropSql) {
                    // Only heal an index the previous attempt left INVALID. A re-attempt can also fire for a
                    // build that actually SUCCEEDED but whose row was never marked completed (a graceful stop
                    // landed between the CREATE and markCompleted) — that index is VALID and in use, so dropping
                    // it would tear down a live production index for the whole rebuild window. Probe indisvalid
                    // first; skip the drop for a valid (or absent) index and let the command's IF NOT EXISTS re-run
                    // no-op it and mark the row done.
                    const probeSql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["bamHealProbe"](this.#config.schema, entry.command);
                    const { rows } = await this.#db.executeSql(probeSql);
                    if (rows[0]?.invalid) {
                        await this.#db.executeSql(dropSql);
                    }
                }
            }
            await this.#db.executeSql(entry.command);
            if (this.#stopped) return;
            await this.#markCompleted(entry.id);
            this.emit(events.bam, {
                id: entry.id,
                name: entry.name,
                status: 'completed',
                queue: entry.queue,
                table: entry.table
            });
        } catch (err) {
            if (this.#stopped) return;
            await this.#markFailed(entry.id, err);
            this.emit(events.error, err);
            this.emit(events.bam, {
                id: entry.id,
                name: entry.name,
                status: 'failed',
                queue: entry.queue,
                table: entry.table,
                error: String(err)
            });
        }
    }
    async #getNextCommand() {
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getNextBamCommand"](this.#config.schema, {
            useLiveness: !this.#config.noIndexProgressView
        });
        const { rows } = await this.#db.executeSql(sql);
        return rows[0] || null;
    }
    async #markCompleted(id) {
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["setBamCompleted"](this.#config.schema, id);
        await this.#db.executeSql(sql);
    }
    async #markFailed(id, error) {
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["setBamFailed"](this.#config.schema, id, String(error));
        await this.#db.executeSql(sql);
    }
}
const __TURBOPACK__default__export__ = Bam;
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/navigator.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:events [external] (node:events, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/plans.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/tools.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$types$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/types.js [instrumentation] (ecmascript)");
;
;
;
;
const events = {
    error: 'error',
    flow: 'flow'
};
// Cap audit batches per resolve pass so a large backlog can't monopolize the loop; whatever is
// left over is picked up on the next poll.
const MAX_BATCHES_PER_PASS = 100;
// Background flow resolver. Completion is kept on a join-free hot path (see issue #824); the
// dependency bookkeeping that used to run inline now happens here, out of band. Modeled on the
// Bam poller: on each tick it claims the cluster-wide cadence gate (version.flow_on) and, if it
// wins, audits for completed "blocking" parents via the job_i9 partial index, decrements their
// children, unblocks those reaching zero, and clears the parents' blocking flag so they are not
// reprocessed. The Guild Navigator that keeps the spice flowing.
class Navigator extends __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__["default"] {
    #stopped;
    #stopping;
    #working;
    #pollInterval;
    #db;
    #manager;
    #config;
    events = events;
    constructor(db, manager, config){
        super();
        this.#db = db;
        this.#manager = manager;
        this.#config = config;
        this.#stopped = true;
        this.#stopping = false;
        this.#working = false;
    }
    get working() {
        return this.#working;
    }
    async start() {
        if (!this.#stopped) return;
        this.#stopped = false;
        this.#stopping = false;
        setImmediate(()=>this.#onPoll());
        this.#pollInterval = setInterval(()=>this.#onPoll(), this.#config.flowIntervalSeconds * 1000);
    }
    async stop() {
        if (this.#stopped) return;
        this.#stopping = true;
        this.#stopped = true;
        if (this.#pollInterval) {
            clearInterval(this.#pollInterval);
            this.#pollInterval = undefined;
        }
        while(this.#working){
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["delay"])(10);
        }
    }
    async #onPoll() {
        if (this.#stopped || this.#working) return;
        this.#working = true;
        try {
            if (this.#config.__test__throw_flow) {
                throw new Error(this.#config.__test__throw_flow);
            }
            if (this.#config.__test__delay_flow_ms) {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["delay"])(this.#config.__test__delay_flow_ms);
            }
            const gate = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["trySetFlowTime"](this.#config.schema, this.#config.flowIntervalSeconds);
            const { rows } = await this.#db.executeSql(gate);
            if (rows.length === 1) {
                await this.#resolve();
            }
        } catch (err) {
            this.emit(events.error, err);
        } finally{
            this.#working = false;
        }
    }
    // On-demand, ungated resolution pass. Like boss.supervise(), it is callable whether or not the
    // background poll is running, so tests and apps can resolve flows deterministically. It skips
    // the version-table cadence gate but still serializes against an in-flight poll via #working.
    async resolveNow() {
        while(this.#working){
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["delay"])(10);
        }
        if (this.#stopping) return;
        this.#working = true;
        try {
            await this.#resolve();
        } finally{
            this.#working = false;
        }
    }
    async #resolve() {
        const queues = await this.#manager.getQueues();
        // Group queues by partition table so each audit statement targets a single table and prunes to
        // the chunk's queue names (mirrors boss.supervise()'s grouping).
        const queueGroups = queues.reduce((acc, q)=>{
            acc[q.table] = acc[q.table] || {
                table: q.table,
                names: []
            };
            acc[q.table].names.push(q.name);
            return acc;
        }, {});
        for (const group of Object.values(queueGroups)){
            if (this.#stopping) return;
            const { table } = group;
            const names = [
                ...group.names
            ];
            while(names.length){
                if (this.#stopping) return;
                const chunk = names.splice(0, 100);
                let batches = 0;
                let resolved = 0;
                do {
                    if (this.#stopping) return;
                    resolved = this.#config.noMultiMutationCte ? await this.#manager.resolveFlowJobsDistributed(table, chunk) : await this.#resolveStandard(table, chunk);
                    if (resolved > 0) {
                        this.emit(events.flow, {
                            table,
                            resolved
                        });
                    }
                }while (resolved >= __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["FLOW_BATCH_SIZE"] && ++batches < MAX_BATCHES_PER_PASS && !this.#stopping)
            }
        }
    }
    async #resolveStandard(table, names) {
        const query = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["resolveFlowJobs"](this.#config.schema, table, names);
        const { rows } = await this.#db.executeSql(query.text, query.values);
        // CockroachDB returns integer columns as strings; coerce so the drain-loop comparison is numeric.
        return Number(rows[0]?.resolved ?? 0);
    }
}
const __TURBOPACK__default__export__ = Navigator;
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/notifier.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:events [external] (node:events, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/plans.js [instrumentation] (ecmascript)");
;
;
const events = {
    error: 'error',
    warning: 'warning'
};
const WARNING_TYPE = 'listen_notify_unavailable';
// Owns the LISTEN/NOTIFY listener lifecycle. A NOTIFY is only ever a latency hint: it
// wakes workers so they run their normal locking fetch sooner than the polling interval
// If the listener can't be established (custom adapter, PgBouncer transaction pooling,
// dropped connection), fall back to polling after emitting a warning.
class Notifier extends __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__["default"] {
    events = events;
    #db;
    #manager;
    #config;
    #handle = null;
    #stopped = true;
    constructor(db, manager, config){
        super();
        this.#db = db;
        this.#manager = manager;
        this.#config = config;
    }
    // True only once the listener handle is established. False before start(), when the
    // database doesn't support LISTEN or it fails (warning path), and after stop(). Workers
    // read this to decide between the relaxed notify polling interval and the fallback.
    get available() {
        return this.#handle !== null;
    }
    async start() {
        if (!this.#stopped) return;
        this.#stopped = false;
        // Some backends (e.g. CockroachDB) don't implement LISTEN/NOTIFY at all. Skip the
        // listener there even when useListenNotify was requested; polling still runs.
        if (this.#config.noListenNotify) {
            this.emit(events.warning, {
                message: `useListenNotify is not supported on the ${this.#config.backend} backend. Continuing with polling only.`,
                data: {
                    type: WARNING_TYPE,
                    backend: this.#config.backend
                }
            });
            return;
        }
        if (typeof this.#db.listen !== 'function') {
            this.emit(events.warning, {
                message: 'useListenNotify is enabled but the database connection does not support LISTEN/NOTIFY. Continuing with polling only.',
                data: {
                    type: WARNING_TYPE
                }
            });
            return;
        }
        try {
            // Resolve the channel literal once from the shared SQL expression. LISTEN cannot take
            // an expression, so the listener needs the concrete name; the producer inlines the
            // same expression, so both sides always agree.
            const { rows } = await this.#db.executeSql(`SELECT ${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifyChannelSql"](this.#config.schema)} AS channel`);
            const channel = rows[0].channel;
            this.#handle = await this.#db.listen(channel, (payload)=>this.#manager.notifyQueue(payload), ()=>this.#manager.forceFetchLnWorkers());
        } catch (err) {
            this.emit(events.warning, {
                message: 'Failed to start LISTEN/NOTIFY listener. Continuing with polling only.',
                data: {
                    type: WARNING_TYPE,
                    error: err?.message
                }
            });
        }
    }
    async stop() {
        if (this.#stopped) return;
        this.#stopped = true;
        if (this.#handle) {
            try {
                await this.#handle.close();
            } catch (err) {
                this.emit(events.error, err);
            }
            this.#handle = null;
        }
    }
}
const __TURBOPACK__default__export__ = Notifier;
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/db.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:events [external] (node:events, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__ = __turbopack_context__.i("[externals]/pg [external] (pg, esm_import)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:assert [external] (node:assert, cjs)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__
]);
[__TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
// Keep silent network failures below the default 30-second notify polling backstop: in the
// worst case a failure happens immediately after a successful check, then takes one interval,
// one query timeout, and the existing first reconnect backoff (1s) to restore LISTEN.
const DEFAULT_LISTEN_HEARTBEAT_INTERVAL_MS = 10000;
const DEFAULT_LISTEN_HEARTBEAT_TIMEOUT_MS = 5000;
const DEFAULT_LISTEN_KEEP_ALIVE_INITIAL_DELAY_MS = 10000;
class Db extends __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__["default"] {
    pool;
    config;
    /** @internal */ _pgbdb;
    opened;
    constructor(config){
        super();
        config.application_name = config.application_name || 'pgboss';
        config.connectionTimeoutMillis ??= 10000;
        // config.maxUses = config.maxUses || 1000
        this.config = config;
        this._pgbdb = true;
        this.opened = false;
    }
    events = {
        error: 'error'
    };
    async open() {
        this.pool = new __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__["default"].Pool(this.config);
        this.pool.on('error', (error)=>this.emit('error', error));
        this.opened = true;
    }
    async close() {
        if (!this.pool.ending) {
            this.opened = false;
            await this.pool.end();
        }
    }
    async executeSql(text, values) {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(this.opened, 'Database not opened. Call open() before executing SQL.');
        // if (this.config.debug === true) {
        //   console.log(`${new Date().toISOString()}: DEBUG SQL`)
        //   console.log(text)
        //   if (values) {
        //     console.log(`${new Date().toISOString()}: DEBUG VALUES`)
        //     console.log(values)
        //   }
        // }
        return await this.pool.query(text, values);
    }
    // Opens a dedicated, session-pinned connection for LISTEN/NOTIFY. A separate pg.Client
    // (not a pooled connection) is used so the listener never depletes the query pool and so
    // reconnection is self-contained. TCP keepalive plus a same-session heartbeat detect silent
    // drops and lost subscriptions. The client reconnects with capped backoff, re-runs LISTEN,
    // then calls onReconnect so the caller can recover missed messages.
    async listen(channel, onNotification, onReconnect) {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(this.opened, 'Database not opened. Call open() before listening.');
        let closed = false;
        let client = null;
        let reconnectTimer = null;
        let heartbeatTimer = null;
        let attempt = 0;
        const heartbeatInterval = this.config.notifyHeartbeatIntervalMs ?? DEFAULT_LISTEN_HEARTBEAT_INTERVAL_MS;
        const heartbeatTimeout = this.config.notifyHeartbeatTimeoutMs ?? DEFAULT_LISTEN_HEARTBEAT_TIMEOUT_MS;
        const keepAliveInitialDelay = this.config.notifyKeepAliveInitialDelayMs ?? DEFAULT_LISTEN_KEEP_ALIVE_INITIAL_DELAY_MS;
        // Only self-heal once the listener has been established at least once. If the INITIAL connect
        // fails, the rejection propagates to the caller (Notifier.start), which falls back to
        // polling-only and discards this subscription's close handle — so a reconnect scheduled from
        // the client 'error' handler would be an untracked connection nothing can close, keeping the
        // event loop alive and delivering notifications into a stopped manager.
        let established = false;
        const clearHeartbeat = ()=>{
            if (!heartbeatTimer) return;
            clearTimeout(heartbeatTimer);
            heartbeatTimer = null;
        };
        const scheduleReconnect = ()=>{
            if (closed || reconnectTimer) return;
            const backoff = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
            attempt++;
            reconnectTimer = setTimeout(()=>{
                reconnectTimer = null;
                connect().catch(()=>scheduleReconnect());
            }, backoff);
        };
        const disconnect = (target, error)=>{
            if (closed || client !== target) return;
            clearHeartbeat();
            client = null;
            target.removeAllListeners();
            target.end().catch(()=>{});
            this.emit('error', error);
            if (established) scheduleReconnect();
        };
        const scheduleHeartbeat = (target)=>{
            if (closed || client !== target) return;
            heartbeatTimer = setTimeout(()=>{
                heartbeatTimer = null;
                heartbeat(target).catch((error)=>disconnect(target, error));
            }, heartbeatInterval);
        };
        const heartbeat = async (target)=>{
            if (closed || client !== target) return;
            let timeout = null;
            const query = target.query(`SELECT EXISTS (
           SELECT 1
             FROM pg_listening_channels() AS active(channel)
            WHERE channel = $1
         ) AS listening`, [
                channel
            ]);
            query.catch(()=>{});
            try {
                const result = await Promise.race([
                    query,
                    new Promise((resolve, reject)=>{
                        timeout = setTimeout(()=>reject(new Error('LISTEN/NOTIFY heartbeat timed out')), heartbeatTimeout);
                    })
                ]);
                if (!result.rows[0]?.listening) {
                    throw new Error('LISTEN/NOTIFY channel registration was lost');
                }
            } finally{
                if (timeout) clearTimeout(timeout);
            }
            scheduleHeartbeat(target);
        };
        const connect = async ()=>{
            if (closed) return;
            const next = new __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__["default"].Client({
                ...this.config,
                keepAlive: true,
                keepAliveInitialDelayMillis: keepAliveInitialDelay
            });
            next.on('error', (error)=>{
                disconnect(next, error);
            });
            next.on('end', ()=>disconnect(next, new Error('LISTEN/NOTIFY connection ended')));
            next.on('notification', (msg)=>{
                if (msg.payload !== undefined) onNotification(msg.payload);
            });
            // Track the client before connecting so close() can tear down a connect still in flight
            // (e.g. shutdown during a reconnect). If connect or LISTEN then rejects, the catch ends
            // it and rethrows — without that, a LISTEN that fails after connect() succeeded would
            // leak an open connection. The reconnect .catch below reschedules on failure; an initial
            // failure propagates to the caller.
            client = next;
            try {
                await next.connect();
                await next.query(`LISTEN "${channel}"`);
            } catch (err) {
                next.removeAllListeners();
                await next.end().catch(()=>{});
                if (client === next) client = null;
                throw err;
            }
            attempt = 0;
            established = true;
            scheduleHeartbeat(next);
            onReconnect();
        };
        await connect();
        return {
            close: async ()=>{
                closed = true;
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }
                clearHeartbeat();
                if (client) {
                    client.removeAllListeners();
                    await client.end().catch(()=>{});
                    client = null;
                }
            }
        };
    }
    async withTransaction(fn) {
        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$assert__$5b$external$5d$__$28$node$3a$assert$2c$__cjs$29$__["default"])(this.opened, 'Database not opened. Call open() before executing SQL.');
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const txDb = {
                executeSql: (text, values)=>client.query(text, values)
            };
            const result = await fn(txDb);
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally{
            client.release();
        }
    }
}
const __TURBOPACK__default__export__ = Db;
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/placeholders.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Parses a SQL string with PostgreSQL-style `$N` placeholders into the
 * literal segments between placeholders and the values in textual order.
 *
 * Handles repeated indexes (e.g. `$2` appearing twice) by duplicating the
 * value at each occurrence, so adapters that target positional `?`-style
 * binders or tagged-template SQL builders stay consistent with what
 * postgres would have produced from the original `$N` form.
 */ __turbopack_context__.s([
    "parsePlaceholders",
    ()=>parsePlaceholders
]);
function parsePlaceholders(text, values) {
    const parts = [];
    const reordered = [];
    // Local /g regex: stateful via lastIndex but never shared across calls.
    const re = /\$(\d+)/g;
    let lastIndex = 0;
    let match;
    while((match = re.exec(text)) !== null){
        parts.push(text.slice(lastIndex, match.index));
        reordered.push(values?.[Number(match[1]) - 1]);
        lastIndex = re.lastIndex;
    }
    parts.push(text.slice(lastIndex));
    return {
        parts,
        reordered
    };
}
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/knex.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fromKnex",
    ()=>fromKnex
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$adapters$2f$placeholders$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/placeholders.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/tools.js [instrumentation] (ecmascript)");
;
;
function fromKnex(trx) {
    return {
        async executeSql (text, values) {
            // pg-boss emits $1, $2, … placeholders; knex.raw() expects ? per binding,
            // so each textual occurrence (including reuse of the same $N) must be
            // mapped to its own ? with the value duplicated in textual order.
            const { parts, reordered } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$adapters$2f$placeholders$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["parsePlaceholders"])(text, values);
            // Several pg-boss queries (e.g. updateJob) also contain literal jsonb `?` key-exists
            // operators. knex.raw() scans the whole string for `?` to fill bindings, so those
            // literal occurrences must be escaped as `\?` (knex's own literal-? syntax) before
            // joining in the real placeholders — otherwise knex miscounts bindings and throws
            // "Undefined binding(s) detected" on any query that mixes both.
            const knexSql = parts.map((part)=>part.replace(/\?/g, '\\?')).join('?');
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["unwrapSQLResult"])(await trx.raw(knexSql, reordered));
        }
    };
}
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/kysely.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fromKysely",
    ()=>fromKysely
]);
function fromKysely(trx) {
    return {
        async executeSql (text, values) {
            const result = await trx.executeQuery({
                sql: text,
                parameters: values ?? [],
                query: {
                    kind: 'RawNode'
                },
                queryId: {
                    queryId: 'pgboss'
                }
            });
            return {
                rows: [
                    ...result.rows
                ]
            };
        }
    };
}
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/drizzle.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fromDrizzle",
    ()=>fromDrizzle
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$adapters$2f$placeholders$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/placeholders.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/tools.js [instrumentation] (ecmascript)");
;
;
function fromDrizzle(tx, sql) {
    return {
        async executeSql (text, values) {
            const { parts, reordered } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$adapters$2f$placeholders$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["parsePlaceholders"])(text, values);
            const strings = Object.assign([
                ...parts
            ], {
                raw: [
                    ...parts
                ]
            });
            // Bind each value through sql.param so drizzle emits exactly one placeholder
            // per value. A bare array would otherwise be expanded into a parameter list
            // ($2, $3, ...) instead of a single array-typed parameter, breaking any query
            // with `= ANY($N::uuid[])` (deleteJob/complete/fail/cancel/resume/retry).
            const params = reordered.map((value)=>sql.param(value));
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["unwrapSQLResult"])(await tx.execute(sql(strings, ...params)));
        }
    };
}
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/prisma.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fromPrisma",
    ()=>fromPrisma
]);
function fromPrisma(tx) {
    return {
        async executeSql (text, values) {
            const rows = await tx.$queryRawUnsafe(text, ...values ?? []);
            // v8 ignore next
            return {
                rows: Array.isArray(rows) ? rows : []
            };
        }
    };
}
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/pglite.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Adapts a PGlite instance (embedded single-connection WASM PostgreSQL) to pg-boss's IDatabase.
// PGlite is full PostgreSQL, so it needs none of the distributed compatibility flags — pair it
// with `backend: 'pglite'`. The user owns the PGlite instance lifecycle (construction and close).
//
// PGlite uses native `$1` placeholders, so no placeholder translation is needed. The one wrinkle is
// that `query()` runs a single statement only, while pg-boss issues concatenated multi-statement DDL
// (migrations/schema creation) with no parameters — those must go through `exec()`, which mirrors the
// simple-vs-extended protocol split that the default `pg.Pool`-backed driver relies on.
__turbopack_context__.s([
    "fromPglite",
    ()=>fromPglite
]);
function fromPglite(pglite) {
    // pg-boss issues each statement expecting connection-pool semantics: an error on one statement
    // must not affect the next. PGlite has a single connection, so a failed statement inside a
    // BEGIN...COMMIT block (e.g. a migration that rolls back) leaves the connection in an aborted
    // transaction that poisons every later query. A pooled driver sidesteps this by handing out a
    // fresh connection; we emulate it by rolling back any aborted transaction before rethrowing.
    const run = async (text, values)=>{
        if (values?.length) {
            return await pglite.query(text, values);
        }
        // No parameters: may be a multi-statement block (e.g. a `locked()` BEGIN ... RETURNING ...
        // COMMIT). exec() returns one result per statement; flatten their rows so a RETURNING in the
        // middle isn't lost behind a trailing COMMIT. This mirrors how pg-boss unwraps the array that
        // node-postgres returns for multi-statement queries (see unwrapSQLResult).
        const results = await pglite.exec(text);
        return {
            rows: results.flatMap((r)=>r.rows ?? [])
        };
    };
    const db = {
        async executeSql (text, values) {
            try {
                return await run(text, values);
            } catch (err) {
                await pglite.query('ROLLBACK').catch(()=>{});
                throw err;
            }
        }
    };
    // PGlite is embedded single-connection PostgreSQL, so LISTEN/NOTIFY works entirely in-process:
    // the same instance both NOTIFYs (via pg-boss's inlined pg_notify) and delivers to listeners.
    // Only expose `listen` when the instance actually supports it (older builds/mocks may not), so
    // the notifier cleanly falls back to polling otherwise. There is no network connection to drop,
    // hence no reconnect loop — onReconnect is invoked once after the initial subscribe to mirror
    // the pooled driver and force a gap-recovery fetch.
    if (typeof pglite.listen === 'function') {
        db.listen = async (channel, onNotification, onReconnect)=>{
            const unsubscribe = await pglite.listen(channel, onNotification);
            onReconnect();
            return {
                close: async ()=>{
                    await unsubscribe();
                }
            };
        };
    }
    return db;
}
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/index.js [instrumentation] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$adapters$2f$knex$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/knex.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$adapters$2f$kysely$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/kysely.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$adapters$2f$drizzle$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/drizzle.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$adapters$2f$prisma$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/prisma.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$adapters$2f$pglite$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/pglite.js [instrumentation] (ecmascript)");
;
;
;
;
;
}),
"[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/index.js [instrumentation] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "PgBoss",
    ()=>PgBoss,
    "events",
    ()=>events,
    "getConstructionPlans",
    ()=>getConstructionPlans,
    "getMigrationPlans",
    ()=>getMigrationPlans,
    "getRollbackPlans",
    ()=>getRollbackPlans
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:events [external] (node:events, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/attorney.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$contractor$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/contractor.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$manager$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/manager.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$timekeeper$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/timekeeper.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$boss$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/boss.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$bam$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/bam.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$navigator$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/navigator.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$notifier$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/notifier.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/tools.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/plans.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$db$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/db.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$adapters$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/pg-boss/dist/adapters/index.js [instrumentation] (ecmascript) <locals>");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$db$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$db$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
const events = Object.freeze({
    error: 'error',
    warning: 'warning',
    wip: 'wip',
    stopped: 'stopped',
    bam: 'bam',
    flow: 'flow'
});
function getConstructionPlans(schema) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$contractor$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["default"].constructionPlans(schema);
}
function getMigrationPlans(schema, version, options) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$contractor$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["default"].migrationPlans(schema, version, options);
}
function getRollbackPlans(schema, version) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$contractor$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["default"].rollbackPlans(schema, version);
}
class PgBoss extends __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$events__$5b$external$5d$__$28$node$3a$events$2c$__cjs$29$__["default"] {
    #stoppingOn;
    #stopped;
    #started;
    #startingPromise = null;
    #stoppingPromise = null;
    #config;
    #db;
    #boss;
    #contractor;
    #manager;
    #timekeeper;
    #bam;
    #navigator;
    #notifier;
    constructor(value){
        super();
        this.#stoppingOn = null;
        this.#stopped = true;
        const config = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$attorney$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getConfig"](value);
        this.#config = config;
        const db = this.getDb();
        this.#db = db;
        if ('_pgbdb' in this.#db && this.#db._pgbdb) {
            this.#promoteEvents(this.#db);
        }
        const contractor = new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$contractor$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["default"](db, config);
        const manager = new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$manager$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["default"](db, config);
        const boss = new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$boss$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["default"](db, manager, config);
        const timekeeper = new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$timekeeper$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["default"](db, manager, config);
        manager.timekeeper = timekeeper;
        const bam = new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$bam$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["default"](db, config);
        const navigator = new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$navigator$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["default"](db, manager, config);
        const notifier = new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$notifier$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["default"](db, manager, config);
        manager.notifier = notifier;
        this.#promoteEvents(manager);
        this.#promoteEvents(boss);
        this.#promoteEvents(timekeeper);
        this.#promoteEvents(bam);
        this.#promoteEvents(navigator);
        this.#promoteEvents(notifier);
        this.#boss = boss;
        this.#contractor = contractor;
        this.#manager = manager;
        this.#timekeeper = timekeeper;
        this.#bam = bam;
        this.#navigator = navigator;
        this.#notifier = notifier;
    }
    #promoteEvents(emitter) {
        for (const event of Object.values(emitter?.events)){
            emitter.on(event, (arg)=>this.emit(event, arg));
        }
    }
    async start() {
        // A stop() already in flight must finish (clearing any resources it's tearing down) before a
        // fresh start() begins, otherwise the two race over the same intervals/pool.
        if (this.#stoppingPromise) {
            await this.#stoppingPromise.catch(()=>{});
        }
        // Return the SAME in-flight promise to a concurrent caller instead of a fresh `this` — a
        // second caller must observe the actual outcome (including a rejection), not silently no-op
        // while the first call is still mid-flight.
        if (this.#startingPromise) {
            return this.#startingPromise;
        }
        if (this.#started) {
            return this;
        }
        // Cleared to false before any subsystem is started (not just on success): if #doStart throws
        // partway through, subsystems already started (e.g. manager's queueCacheInterval/wipInterval)
        // must still be reachable by stop() for cleanup, and stop() no-ops whenever #stopped is true.
        this.#stopped = false;
        this.#startingPromise = this.#doStart();
        try {
            return await this.#startingPromise;
        } finally{
            this.#startingPromise = null;
        }
    }
    async #doStart() {
        if (this.#db._pgbdb && !this.#db.opened) {
            await this.#db.open();
        }
        await this.#warnIfDistributedMisconfigured();
        if (this.#config.migrate) {
            await this.#contractor.start();
        } else {
            await this.#contractor.check();
        }
        await this.#manager.start();
        if (this.#config.useListenNotify) {
            await this.#notifier.start();
        }
        if (this.#config.supervise) {
            await this.#boss.start();
            await this.#navigator.start();
        }
        if (this.#config.schedule) {
            await this.#timekeeper.start();
        }
        if (this.#config.migrate) {
            await this.#bam.start();
        }
        this.#started = true;
        return this;
    }
    // YugabyteDB needs the yugabytedb backend profile (no table partitioning + no advisory locks;
    // partitioned queues are not supported there). pg-boss can't know the backend at construction
    // time, so detect it from the server version at startup and warn when the profile isn't selected.
    // Best-effort: never block startup on this check.
    async #warnIfDistributedMisconfigured() {
        try {
            const { rows } = await this.#db.executeSql('SELECT version()');
            const version = rows?.[0]?.version || '';
            if (/yugabyte|-yb-/i.test(version)) {
                if (!this.#config.noTablePartitioning || !this.#config.noAdvisoryLocks) {
                    this.emit(events.warning, {
                        message: "YugabyteDB detected: set backend: 'yugabytedb' for compatibility. Partitioned queues (partition: true) are not supported on YugabyteDB.",
                        data: {
                            backend: 'yugabytedb'
                        }
                    });
                }
            }
        } catch  {
        // version detection is best-effort and must never prevent startup
        }
    }
    async stop(options = {}) {
        // A start() already in flight must finish (or fail) before stop() evaluates state, otherwise
        // stop() reads #stopped mid-start and silently no-ops while start() keeps running.
        if (this.#startingPromise) {
            await this.#startingPromise.catch(()=>{});
        }
        if (this.#stoppingPromise) {
            return this.#stoppingPromise;
        }
        if (this.#stopped) {
            return;
        }
        let { close = true, graceful = true, timeout = 30000 } = options;
        timeout = Math.max(timeout, 1000);
        this.#stoppingOn = Date.now();
        this.#stoppingPromise = this.#doStop(close, graceful, timeout);
        try {
            return await this.#stoppingPromise;
        } finally{
            this.#stoppingPromise = null;
        }
    }
    async #doStop(close, graceful, timeout) {
        try {
            await this.#notifier.stop();
            await this.#manager.stop();
            await this.#timekeeper.stop();
            await this.#boss.stop();
            await this.#navigator.stop();
            await this.#bam.stop();
            const shutdown = async ()=>{
                await this.#manager.failWip();
                if (this.#db._pgbdb && this.#db.opened && close) {
                    await this.#db.close();
                    // Give event loop time to process socket closes
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["delay"])(10);
                }
                this.#stopped = true;
                this.#started = false;
                this.emit(events.stopped);
            };
            if (!graceful) {
                await shutdown();
                return;
            }
            while(Date.now() - this.#stoppingOn < timeout && this.#manager.hasPendingCleanups()){
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$tools$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["delay"])(500);
            }
            await shutdown();
        } finally{
            // Reset unconditionally (success or throw) so a stop() that fails partway can be retried
            // instead of every future stop()/start() call silently no-op-ing forever on the stale marker.
            this.#stoppingOn = null;
        }
    }
    async send(...args) {
        return await this.#manager.send(...args);
    }
    async sendAfter(name, data, options, after) {
        return this.#manager.sendAfter(name, data, options, after);
    }
    sendThrottled(name, data, options, seconds, key) {
        return this.#manager.sendThrottled(name, data, options, seconds, key);
    }
    update(...args) {
        return this.#manager.update(...args);
    }
    upsert(...args) {
        return this.#manager.upsert(...args);
    }
    sendDebounced(name, data, options, seconds, key) {
        return this.#manager.sendDebounced(name, data, options, seconds, key);
    }
    insert(name, jobs, options) {
        return this.#manager.insert(name, jobs, options);
    }
    flow(jobs, options) {
        return this.#manager.flow(jobs, options);
    }
    fetch(name, options = {}) {
        return this.#manager.fetch(name, options);
    }
    work(...args) {
        return this.#manager.work(...args);
    }
    offWork(name, options) {
        return this.#manager.offWork(name, options);
    }
    notifyWorker(workerId) {
        return this.#manager.notifyWorker(workerId);
    }
    subscribe(event, name) {
        return this.#manager.subscribe(event, name);
    }
    unsubscribe(event, name) {
        return this.#manager.unsubscribe(event, name);
    }
    publish(event, data, options) {
        return this.#manager.publish(event, data, options);
    }
    cancel(name, id, options) {
        return this.#manager.cancel(name, id, options);
    }
    resume(name, id, options) {
        return this.#manager.resume(name, id, options);
    }
    retry(name, id, options) {
        return this.#manager.retry(name, id, options);
    }
    deleteJob(name, id, options) {
        return this.#manager.deleteJob(name, id, options);
    }
    redrive(name, options) {
        return this.#manager.redrive(name, options);
    }
    deleteQueuedJobs(name) {
        return this.#manager.deleteQueuedJobs(name);
    }
    deleteStoredJobs(name) {
        return this.#manager.deleteStoredJobs(name);
    }
    deleteAllJobs(name) {
        return this.#manager.deleteAllJobs(name);
    }
    complete(name, id, data, options) {
        return this.#manager.complete(name, id, data, options);
    }
    fail(name, id, data, options) {
        return this.#manager.fail(name, id, data, options);
    }
    touch(name, id, options) {
        return this.#manager.touch(name, id, options);
    }
    /**
     * @deprecated Use findJobs() instead
     */ getJobById(name, id, options) {
        return this.#manager.getJobById(name, id, options);
    }
    findJobs(name, options) {
        return this.#manager.findJobs(name, options);
    }
    createQueue(name, options) {
        return this.#manager.createQueue(name, options);
    }
    getBlockedKeys(name) {
        return this.#manager.getBlockedKeys(name);
    }
    getDependencies(name, id, options) {
        return this.#manager.getDependencies(name, id, options);
    }
    getDependents(name, id, options) {
        return this.#manager.getDependents(name, id, options);
    }
    updateQueue(name, options) {
        return this.#manager.updateQueue(name, options);
    }
    deleteQueue(name) {
        return this.#manager.deleteQueue(name);
    }
    getQueues(names) {
        return this.#manager.getQueues(names);
    }
    getQueue(name) {
        return this.#manager.getQueue(name);
    }
    getQueueStats(name, options) {
        return this.#manager.getQueueStats(name, options);
    }
    isMaintaining() {
        return this.#boss.maintaining;
    }
    isBamWorking() {
        return this.#bam.working;
    }
    isResolvingFlow() {
        return this.#navigator.working;
    }
    isCheckingSkew() {
        return this.#timekeeper.checkingSkew;
    }
    supervise(name) {
        return this.#boss.supervise(name);
    }
    // Force an immediate flow-resolution pass (unblock dependents of completed jobs) instead of
    // waiting for the next background poll. Mirrors supervise() for on-demand maintenance.
    resolveFlow() {
        return this.#navigator.resolveNow();
    }
    getWipData(options) {
        return this.#manager.getWipData(options);
    }
    getSpy(name) {
        return this.#manager.getSpy(name);
    }
    clearSpies() {
        this.#manager.clearSpies();
    }
    isInstalled() {
        return this.#contractor.isInstalled();
    }
    schemaVersion() {
        return this.#contractor.schemaVersion();
    }
    detectSchemaDrift() {
        return this.#contractor.detectDrift();
    }
    schedule(name, cron, data, options) {
        return this.#timekeeper.schedule(name, cron, data, options);
    }
    unschedule(name, key) {
        return this.#timekeeper.unschedule(name, key);
    }
    getSchedules(name, key) {
        return this.#timekeeper.getSchedules(name, key);
    }
    async getBamStatus() {
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getBamStatus"](this.#config.schema);
        const { rows } = await this.#db.executeSql(sql);
        return rows;
    }
    async getBamEntries() {
        const sql = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$plans$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["getBamEntries"](this.#config.schema);
        const { rows } = await this.#db.executeSql(sql);
        return rows;
    }
    getDb() {
        if (this.#db) {
            return this.#db;
        }
        if (this.#config.db) {
            return this.#config.db;
        }
        return new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$pg$2d$boss$2f$dist$2f$db$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["default"](this.#config);
    }
}
;
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=55592_pg-boss_99d31fd1._.js.map