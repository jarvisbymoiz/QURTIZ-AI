module.exports = [
"[externals]/pg [external] (pg, esm_import)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

const mod = await __turbopack_context__.y("pg");

__turbopack_context__.n(mod);
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, true);}),
"[project]/Documents/QURTIZ AI/src/db/schema.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "agentRunStatusEnum",
    ()=>agentRunStatusEnum,
    "agentRuns",
    ()=>agentRuns,
    "agentSteps",
    ()=>agentSteps,
    "aiInsights",
    ()=>aiInsights,
    "brandAssetKindEnum",
    ()=>brandAssetKindEnum,
    "brandAssets",
    ()=>brandAssets,
    "brandMemory",
    ()=>brandMemory,
    "brandMemoryTypeEnum",
    ()=>brandMemoryTypeEnum,
    "brands",
    ()=>brands,
    "campaignItems",
    ()=>campaignItems,
    "campaignStatusEnum",
    ()=>campaignStatusEnum,
    "campaigns",
    ()=>campaigns,
    "chatMessages",
    ()=>chatMessages,
    "chatThreads",
    ()=>chatThreads,
    "competitorSnapshots",
    ()=>competitorSnapshots,
    "competitors",
    ()=>competitors,
    "contentFormatEnum",
    ()=>contentFormatEnum,
    "contentItems",
    ()=>contentItems,
    "contentPillars",
    ()=>contentPillars,
    "contentStatusEnum",
    ()=>contentStatusEnum,
    "contentVariantStatusEnum",
    ()=>contentVariantStatusEnum,
    "contentVariants",
    ()=>contentVariants,
    "jobStatusEnum",
    ()=>jobStatusEnum,
    "jobs",
    ()=>jobs,
    "notificationKindEnum",
    ()=>notificationKindEnum,
    "notifications",
    ()=>notifications,
    "platformConnectionStatusEnum",
    ()=>platformConnectionStatusEnum,
    "platformConnections",
    ()=>platformConnections,
    "platformEnum",
    ()=>platformEnum,
    "postMetrics",
    ()=>postMetrics,
    "publishingJobStatusEnum",
    ()=>publishingJobStatusEnum,
    "publishingJobs",
    ()=>publishingJobs,
    "researchItems",
    ()=>researchItems,
    "settings",
    ()=>settings,
    "visualAssets",
    ()=>visualAssets,
    "workspaceMembers",
    ()=>workspaceMembers,
    "workspaceRoleEnum",
    ()=>workspaceRoleEnum,
    "workspaces",
    ()=>workspaces
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$boolean$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/pg-core/columns/boolean.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/pg-core/indexes.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/pg-core/columns/integer.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/pg-core/columns/jsonb.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$numeric$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/pg-core/columns/numeric.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$enum$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/pg-core/columns/enum.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/pg-core/table.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$primary$2d$keys$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/pg-core/primary-keys.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$real$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/pg-core/columns/real.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/pg-core/columns/text.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/pg-core/columns/timestamp.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/pg-core/columns/uuid.js [instrumentation] (ecmascript)");
;
const workspaceRoleEnum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$enum$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgEnum"])("workspace_role", [
    "owner",
    "admin",
    "editor",
    "viewer"
]);
const contentStatusEnum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$enum$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgEnum"])("content_status", [
    "draft",
    "generating",
    "ready_for_review",
    "approved",
    "scheduled",
    "published",
    "failed",
    "archived"
]);
const brandMemoryTypeEnum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$enum$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgEnum"])("brand_memory_type", [
    "preference",
    "fact",
    "rule"
]);
const agentRunStatusEnum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$enum$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgEnum"])("agent_run_status", [
    "running",
    "completed",
    "failed",
    "cancelled"
]);
const platformEnum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$enum$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgEnum"])("platform", [
    "facebook",
    "instagram"
]);
const platformConnectionStatusEnum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$enum$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgEnum"])("platform_connection_status", [
    "not_connected",
    "connected",
    "expired",
    "error"
]);
const contentFormatEnum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$enum$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgEnum"])("content_format", [
    "single_image",
    "carousel",
    "reel",
    "story",
    "text_post"
]);
const contentVariantStatusEnum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$enum$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgEnum"])("content_variant_status", [
    "generating",
    "ready_for_review",
    "approved",
    "scheduled",
    "published",
    "failed",
    "archived"
]);
const workspaces = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("workspaces", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    name: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("name").notNull(),
    slug: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("slug").notNull(),
    timezone: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("timezone").notNull().default("Asia/Karachi"),
    createdBy: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("created_by").notNull(),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    deletedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("deleted_at", {
        withTimezone: true
    })
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uniqueIndex"])("workspaces_slug_uq").on(t.slug)
    ]);
const workspaceMembers = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("workspace_members", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    userId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("user_id").notNull(),
    role: workspaceRoleEnum("role").notNull().default("owner"),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uniqueIndex"])("workspace_members_ws_user_uq").on(t.workspaceId, t.userId),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("workspace_members_user_idx").on(t.userId)
    ]);
const settings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("settings", {
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    key: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("key").notNull(),
    value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("value").notNull().default({}),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$primary$2d$keys$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["primaryKey"])({
            columns: [
                t.workspaceId,
                t.key
            ]
        })
    ]);
const brands = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("brands", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    businessName: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("business_name"),
    description: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("description"),
    industry: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("industry"),
    products: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("products"),
    services: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("services"),
    pricing: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("pricing"),
    offers: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("offers"),
    locations: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("locations"),
    website: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("website"),
    contact: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("contact"),
    cta: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("cta"),
    targetMarket: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("target_market"),
    audience: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("audience").notNull().default({}),
    voicePresets: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("voice_presets").array().notNull().default([]),
    voiceCustom: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("voice_custom"),
    visualIdentity: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("visual_identity").notNull().default({}),
    contentRules: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("content_rules").notNull().default({}),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    deletedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("deleted_at", {
        withTimezone: true
    })
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uniqueIndex"])("brands_workspace_uq").on(t.workspaceId)
    ]);
const brandMemory = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("brand_memory", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    type: brandMemoryTypeEnum("type").notNull(),
    content: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("content").notNull(),
    source: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("source").notNull().default("chat"),
    confidence: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$real$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["real"])("confidence").notNull().default(1),
    active: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$boolean$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["boolean"])("active").notNull().default(true),
    createdBy: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("created_by").notNull(),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    deletedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("deleted_at", {
        withTimezone: true
    })
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("brand_memory_ws_idx").on(t.workspaceId, t.createdAt)
    ]);
const platformConnections = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("platform_connections", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    platform: platformEnum("platform").notNull(),
    status: platformConnectionStatusEnum("status").notNull().default("not_connected"),
    meta: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("meta").notNull().default({}),
    encryptedToken: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("encrypted_token"),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uniqueIndex"])("platform_connections_ws_platform_uq").on(t.workspaceId, t.platform)
    ]);
const chatThreads = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("chat_threads", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    userId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("user_id").notNull(),
    title: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("title").notNull().default("New chat"),
    pinned: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$boolean$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["boolean"])("pinned").notNull().default(false),
    archived: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$boolean$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["boolean"])("archived").notNull().default(false),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    deletedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("deleted_at", {
        withTimezone: true
    })
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("chat_threads_ws_idx").on(t.workspaceId, t.updatedAt)
    ]);
const chatMessages = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("chat_messages", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    threadId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("thread_id").notNull().references(()=>chatThreads.id, {
        onDelete: "cascade"
    }),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    role: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("role").notNull(),
    content: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("content").notNull().default(""),
    message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("message").notNull().default({}),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("chat_messages_thread_idx").on(t.threadId, t.createdAt)
    ]);
const agentRuns = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("agent_runs", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    userId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("user_id").notNull(),
    kind: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("kind").notNull().default("chat"),
    status: agentRunStatusEnum("status").notNull().default("running"),
    model: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("model"),
    inputTokens: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("input_tokens"),
    outputTokens: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("output_tokens"),
    costUsd: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$numeric$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["numeric"])("cost_usd", {
        precision: 12,
        scale: 6
    }),
    error: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("error"),
    startedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("started_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    finishedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("finished_at", {
        withTimezone: true
    })
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("agent_runs_ws_idx").on(t.workspaceId, t.startedAt)
    ]);
const agentSteps = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("agent_steps", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    runId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("run_id").notNull().references(()=>agentRuns.id, {
        onDelete: "cascade"
    }),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    idx: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("idx").notNull(),
    toolName: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("tool_name"),
    input: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("input").notNull().default({}),
    output: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("output").notNull().default({}),
    durationMs: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("duration_ms"),
    status: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("status").notNull().default("completed"),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("agent_steps_run_idx").on(t.runId, t.idx)
    ]);
const contentPillars = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("content_pillars", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    name: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("name").notNull(),
    description: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("description"),
    targetShare: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("target_share").notNull().default(20),
    active: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$boolean$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["boolean"])("active").notNull().default(true),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("content_pillars_ws_idx").on(t.workspaceId, t.active)
    ]);
const researchItems = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("research_items", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    topic: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("topic").notNull(),
    summary: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("summary").notNull().default(""),
    sourceUrl: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("source_url"),
    sourceName: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("source_name"),
    category: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("category"),
    scores: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("scores").notNull().default({}),
    recommendedFormats: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("recommended_formats").array().notNull().default([]),
    status: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("status").notNull().default("new"),
    createdBy: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("created_by"),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("research_items_ws_idx").on(t.workspaceId, t.createdAt)
    ]);
const contentItems = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("content_items", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    topic: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("topic").notNull(),
    objective: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("objective"),
    pillarId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("pillar_id").references(()=>contentPillars.id, {
        onDelete: "set null"
    }),
    format: contentFormatEnum("format").notNull().default("single_image"),
    hook: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("hook"),
    mainCopy: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("main_copy"),
    caption: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("caption"),
    cta: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("cta"),
    hashtags: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("hashtags").array().notNull().default([]),
    keywords: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("keywords").array().notNull().default([]),
    visualConcept: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("visual_concept"),
    aiScores: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("ai_scores").notNull().default({}),
    qa: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("qa").notNull().default({}),
    scheduledAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("scheduled_at", {
        withTimezone: true
    }),
    publishedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("published_at", {
        withTimezone: true
    }),
    researchItemId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("research_item_id"),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdBy: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("created_by").notNull(),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    deletedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("deleted_at", {
        withTimezone: true
    })
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("content_items_ws_status_idx").on(t.workspaceId, t.status)
    ]);
const contentVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("content_variants", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    contentItemId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("content_item_id").notNull().references(()=>contentItems.id, {
        onDelete: "cascade"
    }),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    platform: platformEnum("platform").notNull(),
    format: contentFormatEnum("format").notNull(),
    caption: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("caption").notNull().default(""),
    script: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("script").notNull().default({}),
    hashtags: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("hashtags").array().notNull().default([]),
    cta: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("cta"),
    status: contentVariantStatusEnum("status").notNull().default("generating"),
    qa: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("qa").notNull().default({}),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("content_variants_item_idx").on(t.contentItemId, t.platform)
    ]);
const brandAssetKindEnum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$enum$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgEnum"])("brand_asset_kind", [
    "logo",
    "avatar",
    "reference"
]);
const brandAssets = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("brand_assets", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    kind: brandAssetKindEnum("kind").notNull(),
    label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("label"),
    storagePath: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("storage_path").notNull(),
    mimeType: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("mime_type").notNull(),
    sizeBytes: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("size_bytes").notNull().default(0),
    createdBy: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("created_by").notNull(),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("brand_assets_ws_idx").on(t.workspaceId, t.kind)
    ]);
const visualAssets = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("visual_assets", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    contentItemId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("content_item_id").notNull().references(()=>contentItems.id, {
        onDelete: "cascade"
    }),
    kind: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("kind").notNull().default("template"),
    storagePath: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("storage_path").notNull(),
    mimeType: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("mime_type").notNull().default("image/png"),
    width: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("width"),
    height: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("height"),
    meta: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("meta").notNull().default({}),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("visual_assets_item_idx").on(t.contentItemId, t.createdAt)
    ]);
const jobStatusEnum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$enum$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgEnum"])("job_status", [
    "queued",
    "running",
    "completed",
    "failed",
    "cancelled"
]);
const jobs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("jobs", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    userId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("user_id").notNull(),
    type: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("type").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    progress: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("progress").notNull().default(0),
    total: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("total").notNull().default(0),
    input: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("input").notNull().default({}),
    result: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("result").notNull().default({}),
    error: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("error"),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("jobs_ws_idx").on(t.workspaceId, t.createdAt)
    ]);
const publishingJobStatusEnum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$enum$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgEnum"])("publishing_job_status", [
    "pending",
    "processing",
    "published",
    "failed",
    "cancelled"
]);
const publishingJobs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("publishing_jobs", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    contentItemId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("content_item_id").notNull().references(()=>contentItems.id, {
        onDelete: "cascade"
    }),
    contentVariantId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("content_variant_id").notNull().references(()=>contentVariants.id, {
        onDelete: "cascade"
    }),
    platform: platformEnum("platform").notNull(),
    scheduledAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("scheduled_at", {
        withTimezone: true
    }).notNull(),
    status: publishingJobStatusEnum("status").notNull().default("pending"),
    attempts: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("attempts").notNull().default(0),
    lastError: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("last_error"),
    result: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("result").notNull().default({}),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("publishing_jobs_due_idx").on(t.status, t.scheduledAt)
    ]);
const notificationKindEnum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$enum$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgEnum"])("notification_kind", [
    "content_ready",
    "generation_completed",
    "publishing_completed",
    "publishing_failed",
    "auth_expired",
    "job_completed",
    "system"
]);
const notifications = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("notifications", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    userId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("user_id").notNull(),
    kind: notificationKindEnum("kind").notNull().default("system"),
    title: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("title").notNull(),
    body: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("body"),
    link: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("link"),
    read: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$boolean$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["boolean"])("read").notNull().default(false),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("notifications_ws_idx").on(t.workspaceId, t.createdAt)
    ]);
const campaignStatusEnum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$enum$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgEnum"])("campaign_status", [
    "planning",
    "generating",
    "active",
    "completed",
    "cancelled"
]);
const campaigns = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("campaigns", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    name: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("name").notNull(),
    goal: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("goal"),
    offer: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("offer"),
    audience: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("audience"),
    durationDays: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("duration_days").notNull().default(7),
    platforms: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("platforms").array().notNull().default([]),
    cta: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("cta"),
    status: campaignStatusEnum("status").notNull().default("planning"),
    jobId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("job_id"),
    createdBy: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("created_by"),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("campaigns_ws_idx").on(t.workspaceId, t.createdAt)
    ]);
const campaignItems = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("campaign_items", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    campaignId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("campaign_id").notNull().references(()=>campaigns.id, {
        onDelete: "cascade"
    }),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    dayIndex: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("day_index").notNull(),
    theme: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("theme").notNull(),
    contentItemId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("content_item_id").references(()=>contentItems.id, {
        onDelete: "set null"
    }),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("campaign_items_campaign_idx").on(t.campaignId, t.dayIndex)
    ]);
const postMetrics = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("post_metrics", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    platform: platformEnum("platform").notNull(),
    contentItemId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("content_item_id").references(()=>contentItems.id, {
        onDelete: "set null"
    }),
    externalPostId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("external_post_id").notNull(),
    metrics: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("metrics").notNull().default({}),
    postedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("posted_at", {
        withTimezone: true
    }),
    collectedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("collected_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uniqueIndex"])("post_metrics_external_uq").on(t.workspaceId, t.platform, t.externalPostId)
    ]);
const aiInsights = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("ai_insights", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    kind: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("kind").notNull().default("performance"),
    content: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("content").notNull(),
    data: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("data").notNull().default({}),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("ai_insights_ws_idx").on(t.workspaceId, t.createdAt)
    ]);
const competitors = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("competitors", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    name: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("name").notNull(),
    platform: platformEnum("platform").notNull().default("instagram"),
    handle: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("handle").notNull(),
    notes: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("notes"),
    lastAnalyzedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("last_analyzed_at", {
        withTimezone: true
    }),
    createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("created_at", {
        withTimezone: true
    }).notNull().defaultNow(),
    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("updated_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uniqueIndex"])("competitors_ws_handle_uq").on(t.workspaceId, t.platform, t.handle)
    ]);
const competitorSnapshots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$table$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["pgTable"])("competitor_snapshots", {
    id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("id").defaultRandom().primaryKey(),
    workspaceId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("workspace_id").notNull().references(()=>workspaces.id, {
        onDelete: "cascade"
    }),
    competitorId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$uuid$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["uuid"])("competitor_id").notNull().references(()=>competitors.id, {
        onDelete: "cascade"
    }),
    followers: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("followers"),
    postsCount: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$integer$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["integer"])("posts_count"),
    recentPosts: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$jsonb$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["jsonb"])("recent_posts").notNull().default([]),
    avgEngagement: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$real$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["real"])("avg_engagement"),
    analysis: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$text$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["text"])("analysis"),
    capturedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$columns$2f$timestamp$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["timestamp"])("captured_at", {
        withTimezone: true
    }).notNull().defaultNow()
}, (t)=>[
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$pg$2d$core$2f$indexes$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["index"])("competitor_snapshots_comp_idx").on(t.competitorId, t.capturedAt)
    ]);
}),
"[project]/Documents/QURTIZ AI/src/db/index.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "getDb",
    ()=>getDb
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$node$2d$postgres$2f$driver$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/node-postgres/driver.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__ = __turbopack_context__.i("[externals]/pg [external] (pg, esm_import)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/schema.ts [instrumentation] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$node$2d$postgres$2f$driver$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$node$2d$postgres$2f$driver$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
let pool = null;
let db = null;
function getDb() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is not configured. Create .env.local from .env.example (see SETUP.md).");
    }
    if (!db) {
        pool = new __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__["Pool"]({
            connectionString,
            max: 5
        });
        db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$node$2d$postgres$2f$driver$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["drizzle"])(pool, {
            schema: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__
        });
    }
    return db;
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
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
"[project]/Documents/QURTIZ AI/src/lib/crypto/tokens.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "decryptToken",
    ()=>decryptToken,
    "encryptToken",
    ()=>encryptToken
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
/**
 * AES-256-GCM encryption for third-party access tokens.
 * Key source: ENCRYPTION_KEY env (64 hex chars = 32 bytes). A dev fallback
 * derived from DATABASE_URL exists so local setup is frictionless, but
 * production must set a dedicated key.
 */ function getKey() {
    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey && /^[0-9a-f]{64}$/i.test(envKey)) {
        return Buffer.from(envKey, "hex");
    }
    // Deterministic dev fallback (documented in SECURITY notes).
    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].createHash("sha256").update(`qurtiz-dev::${process.env.DATABASE_URL ?? "no-db"}`).digest();
}
function encryptToken(plaintext) {
    const iv = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].randomBytes(12);
    const cipher = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].createCipheriv("aes-256-gcm", getKey(), iv);
    const enc = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}
function decryptToken(payload) {
    try {
        const [version, ivB64, tagB64, dataB64] = payload.split(".");
        if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) return null;
        const decipher = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
        decipher.setAuthTag(Buffer.from(tagB64, "base64"));
        const dec = Buffer.concat([
            decipher.update(Buffer.from(dataB64, "base64")),
            decipher.final()
        ]);
        return dec.toString("utf8");
    } catch  {
        return null;
    }
}
}),
"[project]/Documents/QURTIZ AI/src/lib/meta/oauth.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GRAPH_HOST",
    ()=>GRAPH_HOST,
    "GRAPH_VERSION",
    ()=>GRAPH_VERSION,
    "buildOAuthUrl",
    ()=>buildOAuthUrl,
    "exchangeForPages",
    ()=>exchangeForPages,
    "metaConfigured",
    ()=>metaConfigured,
    "metaRedirectUri",
    ()=>metaRedirectUri
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/server-only/empty.js [instrumentation] (ecmascript)");
;
const GRAPH_VERSION = "v26.0";
const GRAPH_HOST = "https://graph.facebook.com";
function metaConfigured() {
    return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}
function metaRedirectUri(origin) {
    return `${origin}/api/meta/callback`;
}
function buildOAuthUrl(origin, state) {
    const params = new URLSearchParams({
        client_id: process.env.META_APP_ID ?? "",
        redirect_uri: metaRedirectUri(origin),
        state,
        response_type: "code"
    });
    // Two supported modes:
    // 1) META_LOGIN_CONFIG_ID set  -> Facebook Login for Business (config carries permissions)
    // 2) otherwise                 -> classic Facebook Login with explicit scopes
    const configId = process.env.META_LOGIN_CONFIG_ID;
    if (configId) {
        params.set("config_id", configId);
    } else {
        params.set("scope", [
            "pages_show_list",
            "pages_manage_posts",
            "pages_read_engagement",
            "instagram_basic",
            "instagram_content_publish"
        ].join(","));
    }
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}
async function exchangeForPages(code, origin) {
    const params = new URLSearchParams({
        client_id: process.env.META_APP_ID ?? "",
        client_secret: process.env.META_APP_SECRET ?? "",
        redirect_uri: metaRedirectUri(origin),
        code
    });
    const tokenRes = await fetch(`${GRAPH_HOST}/${GRAPH_VERSION}/oauth/access_token?${params.toString()}`, {
        signal: AbortSignal.timeout(30_000)
    });
    const tokenJson = await tokenRes.json();
    if (!tokenJson.access_token) {
        throw new Error(tokenJson.error?.message ?? "Token exchange failed");
    }
    const userToken = tokenJson.access_token;
    const pagesRes = await fetch(`${GRAPH_HOST}/${GRAPH_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(userToken)}`, {
        signal: AbortSignal.timeout(30_000)
    });
    const pagesJson = await pagesRes.json();
    if (!pagesJson.data) {
        throw new Error(pagesJson.error?.message ?? "Could not list pages");
    }
    return pagesJson.data.map((p)=>({
            pageId: p.id,
            pageName: p.name,
            pageToken: p.access_token,
            igUserId: p.instagram_business_account?.id ?? null,
            igUsername: p.instagram_business_account?.username ?? null
        }));
}
}),
"[project]/Documents/QURTIZ AI/src/lib/meta/publish.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "publishPost",
    ()=>publishPost
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/server-only/empty.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$oauth$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/meta/oauth.ts [instrumentation] (ecmascript)");
;
;
async function graphPost(path, token, body) {
    const params = new URLSearchParams({
        access_token: token,
        ...body
    });
    const res = await fetch(`${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$oauth$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["GRAPH_HOST"]}/${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$oauth$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["GRAPH_VERSION"]}/${path}`, {
        method: "POST",
        body: params,
        signal: AbortSignal.timeout(60_000)
    });
    return await res.json();
}
async function graphGet(url, token) {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}access_token=${encodeURIComponent(token)}&fields=permalink`, {
        signal: AbortSignal.timeout(30_000)
    });
    return await res.json();
}
async function publishPost(input) {
    try {
        if (input.platform === "facebook") {
            let postId;
            if (input.imageUrl) {
                const r = await graphPost(`${input.pageId}/photos`, input.pageToken, {
                    url: input.imageUrl,
                    caption: input.message
                });
                if (r.error) return {
                    ok: false,
                    reason: "graph_error",
                    message: r.error.message ?? "Facebook publish failed"
                };
                postId = r.id;
            } else {
                const r = await graphPost(`${input.pageId}/feed`, input.pageToken, {
                    message: input.message
                });
                if (r.error) return {
                    ok: false,
                    reason: "graph_error",
                    message: r.error.message ?? "Facebook publish failed"
                };
                postId = r.id;
            }
            const permalink = postId ? (await graphGet(`${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$oauth$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["GRAPH_HOST"]}/${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$oauth$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["GRAPH_VERSION"]}/${postId}`, input.pageToken)).permalink ?? null : null;
            return {
                ok: true,
                postId: postId ?? "",
                permalink
            };
        }
        // Instagram
        if (!input.igUserId) {
            return {
                ok: false,
                reason: "no_ig",
                message: "No Instagram Professional account linked to this page."
            };
        }
        if (!input.imageUrl) {
            return {
                ok: false,
                reason: "no_visual",
                message: "Instagram posts require an image. Generate a visual for this content first."
            };
        }
        const container = await graphPost(`${input.igUserId}/media`, input.pageToken, {
            image_url: input.imageUrl,
            caption: input.message
        });
        if (container.error) return {
            ok: false,
            reason: "graph_error",
            message: container.error.message ?? "IG container failed"
        };
        if (!container.id) return {
            ok: false,
            reason: "graph_error",
            message: "IG container returned no id"
        };
        const published = await graphPost(`${input.igUserId}/media_publish`, input.pageToken, {
            creation_id: container.id
        });
        if (published.error) return {
            ok: false,
            reason: "graph_error",
            message: published.error.message ?? "IG publish failed"
        };
        const permalink = published.id ? (await graphGet(`${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$oauth$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["GRAPH_HOST"]}/${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$oauth$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["GRAPH_VERSION"]}/${published.id}`, input.pageToken)).permalink ?? null : null;
        return {
            ok: true,
            postId: published.id ?? "",
            permalink
        };
    } catch (error) {
        return {
            ok: false,
            reason: "network",
            message: error instanceof Error ? error.message : "Graph request failed"
        };
    }
}
}),
"[project]/Documents/QURTIZ AI/src/lib/analytics/sync.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "syncInsightsForWorkspace",
    ()=>syncInsightsForWorkspace
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/server-only/empty.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/sql/expressions/conditions.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/index.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/schema.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$crypto$2f$tokens$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/crypto/tokens.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$oauth$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/meta/oauth.ts [instrumentation] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
;
async function graphGet(url, token) {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}access_token=${encodeURIComponent(token)}`, {
        signal: AbortSignal.timeout(30_000)
    });
    return await res.json();
}
async function collectMetrics(workspaceId, platform, token, externalPostId, contentItemId, postedAt) {
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    const metricNames = platform === "facebook" ? "post_impressions,post_engaged_users,post_reactions_like_total,post_comments_count,post_shares_count" : "impressions,reach,likes,comments,saved,shares";
    const insights = await graphGet(`${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$oauth$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["GRAPH_HOST"]}/${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$oauth$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["GRAPH_VERSION"]}/${externalPostId}/insights?metric=${metricNames}`, token);
    if (insights.error) return false;
    const m = {};
    for (const metric of insights.data ?? []){
        const value = metric.values?.[0]?.value;
        if (typeof value === "number") {
            m[metric.name.replace("post_", "")] = value;
            if (metric.name === "saved") m.saves = value;
        }
    }
    if (Object.keys(m).length === 0) return false;
    const normalized = {
        reach: m.reach ?? 0,
        impressions: m.impressions ?? 0,
        likes: m.reactions_like_total ?? m.likes ?? 0,
        comments: m.comments_count ?? m.comments ?? 0,
        shares: m.shares ?? 0,
        saves: m.saves ?? 0,
        videoViews: m.video_views ?? 0
    };
    await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["postMetrics"]).values({
        workspaceId,
        platform,
        contentItemId,
        externalPostId,
        metrics: normalized,
        postedAt
    }).onConflictDoUpdate({
        target: [
            __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["postMetrics"].workspaceId,
            __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["postMetrics"].platform,
            __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["postMetrics"].externalPostId
        ],
        set: {
            metrics: normalized,
            collectedAt: new Date(),
            contentItemId
        }
    });
    return true;
}
async function syncInsightsForWorkspace(workspaceId) {
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    const result = {
        synced: 0,
        errors: []
    };
    const connections = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["platformConnections"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["platformConnections"].workspaceId, workspaceId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["platformConnections"].status, "connected")));
    for (const conn of connections){
        if (!conn.encryptedToken) continue;
        const token = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$crypto$2f$tokens$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["decryptToken"])(conn.encryptedToken);
        if (!token) {
            result.errors.push(`${conn.platform}: token decrypt failed — reconnect.`);
            continue;
        }
        const meta = conn.meta ?? {};
        // Map our published posts to external ids
        const publishedJobs = await db.select({
            platform: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].platform,
            contentItemId: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].contentItemId,
            result: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].result
        }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].workspaceId, workspaceId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].status, "published")));
        const externalIds = new Map(); // externalPostId -> contentItemId
        for (const j of publishedJobs){
            const postId = j.result?.postId;
            if (typeof postId === "string") externalIds.set(postId, j.contentItemId);
        }
        try {
            if (conn.platform === "facebook") {
                const posts = await graphGet(`${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$oauth$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["GRAPH_HOST"]}/${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$oauth$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["GRAPH_VERSION"]}/${meta.pageId}/posts?fields=id,created_time&limit=50`, token);
                if (posts.error) result.errors.push(`facebook: ${posts.error.message}`);
                for (const p of posts.data ?? []){
                    const linked = externalIds.get(p.id) ?? null;
                    const ok = await collectMetrics(workspaceId, "facebook", token, p.id, linked, p.created_time ? new Date(p.created_time) : null);
                    if (ok) result.synced++;
                }
            }
            if (conn.platform === "instagram" && meta.igUserId) {
                const media = await graphGet(`${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$oauth$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["GRAPH_HOST"]}/${__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$oauth$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["GRAPH_VERSION"]}/${meta.igUserId}/media?fields=id,timestamp&limit=50`, token);
                if (media.error) result.errors.push(`instagram: ${media.error.message}`);
                for (const p of media.data ?? []){
                    const linked = externalIds.get(p.id) ?? null;
                    const ok = await collectMetrics(workspaceId, "instagram", token, p.id, linked, p.timestamp ? new Date(p.timestamp) : null);
                    if (ok) result.synced++;
                }
            }
        } catch (e) {
            result.errors.push(`${conn.platform}: ${e instanceof Error ? e.message : "sync failed"}`);
        }
    }
    void __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"]; // reserved for variant-level metric joins in later iterations
    return result;
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/Documents/QURTIZ AI/src/lib/ai/provider.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_MODEL",
    ()=>DEFAULT_MODEL,
    "MODEL_COSTS",
    ()=>MODEL_COSTS,
    "estimateCost",
    ()=>estimateCost,
    "estimateCostFromUsage",
    ()=>estimateCostFromUsage,
    "getModel",
    ()=>getModel,
    "getModelId",
    ()=>getModelId,
    "isAiConfigured",
    ()=>isAiConfigured
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$ai$2d$sdk$2f$google$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@ai-sdk/google/dist/index.mjs [instrumentation] (ecmascript)");
;
const MODEL_COSTS = {
    "gemini-3.6-flash": {
        input: 0.75,
        output: 3.75
    },
    "gemini-3.7-flash": {
        input: 0.75,
        output: 3.75
    },
    "gemini-2.5-flash": {
        input: 0.3,
        output: 2.5
    },
    "gemini-2.5-flash-lite": {
        input: 0.1,
        output: 0.4
    },
    "gemini-2.5-pro": {
        input: 1.25,
        output: 10
    }
};
const DEFAULT_MODEL = "gemini-3.6-flash";
function getModelId() {
    return process.env.QURTIZ_AI_MODEL?.trim() || DEFAULT_MODEL;
}
function isAiConfigured() {
    return Boolean(process.env.GEMINI_API_KEY);
}
function getModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    const modelId = getModelId();
    // Provider registry: Google first. Additional providers (OpenAI, etc.)
    // plug in here without touching agent code.
    const google = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$ai$2d$sdk$2f$google$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__["createGoogleGenerativeAI"])({
        apiKey
    });
    return google(modelId);
}
function estimateCost(modelId, inputTokens, outputTokens) {
    const rates = MODEL_COSTS[modelId];
    if (!rates) return 0;
    return inputTokens / 1_000_000 * rates.input + outputTokens / 1_000_000 * rates.output;
}
function estimateCostFromUsage(modelId, usage) {
    return estimateCost(modelId, usage.inputTokens ?? 0, usage.outputTokens ?? 0);
}
}),
"[project]/Documents/QURTIZ AI/src/lib/ai/brand-summary.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "summarizeBrandBrain",
    ()=>summarizeBrandBrain
]);
function summarizeBrandBrain(brand) {
    if (!brand) return "No brand information configured yet.";
    const parts = [];
    const add = (label, v)=>{
        if (v && v.trim().length > 0) parts.push(label + ": " + v.trim());
    };
    add("Business", brand.businessName);
    add("Description", brand.description);
    add("Industry", brand.industry);
    add("Products", brand.products);
    add("Services", brand.services);
    add("Pricing", brand.pricing);
    add("Offers", brand.offers);
    add("Locations", brand.locations);
    add("Website", brand.website);
    add("Contact", brand.contact);
    add("Primary CTA", brand.cta);
    add("Target market", brand.targetMarket);
    const a = brand.audience ?? {};
    add("Audience demographics", String(a.demographics ?? ""));
    add("Audience interests", String(a.interests ?? ""));
    add("Audience problems", String(a.problems ?? ""));
    add("Audience goals", String(a.goals ?? ""));
    add("Audience objections", String(a.objections ?? ""));
    add("Audience preferred language", String(a.preferredLanguage ?? ""));
    if (brand.voicePresets.length > 0) parts.push("Brand voice: " + brand.voicePresets.join(", "));
    add("Voice instructions", brand.voiceCustom);
    add("Visual identity", JSON.stringify(brand.visualIdentity ?? {}));
    add("Content rules", JSON.stringify(brand.contentRules ?? {}));
    return parts.length > 0 ? parts.join("\n") : "Brand Brain is empty - ask the user to fill it in.";
}
}),
"[project]/Documents/QURTIZ AI/src/lib/content/similarity.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Lightweight text similarity for duplicate/repetition detection.
 * Word-set Jaccard — no external dependency, deterministic, testable.
 */ __turbopack_context__.s([
    "findSimilar",
    ()=>findSimilar,
    "jaccardSimilarity",
    ()=>jaccardSimilarity,
    "tokenize",
    ()=>tokenize
]);
const STOP_WORDS = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "it",
    "this",
    "that",
    "your",
    "you",
    "we",
    "our",
    "they",
    "their",
    "as",
    "by",
    "from",
    "will"
]);
function tokenize(text) {
    return new Set(text.toLowerCase().replace(/[#@]/g, " ").split(/[^a-z0-9\u0600-\u06ff]+/).filter((w)=>w.length > 1 && !STOP_WORDS.has(w)));
}
function jaccardSimilarity(a, b) {
    const ta = tokenize(a);
    const tb = tokenize(b);
    if (ta.size === 0 || tb.size === 0) return 0;
    let intersection = 0;
    for (const w of ta)if (tb.has(w)) intersection++;
    const union = ta.size + tb.size - intersection;
    return union === 0 ? 0 : intersection / union;
}
function findSimilar(candidate, corpus, threshold = 0.6) {
    let best = 0;
    for (const text of corpus){
        const s = jaccardSimilarity(candidate, text);
        if (s > best) best = s;
    }
    return {
        similar: best >= threshold,
        best: Math.round(best * 100) / 100
    };
}
}),
"[project]/Documents/QURTIZ AI/src/lib/content/qa.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "runContentQa",
    ()=>runContentQa
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$content$2f$similarity$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/content/similarity.ts [instrumentation] (ecmascript)");
;
const PLATFORM_CAPTION_LIMITS = {
    facebook: 2000,
    instagram: 2200
};
const HYPE_PATTERNS = [
    /guaranteed\s+(results?|income|profit)/i,
    /100%\s+(guarantee|risk[- ]free)/i,
    /get\s+rich\s+quick/i,
    /\bno\.?\s*1\b\s+(in|for)\s+(the\s+)?(world|country|pakistan)/i,
    /\bmiracle\b/i
];
function runContentQa(input) {
    const issues = [];
    const caption = input.caption ?? "";
    const rules = input.rules ?? {};
    // Brand avoid-lists (hard constraints)
    for (const word of rules.avoidWords ?? []){
        if (word && caption.toLowerCase().includes(word.toLowerCase())) {
            issues.push({
                severity: "error",
                check: "avoid_words",
                message: `Contains avoided word: "${word}"`
            });
        }
    }
    for (const claim of rules.avoidClaims ?? []){
        if (claim && caption.toLowerCase().includes(claim.toLowerCase())) {
            issues.push({
                severity: "error",
                check: "avoid_claims",
                message: `Contains avoided claim: "${claim}"`
            });
        }
    }
    for (const topic of rules.avoidTopics ?? []){
        if (topic && caption.toLowerCase().includes(topic.toLowerCase())) {
            issues.push({
                severity: "error",
                check: "avoid_topics",
                message: `Touches avoided topic: "${topic}"`
            });
        }
    }
    // Hype / unsupported-claim heuristics
    for (const pattern of HYPE_PATTERNS){
        if (pattern.test(caption)) {
            issues.push({
                severity: "error",
                check: "unsupported_claims",
                message: `Possible unsupported claim`
            });
        }
    }
    // Platform caption length
    const limit = PLATFORM_CAPTION_LIMITS[input.platform];
    if (limit && caption.length > limit) {
        issues.push({
            severity: "error",
            check: "caption_length",
            message: `Caption exceeds ${input.platform} limit (${caption.length}/${limit})`
        });
    }
    // CTA rules
    if (rules.ctaRule && input.cta) {
        const keyword = rules.ctaRule.match(/WhatsApp|DM|comment|link/i)?.[0];
        if (keyword && !input.cta.toLowerCase().includes(keyword.toLowerCase())) {
            issues.push({
                severity: "warning",
                check: "cta_rule",
                message: `CTA rule suggests "${keyword}" but CTA is: "${input.cta.slice(0, 60)}"`
            });
        }
    }
    if (!input.cta || input.cta.trim().length === 0) {
        issues.push({
            severity: "warning",
            check: "cta_missing",
            message: "No CTA set"
        });
    }
    // Hashtag count sanity
    if (input.hashtags.length > 30) {
        issues.push({
            severity: "warning",
            check: "hashtag_count",
            message: `${input.hashtags.length} hashtags — max 30`
        });
    }
    // Duplicate/repetition detection against published/drafted captions
    if (input.existingCaptions && input.existingCaptions.length > 0) {
        const { similar, best } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$content$2f$similarity$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["findSimilar"])(caption, input.existingCaptions);
        if (similar) {
            issues.push({
                severity: "error",
                check: "duplicate",
                message: `Too similar to existing content (${Math.round(best * 100)}% match) — try a new angle`
            });
        }
    }
    const errors = issues.filter((i)=>i.severity === "error").length;
    const warnings = issues.length - errors;
    const score = Math.max(0, 100 - errors * 30 - warnings * 8);
    return {
        passed: errors === 0,
        score,
        issues
    };
}
}),
"[project]/Documents/QURTIZ AI/src/lib/ai/content.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "generateAndPersistContent",
    ()=>generateAndPersistContent,
    "generatedContentSchema",
    ()=>generatedContentSchema
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$ai$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/ai/dist/index.mjs [instrumentation] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/zod/v4/classic/external.js [instrumentation] (ecmascript) <export * as z>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/sql/expressions/conditions.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$select$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/sql/expressions/select.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/index.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/schema.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/provider.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$brand$2d$summary$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/brand-summary.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$content$2f$qa$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/content/qa.ts [instrumentation] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
;
;
;
const generatedContentSchema = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    hook: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().describe("Scroll-stopping opening line"),
    mainCopy: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().describe("Core message body shared across platforms"),
    cta: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().describe("Call to action, consistent with brand rules"),
    hashtags: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string()).max(15).describe("Hashtags without the # symbol"),
    keywords: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string()).max(10).describe("SEO/keyword terms covered"),
    visualConcept: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().describe("Description of the visual to create"),
    relevanceScore: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].number().min(0).max(10),
    engagementScore: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].number().min(0).max(10),
    variants: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
        platform: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].enum([
            "facebook",
            "instagram"
        ]),
        format: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].enum([
            "single_image",
            "carousel",
            "reel",
            "story",
            "text_post"
        ]),
        caption: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().describe("Platform-adapted caption. Reels get shorter, punchier captions."),
        hashtags: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string()).max(15),
        cta: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string(),
        script: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
            hook: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().optional(),
            scenes: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
                text: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string(),
                onScreenText: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().optional(),
                durationSeconds: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].number().optional()
            })).max(10).optional(),
            outro: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().optional()
        }).describe("For reel format: scene structure. Empty object otherwise.")
    })).min(1)
});
async function generateAndPersistContent(ctx) {
    const model = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getModel"])();
    if (!model) throw new Error("CONFIGURATION_REQUIRED");
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    const [brand] = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brands"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brands"].workspaceId, ctx.workspaceId));
    const memories = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"].workspaceId, ctx.workspaceId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"].active, true))).orderBy((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$select$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["desc"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"].createdAt)).limit(60);
    // Existing captions for duplicate detection.
    const existing = await db.select({
        caption: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].caption
    }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].workspaceId, ctx.workspaceId))).orderBy((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$select$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["desc"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].createdAt)).limit(50);
    const existingCaptions = existing.map((e)=>e.caption ?? "").filter((c)=>c.length > 0);
    // Adaptive learning: inject the latest measured strategy memory.
    const [strategyRow] = await db.select({
        content: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["aiInsights"].content
    }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["aiInsights"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["aiInsights"].workspaceId, ctx.workspaceId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["aiInsights"].kind, "strategy"))).orderBy((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$select$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["desc"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["aiInsights"].createdAt)).limit(1);
    const strategyLine = strategyRow ? "\n## Measured strategy insights (from this brand\u2019s own performance data)\n" + strategyRow.content : "";
    const [run] = await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["agentRuns"]).values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        kind: "content_generation",
        model: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getModelId"])()
    }).returning();
    const rules = brand?.contentRules ?? {};
    const memoryLines = memories.map((m)=>`- [${m.type}] ${m.content}`).join("\n") + (strategyLine || "");
    const system = `You are the QURTIZ AI content engine for "${brand?.businessName ?? ctx.workspaceId}".

## Brand Brain
${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$brand$2d$summary$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["summarizeBrandBrain"])(brand ?? null)}

## Brand memory (must be respected)
${memoryLines.length > 0 ? memoryLines : "(none)"}

## Hard rules
1. Respect every avoided word/claim/topic strictly.
2. Match the brand voice in all copy.
3. Adapt per platform — never duplicate the same caption: Facebook favors conversation and slightly longer copy; Instagram favors strong hooks, concise captions, and save-worthy structure.
4. For reel formats, produce a scene script (hook, 3-6 scenes with on-screen text, outro).
5. Never invent statistics, testimonials, or product claims that are not in the Brand Brain.
6. Hashtags: no # symbol in the strings.`;
    const prompt = `Create one social media post.
Topic: ${ctx.input.topic}
Objective: ${ctx.input.objective ?? "Engagement + awareness"}
Target platforms: ${ctx.input.platforms.join(", ")}
${ctx.input.preferredFormat ? `Preferred format: ${ctx.input.preferredFormat}` : "Choose the best format per platform and explain nothing — just produce it."}
Produce one variant per target platform.`;
    const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$ai$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__["generateObject"])({
        model,
        schema: generatedContentSchema,
        system,
        prompt
    });
    const usage = result.usage;
    try {
        await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["agentRuns"]).set({
            status: "completed",
            inputTokens: usage?.inputTokens ?? null,
            outputTokens: usage?.outputTokens ?? null,
            costUsd: usage ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["estimateCostFromUsage"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getModelId"])(), usage).toFixed(6) : null,
            finishedAt: new Date()
        }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["agentRuns"].id, run.id));
    } catch  {
    // bookkeeping must not fail the generation
    }
    const d = result.object;
    const qa = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$content$2f$qa$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["runContentQa"])({
        caption: d.variants[0]?.caption ?? d.mainCopy,
        hashtags: d.hashtags,
        cta: d.cta,
        platform: ctx.input.platforms[0] ?? "facebook",
        rules,
        existingCaptions
    });
    const [item] = await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"]).values({
        workspaceId: ctx.workspaceId,
        topic: ctx.input.topic,
        objective: ctx.input.objective ?? null,
        format: ctx.input.preferredFormat ?? d.variants[0]?.format ?? "single_image",
        hook: d.hook,
        mainCopy: d.mainCopy,
        caption: d.variants[0]?.caption ?? d.mainCopy,
        cta: d.cta,
        hashtags: d.hashtags,
        keywords: d.keywords,
        visualConcept: d.visualConcept,
        aiScores: {
            relevance: d.relevanceScore,
            engagement: d.engagementScore,
            estimated: true
        },
        qa: qa,
        status: qa.passed ? "ready_for_review" : "draft",
        createdBy: ctx.userId
    }).returning();
    await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"]).values(d.variants.map((v)=>({
            contentItemId: item.id,
            workspaceId: ctx.workspaceId,
            platform: v.platform,
            format: v.format,
            caption: v.caption,
            hashtags: v.hashtags,
            cta: v.cta,
            script: v.script,
            qa: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$content$2f$qa$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["runContentQa"])({
                caption: v.caption,
                hashtags: v.hashtags,
                cta: v.cta,
                platform: v.platform,
                rules,
                existingCaptions
            }),
            status: qa.passed ? "ready_for_review" : "generating"
        })));
    return {
        itemId: item.id,
        qa
    };
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/Documents/QURTIZ AI/src/lib/scheduling/time.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Timezone-aware scheduling helpers. Pure and deterministic — tested.
 */ __turbopack_context__.s([
    "defaultSlotFor",
    ()=>defaultSlotFor,
    "parseZonedDateTime",
    ()=>parseZonedDateTime,
    "planContentDays",
    ()=>planContentDays,
    "zonedToUtc",
    ()=>zonedToUtc
]);
function tzOffsetMs(date, tz) {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
    const parts = dtf.formatToParts(date);
    const get = (type)=>Number(parts.find((p)=>p.type === type)?.value ?? "0");
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
    return asUtc - date.getTime();
}
function zonedToUtc(year, month, day, hour, minute, tz) {
    const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
    let offset = tzOffsetMs(new Date(guess), tz);
    let ts = guess - offset;
    offset = tzOffsetMs(new Date(ts), tz);
    ts = guess - offset;
    return new Date(ts);
}
function parseZonedDateTime(dateIso, timeStr, tz) {
    const [y, m, d] = dateIso.split("-").map(Number);
    const [h, min] = timeStr.split(":").map(Number);
    return zonedToUtc(y, m, d, h, min, tz);
}
function defaultSlotFor(dateIso, tz) {
    return parseZonedDateTime(dateIso, "18:30", tz);
}
function planContentDays(fromUtc, count, maxPostsPerDay = 1) {
    const days = [];
    const cursor = new Date(fromUtc.getTime());
    cursor.setUTCDate(cursor.getUTCDate() + 1); // start tomorrow
    let guard = 0;
    while(days.length < count && guard < 120){
        const dow = cursor.getUTCDay();
        if (dow !== 0 && dow !== 6) {
            days.push(cursor.toISOString().slice(0, 10));
            if (maxPostsPerDay === 1) cursor.setUTCDate(cursor.getUTCDate() + 2); // every other weekday
            else cursor.setUTCDate(cursor.getUTCDate() + 1);
        } else {
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        guard++;
    }
    return days;
}
}),
"[project]/Documents/QURTIZ AI/src/lib/scheduling/engine.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "scheduleItem",
    ()=>scheduleItem
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/server-only/empty.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/sql/expressions/conditions.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/index.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/schema.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$scheduling$2f$time$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/scheduling/time.ts [instrumentation] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
async function scheduleItem(args) {
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(args.dateIso);
    const timeStr = args.timeStr && /^\d{2}:\d{2}$/.test(args.timeStr) ? args.timeStr : "18:30";
    if (!dateOk) return {
        ok: false,
        reason: "invalid_date",
        message: "Date must be YYYY-MM-DD."
    };
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    const [item] = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].id, args.itemId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].workspaceId, args.workspaceId)));
    if (!item) return {
        ok: false,
        reason: "not_found",
        message: "Content item not found."
    };
    if (![
        "ready_for_review",
        "approved",
        "scheduled"
    ].includes(item.status)) {
        return {
            ok: false,
            reason: "not_reviewable",
            message: "Content must be in Ready for Review or Approved before scheduling (review it first)."
        };
    }
    const [y, mo, d] = args.dateIso.split("-").map(Number);
    const [h, mi] = timeStr.split(":").map(Number);
    const scheduledAt = args.timeStr ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$scheduling$2f$time$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["parseZonedDateTime"])(args.dateIso, timeStr, args.timezone) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$scheduling$2f$time$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["defaultSlotFor"])(args.dateIso, args.timezone);
    void h;
    void mi;
    void y;
    void mo;
    void d;
    const variants = await db.select({
        id: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"].id,
        platform: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"].platform
    }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"].contentItemId, item.id), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"].workspaceId, args.workspaceId)));
    if (variants.length === 0) {
        return {
            ok: false,
            reason: "no_variants",
            message: "This item has no platform variants to schedule."
        };
    }
    for (const v of variants){
        await db.delete(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].contentVariantId, v.id), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].status, "pending")));
        await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"]).values({
            workspaceId: args.workspaceId,
            contentItemId: item.id,
            contentVariantId: v.id,
            platform: v.platform,
            scheduledAt,
            status: "pending"
        });
    }
    await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"]).set({
        status: "scheduled",
        scheduledAt,
        updatedAt: new Date()
    }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].id, item.id));
    await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"]).set({
        status: "scheduled",
        updatedAt: new Date()
    }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"].contentItemId, item.id));
    return {
        ok: true,
        scheduledAt,
        variants: variants.length
    };
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/Documents/QURTIZ AI/src/lib/content/pillars.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "DEFAULT_PILLARS",
    ()=>DEFAULT_PILLARS,
    "ensureDefaultPillars",
    ()=>ensureDefaultPillars
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/sql/expressions/conditions.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/index.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/schema.ts [instrumentation] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
const DEFAULT_PILLARS = [
    {
        name: "Educational",
        description: "Teach something useful",
        targetShare: 40
    },
    {
        name: "Promotional",
        description: "Offers and products",
        targetShare: 20
    },
    {
        name: "Social proof",
        description: "Testimonials and results",
        targetShare: 15
    },
    {
        name: "Engagement",
        description: "Questions and community",
        targetShare: 15
    },
    {
        name: "Behind the scenes",
        description: "Process and people",
        targetShare: 10
    }
];
async function ensureDefaultPillars(workspaceId) {
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    const existing = await db.select({
        id: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentPillars"].id
    }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentPillars"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentPillars"].workspaceId, workspaceId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentPillars"].active, true)));
    if (existing.length > 0) return;
    await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentPillars"]).values(DEFAULT_PILLARS.map((p)=>({
            workspaceId,
            ...p
        })));
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[externals]/satori [external] (satori, esm_import)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

const mod = await __turbopack_context__.y("satori");

__turbopack_context__.n(mod);
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, true);}),
"[externals]/@resvg/resvg-js [external] (@resvg/resvg-js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("@resvg/resvg-js", () => require("@resvg/resvg-js"));

module.exports = mod;
}),
"[externals]/node:fs [external] (node:fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:fs", () => require("node:fs"));

module.exports = mod;
}),
"[externals]/node:path [external] (node:path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:path", () => require("node:path"));

module.exports = mod;
}),
"[project]/Documents/QURTIZ AI/src/lib/visuals/template.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "TEMPLATE_SIZES",
    ()=>TEMPLATE_SIZES,
    "renderTemplateVisual",
    ()=>renderTemplateVisual
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$satori__$5b$external$5d$__$28$satori$2c$__esm_import$29$__ = __turbopack_context__.i("[externals]/satori [external] (satori, esm_import)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$resvg$2f$resvg$2d$js__$5b$external$5d$__$2840$resvg$2f$resvg$2d$js$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/@resvg/resvg-js [external] (@resvg/resvg-js, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$externals$5d2f$satori__$5b$external$5d$__$28$satori$2c$__esm_import$29$__
]);
[__TURBOPACK__imported__module__$5b$externals$5d2f$satori__$5b$external$5d$__$28$satori$2c$__esm_import$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
const TEMPLATE_SIZES = {
    square: {
        w: 1080,
        h: 1080
    },
    portrait: {
        w: 1080,
        h: 1350
    }
};
let fontsCache = null;
/** Inter woff files from @fontsource (satori needs TTF/OTF/WOFF, not WOFF2). */ function loadFonts() {
    if (fontsCache) return fontsCache;
    const base = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(process.cwd(), "node_modules", "@fontsource", "inter", "files");
    const files = [
        "inter-latin-400-normal.woff",
        "inter-latin-600-normal.woff",
        "inter-latin-700-normal.woff"
    ];
    fontsCache = files.map((f)=>__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(base, f)).filter((p)=>__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["default"].existsSync(p)).map((p)=>({
            data: __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["default"].readFileSync(p),
            name: "Inter",
            weight: 400,
            style: "normal"
        }));
    return fontsCache;
}
function normalizeHex(input, fallback) {
    const v = (input ?? "").trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
    return fallback;
}
function el(style, children = []) {
    // satori requires explicit display on multi-child containers; flex is our default.
    const safeStyle = {
        display: "flex",
        ...style
    };
    return {
        type: "div",
        props: {
            style: safeStyle,
            children: children.filter((c)=>c !== null && c !== undefined)
        }
    };
}
function txt(text, style) {
    return {
        type: "div",
        props: {
            style: {
                display: "flex",
                ...style
            },
            children: [
                text
            ]
        }
    };
}
function buildTree(s) {
    const primary = normalizeHex(s.primaryColor, "#6366f1");
    const secondary = normalizeHex(s.secondaryColor, "#0ea5e9");
    const dark = "#0b0d12";
    const logoBlock = s.logoDataUrl ? el({
        display: "flex",
        alignItems: "center",
        gap: 12
    }, [
        {
            type: "img",
            props: {
                src: s.logoDataUrl,
                width: 72,
                height: 72,
                style: {
                    objectFit: "contain"
                }
            }
        },
        txt(s.brandName, {
            fontSize: 30,
            fontWeight: 600,
            color: "rgba(255,255,255,0.9)"
        })
    ]) : txt(s.brandName, {
        fontSize: 30,
        fontWeight: 600,
        color: "rgba(255,255,255,0.9)"
    });
    const headline = txt(s.headline.slice(0, 90), {
        display: "flex",
        fontSize: s.layout === "promo" ? 76 : 64,
        fontWeight: 700,
        lineHeight: 1.08,
        color: "#ffffff",
        letterSpacing: "-0.02em"
    });
    const subline = s.subline ? txt(s.subline.slice(0, 160), {
        fontSize: 34,
        lineHeight: 1.35,
        color: "rgba(255,255,255,0.78)"
    }) : null;
    const cta = s.cta ? el({
        display: "flex",
        backgroundColor: "#ffffff",
        borderRadius: 999,
        padding: "20px 40px",
        alignSelf: "flex-start"
    }, [
        txt(s.cta.slice(0, 40), {
            fontSize: 30,
            fontWeight: 700,
            color: dark
        })
    ]) : null;
    if (s.layout === "statement") {
        return el({
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 72,
            backgroundColor: dark,
            backgroundImage: `radial-gradient(circle at 85% 15%, ${primary}44, transparent 55%), radial-gradient(circle at 10% 90%, ${secondary}33, transparent 50%)`
        }, [
            el({
                display: "flex"
            }, [
                logoBlock
            ]),
            el({
                display: "flex",
                flexDirection: "column",
                gap: 28
            }, [
                headline,
                subline
            ]),
            cta ?? el({
                display: "flex"
            }, [])
        ]);
    }
    // promo: colored panel + white content card
    return el({
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: dark,
        padding: 56
    }, [
        el({
            display: "flex"
        }, [
            logoBlock
        ]),
        el({
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            gap: 30,
            marginTop: 40,
            marginBottom: 40,
            borderRadius: 40,
            padding: 56,
            backgroundImage: `linear-gradient(135deg, ${primary}, ${secondary})`
        }, [
            headline,
            subline,
            cta
        ])
    ]);
}
async function renderTemplateVisual(style, size = "portrait") {
    const { w, h } = TEMPLATE_SIZES[size];
    const tree = buildTree(style);
    const svg = await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$satori__$5b$external$5d$__$28$satori$2c$__esm_import$29$__["default"])(tree, {
        width: w,
        height: h,
        fonts: loadFonts().map((f)=>({
                data: f.data,
                name: "Inter",
                weight: 400,
                style: "normal"
            }))
    });
    const resvg = new __TURBOPACK__imported__module__$5b$externals$5d2f40$resvg$2f$resvg$2d$js__$5b$external$5d$__$2840$resvg$2f$resvg$2d$js$2c$__cjs$29$__["Resvg"](svg, {
        fitTo: {
            mode: "width",
            value: w
        }
    });
    return Buffer.from(resvg.render().asPng());
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/Documents/QURTIZ AI/src/lib/supabase/server.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createClient",
    ()=>createClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@supabase/ssr/dist/module/index.js [instrumentation] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@supabase/ssr/dist/module/createServerClient.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$headers$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/headers.js [instrumentation] (ecmascript)");
;
;
async function createClient() {
    const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$headers$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["cookies"])();
    const url = ("TURBOPACK compile-time value", "https://lmbnkzldrmflyssuavau.supabase.co");
    const anonKey = ("TURBOPACK compile-time value", "sb_publishable_yjvzPK2jAbI1UVU8CVTXyw_TegodinS");
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["createServerClient"])(url, anonKey, {
        cookies: {
            getAll () {
                return cookieStore.getAll();
            },
            setAll (cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options })=>cookieStore.set(name, value, options));
                } catch  {
                // Called from a Server Component render — safe to ignore when
                // middleware is refreshing sessions.
                }
            }
        }
    });
}
}),
"[project]/Documents/QURTIZ AI/src/lib/jobs/bulk.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "runBulkPlan",
    ()=>runBulkPlan,
    "startBulkPlanCore",
    ()=>startBulkPlanCore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/server-only/empty.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/sql/expressions/conditions.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$select$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/sql/expressions/select.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$ai$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/ai/dist/index.mjs [instrumentation] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/zod/v4/classic/external.js [instrumentation] (ecmascript) <export * as z>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/index.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/schema.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$content$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/content.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$brand$2d$summary$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/brand-summary.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/provider.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$content$2f$pillars$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/content/pillars.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$scheduling$2f$time$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/scheduling/time.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$visuals$2f$template$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/visuals/template.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/supabase/server.ts [instrumentation] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$content$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$content$2f$pillars$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$visuals$2f$template$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$content$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$content$2f$pillars$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$visuals$2f$template$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
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
const planSchema = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    items: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
        topic: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(4).max(200),
        pillar: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(80).default(""),
        angle: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(300).default(""),
        format: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].enum([
            "single_image",
            "carousel",
            "reel",
            "text_post"
        ]).default("single_image")
    })).min(1)
});
async function setStage(jobId, stage, progress, total) {
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    const patch = {
        result: {
            stage
        },
        updatedAt: new Date()
    };
    if (progress !== undefined) patch.progress = progress;
    if (total !== undefined) patch.total = total;
    await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"]).set(patch).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].id, jobId));
}
async function runBulkPlan(jobId) {
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    const [job] = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].id, jobId));
    if (!job || job.status !== "queued") return;
    await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"]).set({
        status: "running",
        updatedAt: new Date()
    }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].id, jobId));
    const input = job.input ?? {};
    const count = Math.min(Math.max(input.count ?? 12, 1), 30);
    const niche = input.niche?.trim() || null;
    const [run] = await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["agentRuns"]).values({
        workspaceId: job.workspaceId,
        userId: job.userId,
        kind: "bulk_generation",
        model: null
    }).returning();
    try {
        // ── 1. Brand Brain ──────────────────────────────────────────────
        await setStage(jobId, "Analyzing Brand Brain");
        const [brand] = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brands"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brands"].workspaceId, job.workspaceId));
        const memories = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"].workspaceId, job.workspaceId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"].active, true))).limit(40);
        const pillars = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentPillars"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentPillars"].workspaceId, job.workspaceId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentPillars"].active, true)));
        if (pillars.length === 0) await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$content$2f$pillars$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["ensureDefaultPillars"])(job.workspaceId);
        // ── 2. Content library (dedupe + prior topics) ──────────────────
        await setStage(jobId, "Analyzing content library");
        const existingItems = await db.select({
            topic: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].topic,
            status: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].status
        }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].workspaceId, job.workspaceId)).orderBy((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$select$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["desc"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].createdAt)).limit(60);
        const existingTopics = existingItems.map((i)=>i.topic);
        // ── 3. Analytics (only if real data exists) ─────────────────────
        await setStage(jobId, "Checking analytics");
        const metricRows = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["postMetrics"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["postMetrics"].workspaceId, job.workspaceId)).limit(100);
        let analyticsSummary = "No analytics data yet — base decisions on brand context and best practices, stated honestly.";
        if (metricRows.length >= 3) {
            const items = await db.select({
                id: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].id,
                format: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].format,
                topic: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].topic
            }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].workspaceId, job.workspaceId));
            const itemById = new Map(items.map((i)=>[
                    i.id,
                    i
                ]));
            const perf = metricRows.map((r)=>{
                const item = r.contentItemId ? itemById.get(r.contentItemId) : undefined;
                const m = r.metrics ?? {};
                return {
                    format: item?.format ?? "unknown",
                    topic: (item?.topic ?? "").slice(0, 60),
                    engagement: (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0)
                };
            });
            const byFormat = new Map();
            for (const p of perf){
                const cur = byFormat.get(p.format) ?? {
                    eng: 0,
                    posts: 0
                };
                cur.eng += p.engagement;
                cur.posts += 1;
                byFormat.set(p.format, cur);
            }
            const top = [
                ...perf
            ].sort((a, b)=>b.engagement - a.engagement).slice(0, 3);
            analyticsSummary = `Measured performance from ${metricRows.length} posts. ` + [
                ...byFormat.entries()
            ].map(([f, v])=>`${f}: avg ${Math.round(v.eng / v.posts)} engagement over ${v.posts} posts`).join("; ") + `. Top posts: ${top.map((t)=>`"${t.topic}" (${t.engagement})`).join("; ")}.`;
        }
        // ── 4. Research (only real stored research) ─────────────────────
        await setStage(jobId, "Checking research");
        const research = await db.select({
            topic: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["researchItems"].topic,
            scores: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["researchItems"].scores
        }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["researchItems"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["researchItems"].workspaceId, job.workspaceId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["ne"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["researchItems"].status, "dismissed"))).orderBy((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$select$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["desc"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["researchItems"].createdAt)).limit(10);
        const researchNote = research.length > 0 ? `Recent researched opportunities (use the best ones, do not repeat verbatim): ${research.map((r)=>r.topic).join("; ")}` : "No stored research yet — derive topics from brand context and niche.";
        // ── 5. Strategy (one structured AI call decides everything) ─────
        await setStage(jobId, "Creating content strategy", 0, count);
        const model = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getModel"])();
        if (!model) throw new Error("AI is not configured (GEMINI_API_KEY missing).");
        const pillarNames = pillars.map((p)=>p.name);
        const planRes = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$ai$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__["generateObject"])({
            model,
            schema: planSchema,
            prompt: `You are the content strategist for "${brand?.businessName ?? "the brand"}".
Brand Brain: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$brand$2d$summary$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["summarizeBrandBrain"])(brand ?? null)}
Brand memory: ${memories.map((m)=>m.content).join("; ") || "(none)"}
Content pillars available: ${pillarNames.join(", ") || "(defaults will be used)"}
Niche focus from user: ${niche ?? "(brand's general niche)"}
Analytics: ${analyticsSummary}
${researchNote}
Topics already covered (do NOT repeat these): ${existingTopics.slice(0, 30).join("; ") || "(none)"}

Create a plan for exactly ${count} DISTINCT social media posts. Rules:
- Spread across the available pillars; include a mix of educational, engagement and promotional.
- Vary formats: use carousel, reel, single_image and text_post where sensible.
- Every topic must be specific and different from the already-covered list.
- Respect all brand rules and memory.
Reply ONLY with the JSON object: {"items":[{"topic","pillar","angle","format"}]}`,
            maxOutputTokens: 3072
        });
        const plan = planRes.object.items.slice(0, count);
        // ── 6. Generate + verify each post ──────────────────────────────
        await setStage(jobId, "Generating posts", 0, plan.length);
        const created = [];
        const failedItems = [];
        for(let i = 0; i < plan.length; i++){
            // Cancellation check before each post
            const [fresh] = await db.select({
                status: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].status
            }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].id, jobId));
            if (!fresh || fresh.status === "cancelled") {
                await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"]).set({
                    status: "cancelled",
                    result: {
                        stage: "Cancelled",
                        createdCount: created.length,
                        failures: failedItems
                    },
                    updatedAt: new Date()
                }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].id, jobId));
                return;
            }
            const planItem = plan[i];
            await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"]).set({
                progress: i,
                result: {
                    stage: `Generating post ${i + 1}/${plan.length}: ${planItem.topic.slice(0, 60)}`
                },
                updatedAt: new Date()
            }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].id, jobId));
            try {
                const { itemId, qa } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$content$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["generateAndPersistContent"])({
                    workspaceId: job.workspaceId,
                    userId: job.userId,
                    input: {
                        topic: planItem.angle ? `${planItem.topic} — ${planItem.angle}` : planItem.topic,
                        objective: `Pillar: ${planItem.pillar || "general"}`,
                        platforms: [
                            "facebook",
                            "instagram"
                        ],
                        preferredFormat: planItem.format
                    }
                });
                // Verification retry: if QA failed hard, one regeneration attempt.
                let finalItemId = itemId;
                let finalQa = qa;
                if (!qa.passed) {
                    await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"]).set({
                        result: {
                            stage: `Verifying post ${i + 1}/${plan.length}`
                        },
                        updatedAt: new Date()
                    }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].id, jobId));
                    const retry = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$content$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["generateAndPersistContent"])({
                        workspaceId: job.workspaceId,
                        userId: job.userId,
                        input: {
                            topic: planItem.angle ? `${planItem.topic} — ${planItem.angle}` : planItem.topic,
                            objective: `Pillar: ${planItem.pillar || "general"}. Previous attempt failed QA (${qa.issues.map((x)=>x.message).slice(0, 3).join("; ")}). Fix those specific issues.`,
                            platforms: [
                                "facebook",
                                "instagram"
                            ],
                            preferredFormat: planItem.format
                        }
                    });
                    if (retry.qa.passed || retry.qa.score > finalQa.score) {
                        finalItemId = retry.itemId;
                        finalQa = retry.qa;
                    }
                }
                created.push(finalItemId);
                // Free deterministic brand visual for image formats
                if (planItem.format === "single_image" || planItem.format === "carousel") {
                    try {
                        const [brand] = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brands"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brands"].workspaceId, job.workspaceId));
                        const identity = brand?.visualIdentity ?? {};
                        const [visualItem] = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].id, finalItemId));
                        const logo = await fetchLogoDataUrl(job.workspaceId);
                        const png = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$visuals$2f$template$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["renderTemplateVisual"])({
                            primaryColor: identity.primaryColor ?? "#6366f1",
                            secondaryColor: identity.secondaryColor ?? "#0ea5e9",
                            headline: visualItem?.hook ?? planItem.topic,
                            subline: (visualItem?.mainCopy ?? "").slice(0, 160),
                            cta: visualItem?.cta ?? "",
                            brandName: brand?.businessName ?? "",
                            logoDataUrl: logo,
                            layout: planItem.format === "carousel" ? "promo" : "promo"
                        });
                        await storeVisual(job.workspaceId, finalItemId, png, job.userId);
                    } catch  {
                    // visual is best-effort; content still saved
                    }
                }
            } catch (e) {
                failedItems.push(`Post ${i + 1} ("${planItem.topic.slice(0, 50)}"): ${e instanceof Error ? e.message : "failed"}`);
            }
            await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"]).set({
                progress: i + 1,
                updatedAt: new Date()
            }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].id, jobId));
        }
        // ── 7. Finish ───────────────────────────────────────────────────
        if (created.length === 0) {
            await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"]).set({
                status: "failed",
                error: failedItems.slice(0, 3).join("; ") || "No posts were generated",
                result: {
                    stage: "Failed",
                    failures: failedItems
                },
                updatedAt: new Date()
            }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].id, jobId));
            await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifications"]).values({
                workspaceId: job.workspaceId,
                userId: job.userId,
                kind: "job_completed",
                title: "Bulk content plan failed",
                body: failedItems.slice(0, 2).join("; ") || "No posts were generated.",
                link: "/content-studio"
            });
            return;
        }
        await setStage(jobId, "Completed", plan.length, plan.length);
        await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"]).set({
            status: "completed",
            result: {
                stage: "Completed",
                createdCount: created.length,
                failures: failedItems,
                qaFailed: created.filter(Boolean).length - created.length
            },
            updatedAt: new Date()
        }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].id, jobId));
        await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["agentRuns"]).set({
            status: "completed",
            finishedAt: new Date()
        }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["agentRuns"].id, run.id));
        await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifications"]).values({
            workspaceId: job.workspaceId,
            userId: job.userId,
            kind: "job_completed",
            title: "Bulk content plan ready",
            body: `${created.length} of ${plan.length} posts generated and waiting for your approval${failedItems.length ? ` (${failedItems.length} failed)` : ""}.`,
            link: "/content-studio"
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Bulk plan failed";
        await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"]).set({
            status: "failed",
            error: message,
            result: {
                stage: "Failed"
            },
            updatedAt: new Date()
        }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].id, jobId));
        await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifications"]).values({
            workspaceId: job.workspaceId,
            userId: job.userId,
            kind: "job_completed",
            title: "Bulk content plan failed",
            body: message,
            link: "/content-studio"
        });
    }
}
async function fetchLogoDataUrl(workspaceId) {
    try {
        const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
        const { brandAssets } = await __turbopack_context__.A("[project]/Documents/QURTIZ AI/src/db/schema.ts [instrumentation] (ecmascript, async loader)");
        const [asset] = await db.select().from(brandAssets).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(brandAssets.workspaceId, workspaceId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(brandAssets.kind, "logo"))).orderBy((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$select$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["desc"])(brandAssets.createdAt)).limit(1);
        if (!asset) return null;
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["createClient"])();
        const { data } = await supabase.storage.from("brand-assets").download(asset.storagePath);
        if (!data) return null;
        const buf = Buffer.from(await data.arrayBuffer());
        return `data:${asset.mimeType};base64,${buf.toString("base64")}`;
    } catch  {
        return null;
    }
}
async function storeVisual(workspaceId, contentItemId, png, userId) {
    const { visualAssets } = await __turbopack_context__.A("[project]/Documents/QURTIZ AI/src/db/schema.ts [instrumentation] (ecmascript, async loader)");
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["createClient"])();
    const storagePath = `${workspaceId}/visuals/${contentItemId}-${Date.now()}.png`;
    const { error } = await supabase.storage.from("brand-assets").upload(storagePath, png, {
        contentType: "image/png"
    });
    if (error) return;
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    await db.insert(visualAssets).values({
        workspaceId,
        contentItemId,
        kind: "template",
        storagePath,
        mimeType: "image/png",
        meta: {
            model: "satori-template",
            source: "bulk"
        }
    });
    void userId;
}
async function startBulkPlanCore(args) {
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    const [ws] = await db.select({
        timezone: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["workspaces"].timezone
    }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["workspaces"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["workspaces"].id, args.workspaceId));
    void ws;
    const days = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$scheduling$2f$time$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["planContentDays"])(new Date(), args.count);
    const [job] = await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"]).values({
        workspaceId: args.workspaceId,
        userId: args.userId,
        type: "bulk_plan",
        status: "queued",
        total: args.count,
        input: {
            count: args.count,
            days,
            niche: args.niche || undefined
        }
    }).returning();
    return {
        ok: true,
        jobId: job.id
    };
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/Documents/QURTIZ AI/src/lib/ai/search-tool.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "makeWebSearchTool",
    ()=>makeWebSearchTool
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/server-only/empty.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@ai-sdk/provider-utils/dist/index.mjs [instrumentation] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/zod/v4/classic/external.js [instrumentation] (ecmascript) <export * as z>");
;
;
;
function makeWebSearchTool(ctx) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__["tool"])({
        description: "Search the live web for current information (trends, news, prices, recent events). Returns a sourced summary. Use when the user asks about anything current or external to the brand.",
        inputSchema: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
            query: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(3).max(300).describe("What to search for")
        }),
        execute: async (input)=>{
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                await ctx.logStep("web_search", input, {
                    ok: false
                });
                return {
                    searched: false,
                    message: "AI key not configured."
                };
            }
            try {
                const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + ctx.modelId + ":generateContent", {
                    method: "POST",
                    headers: {
                        "x-goog-api-key": apiKey,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        text: "Search the web and summarize concisely with source URLs: " + input.query
                                    }
                                ]
                            }
                        ],
                        tools: [
                            {
                                google_search: {}
                            }
                        ]
                    }),
                    signal: AbortSignal.timeout(60_000)
                });
                const json = await res.json();
                if (!res.ok || json.error) {
                    const msg = json.error?.message ?? "HTTP " + res.status;
                    await ctx.logStep("web_search", input, {
                        ok: false,
                        msg: msg.slice(0, 120)
                    });
                    return {
                        searched: false,
                        message: msg.toLowerCase().includes("quota") ? "Live web search is not available on the current API plan (quota). Tell the user honestly." : "Search failed: " + msg.slice(0, 200)
                    };
                }
                const text = (json.candidates?.[0]?.content?.parts ?? []).map((p)=>p.text).filter(Boolean).join("\n");
                await ctx.logStep("web_search", input, {
                    ok: true,
                    len: text.length
                });
                return {
                    searched: true,
                    summary: text.slice(0, 4000)
                };
            } catch (e) {
                return {
                    searched: false,
                    message: "Search failed: " + (e instanceof Error ? e.message : "unknown error")
                };
            }
        }
    });
}
}),
"[project]/Documents/QURTIZ AI/src/lib/ai/tools.ts [instrumentation] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "buildAgentTools",
    ()=>buildAgentTools
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/@ai-sdk/provider-utils/dist/index.mjs [instrumentation] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/zod/v4/classic/external.js [instrumentation] (ecmascript) <export * as z>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/sql/expressions/conditions.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$select$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/sql/expressions/select.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/index.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/schema.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$brand$2d$summary$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/brand-summary.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$content$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/content.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/provider.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$scheduling$2f$engine$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/scheduling/engine.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$jobs$2f$bulk$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/jobs/bulk.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$search$2d$tool$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/search-tool.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$research$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/research.ts [instrumentation] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$content$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$scheduling$2f$engine$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$jobs$2f$bulk$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$research$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$content$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$scheduling$2f$engine$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$jobs$2f$bulk$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$research$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
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
function buildAgentTools(ctx) {
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    let stepCounter = 0;
    async function logStep(toolName, input, output) {
        const idx = stepCounter++;
        try {
            await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["agentSteps"]).values({
                runId: ctx.runId,
                workspaceId: ctx.workspaceId,
                idx,
                toolName,
                input: input ?? {},
                output: output ?? {},
                status: "completed"
            });
        } catch  {
        // Logging must never break the agent turn.
        }
    }
    const getBrandBrain = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__["tool"])({
        description: "Read the Brand Brain for the current workspace: business info, audience, brand voice, visual identity, and content rules.",
        inputSchema: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({}),
        execute: async ()=>{
            const rows = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brands"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brands"].workspaceId, ctx.workspaceId));
            const summary = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$brand$2d$summary$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["summarizeBrandBrain"])(rows[0] ?? null);
            await logStep("get_brand_brain", {}, {
                summary
            });
            return {
                brandBrain: summary
            };
        }
    });
    const listWorkspaceFacts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__["tool"])({
        description: "List the active brand memory entries (preferences, facts, rules) for this workspace.",
        inputSchema: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({}),
        execute: async ()=>{
            const rows = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"].workspaceId, ctx.workspaceId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"].active, true))).orderBy((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$select$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["desc"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"].createdAt)).limit(50);
            const memories = rows.map((r)=>({
                    type: r.type,
                    content: r.content
                }));
            await logStep("list_workspace_facts", {}, {
                memories
            });
            return {
                memories
            };
        }
    });
    const updateBrandMemory = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__["tool"])({
        description: 'Save a durable brand preference, fact, or rule learned from the conversation. Use when the user says things like "remember that...", "always...", or "never use...". Confirm the save to the user afterwards.',
        inputSchema: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
            type: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].enum([
                "preference",
                "fact",
                "rule"
            ]).describe("What kind of memory this is."),
            content: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(3).max(1000).describe("The memory, written as a single clear sentence.")
        }),
        execute: async (input)=>{
            const [row] = await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"]).values({
                workspaceId: ctx.workspaceId,
                type: input.type,
                content: input.content,
                source: "chat",
                createdBy: ctx.userId
            }).returning();
            await logStep("update_brand_memory", input, {
                id: row.id
            });
            return {
                saved: true,
                id: row.id,
                message: `Saved ${input.type}: "${input.content}". You can view or remove it in Brand Brain → Memory.`
            };
        }
    });
    const createContent = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__["tool"])({
        description: "Generate one complete social media post (copy + platform-adapted variants + hashtags + CTA) for this workspace. Use when the user asks to create a post or content about a topic. The post goes to Content Studio as Ready for Review — it is NOT published.",
        inputSchema: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
            topic: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(4).max(500).describe("What the post is about"),
            platforms: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].enum([
                "facebook",
                "instagram"
            ])).min(1).describe("Target platforms"),
            objective: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(300).optional().describe("e.g. engagement, leads, sales")
        }),
        execute: async (input)=>{
            const { itemId, qa } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$content$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["generateAndPersistContent"])({
                workspaceId: ctx.workspaceId,
                userId: ctx.userId,
                input: {
                    topic: input.topic,
                    objective: input.objective ?? null,
                    platforms: input.platforms,
                    preferredFormat: null
                }
            });
            await logStep("create_content", input, {
                itemId,
                qaScore: qa.score
            });
            return {
                created: true,
                itemId,
                qaScore: qa.score,
                qaIssues: qa.issues,
                message: `Content created (QA ${qa.score}/100) and saved to Content Studio as ${qa.passed ? "Ready for Review" : "Draft (QA issues found)"}.`
            };
        }
    });
    const researchNiche = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__["tool"])({
        description: "Research content opportunities for a niche or topic: finds topics, scores opportunities (AI-estimated), and saves them to the Research Lab. Use when the user asks what to post about, trends in their niche, or content ideas.",
        inputSchema: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
            niche: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(4).max(300).describe("The niche, topic, or business area to research"),
            notes: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(1000).optional().describe("Optional focus from the user")
        }),
        execute: async (input)=>{
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$research$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["researchTopics"])({
                workspaceId: ctx.workspaceId,
                userId: ctx.userId,
                niche: input.niche,
                notes: input.notes ?? null
            });
            await logStep("research_niche", input, {
                ok: result.ok,
                count: result.ok ? result.count : undefined
            });
            if (!result.ok) return {
                found: false,
                message: result.message
            };
            return {
                found: true,
                count: result.count,
                sourced: result.sourced,
                message: `${result.count} opportunities saved to the Research Lab${result.sourced ? " with live web sources" : " (AI estimates — no live sources on current plan)"}.`
            };
        }
    });
    const scheduleContent = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__["tool"])({
        description: "Schedule an existing content item for publishing on a specific date (and optional time, default 18:30 workspace time). Use after create_content when the user names a date/time. Publishing requires connected accounts; scheduling itself always works.",
        inputSchema: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
            itemId: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().uuid().optional().describe("The content item id (returned by create_content). If omitted, the most recent Ready-for-Review item is used."),
            date: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Schedule date, YYYY-MM-DD"),
            time: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().regex(/^\d{2}:\d{2}$/).optional().describe("Optional time HH:mm in workspace timezone")
        }),
        execute: async (input)=>{
            const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
            let itemId = input.itemId ?? null;
            if (!itemId) {
                const latest = await db.select({
                    id: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].id,
                    status: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].status,
                    createdAt: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].createdAt
                }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].workspaceId, ctx.workspaceId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].status, "ready_for_review"))).orderBy((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$select$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["desc"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].createdAt)).limit(1);
                if (latest.length === 0) {
                    await logStep("schedule_content", input, {
                        ok: false
                    });
                    return {
                        scheduled: false,
                        message: "No Ready-for-Review content found. Create content first."
                    };
                }
                itemId = latest[0].id ?? null;
            }
            const [ws] = await db.select({
                timezone: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["workspaces"].timezone
            }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["workspaces"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["workspaces"].id, ctx.workspaceId));
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$scheduling$2f$engine$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["scheduleItem"])({
                workspaceId: ctx.workspaceId,
                itemId,
                dateIso: input.date,
                timeStr: input.time,
                timezone: ws?.timezone ?? "Asia/Karachi"
            });
            await logStep("schedule_content", input, {
                ok: result.ok
            });
            if (!result.ok) return {
                scheduled: false,
                message: result.message
            };
            return {
                scheduled: true,
                scheduledAt: result.scheduledAt.toISOString(),
                variants: result.variants,
                message: `Scheduled for ${input.date} ${input.time ?? "18:30"} (workspace time) across ${result.variants} platform variants. It will publish automatically if the platform is connected.`
            };
        }
    });
    const bulkPlan = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__["tool"])({
        description: "Create a bulk content plan: generate multiple posts (6-30) spread over upcoming weekdays via the background pipeline. Each post is brand-context aware, QA-verified, and lands in Content Studio as Ready for Review. Use when the user asks for many posts at once (e.g. 'create 12 posts', 'content for next month').",
        inputSchema: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
            count: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].number().int().min(4).max(30).default(12).describe("How many posts to generate"),
            niche: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(300).optional().describe("Optional focus for the plan")
        }),
        execute: async (input)=>{
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$jobs$2f$bulk$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["startBulkPlanCore"])({
                workspaceId: ctx.workspaceId,
                userId: ctx.userId,
                count: input.count,
                niche: input.niche
            });
            await logStep("bulk_plan", input, {
                ok: result.ok,
                jobId: result.ok ? result.jobId : undefined
            });
            if (!result.ok) return {
                queued: false,
                message: result.error
            };
            return {
                queued: true,
                jobId: result.jobId,
                message: "Bulk plan queued. Posts generate in the background and appear in Content Studio as Ready for Review."
            };
        }
    });
    return {
        get_brand_brain: getBrandBrain,
        research_niche: researchNiche,
        create_content: createContent,
        schedule_content: scheduleContent,
        web_search: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$search$2d$tool$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["makeWebSearchTool"])({
            logStep,
            modelId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getModelId"])()
        }),
        bulk_plan: bulkPlan,
        list_workspace_facts: listWorkspaceFacts,
        update_brand_memory: updateBrandMemory
    };
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/Documents/QURTIZ AI/src/lib/ai/scores.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "overallOpportunity",
    ()=>overallOpportunity
]);
function overallOpportunity(s) {
    const weighted = s.trend * 0.15 + s.audience * 0.2 + s.search * 0.1 + (10 - s.competition) * 0.1 + s.business * 0.2 + s.viral * 0.15 + s.conversion * 0.1;
    return Math.round(weighted * 10) / 10;
}
}),
"[project]/Documents/QURTIZ AI/src/lib/ai/research-types.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "topicScoresSchema",
    ()=>topicScoresSchema
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/zod/v4/classic/external.js [instrumentation] (ecmascript) <export * as z>");
;
const topicScoresSchema = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    trend: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].number().min(0).max(10),
    audience: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].number().min(0).max(10),
    search: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].number().min(0).max(10),
    competition: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].number().min(0).max(10),
    business: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].number().min(0).max(10),
    viral: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].number().min(0).max(10),
    conversion: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].number().min(0).max(10)
});
}),
"[project]/Documents/QURTIZ AI/src/lib/ai/research.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "researchTopics",
    ()=>researchTopics
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$ai$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/ai/dist/index.mjs [instrumentation] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/zod/v4/classic/external.js [instrumentation] (ecmascript) <export * as z>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/sql/expressions/conditions.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/index.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/schema.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/provider.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$tools$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/tools.ts [instrumentation] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$brand$2d$summary$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/brand-summary.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$scores$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/scores.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$research$2d$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/research-types.ts [instrumentation] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$tools$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$tools$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
;
;
;
;
const researchedTopicSchema = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    topic: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(4).max(200),
    angle: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(300).default(""),
    summary: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(1000).default(""),
    category: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(60).default("topic"),
    scores: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$research$2d$types$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["topicScoresSchema"],
    recommendedFormats: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].enum([
        "single_image",
        "carousel",
        "reel",
        "story",
        "text_post"
    ])).max(4).default([]),
    sourceUrls: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().url()).max(3).default([])
});
function extractJson(text) {
    const stripped = text.replace(/```json|```/g, "").trim();
    const start = stripped.indexOf("[");
    const end = stripped.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) throw new Error("No JSON array in model response");
    return JSON.parse(stripped.slice(start, end + 1));
}
async function groundedSources(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return [];
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getModelId"])()}:generateContent`, {
            method: "POST",
            headers: {
                "x-goog-api-key": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ],
                tools: [
                    {
                        google_search: {}
                    }
                ]
            }),
            signal: AbortSignal.timeout(90_000)
        });
        if (!res.ok) return [];
        const json = await res.json();
        return (json.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []).map((c)=>({
                url: c.web?.uri ?? "",
                title: c.web?.title ?? ""
            })).filter((s)=>s.url);
    } catch  {
        return [];
    }
}
async function researchTopics(ctx) {
    const model = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getModel"])();
    if (!model) return {
        ok: false,
        reason: "config",
        message: "AI is not configured (GEMINI_API_KEY missing)."
    };
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    const [brand] = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brands"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brands"].workspaceId, ctx.workspaceId));
    const memories = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"].workspaceId, ctx.workspaceId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["brandMemory"].active, true))).limit(40);
    const [run] = await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["agentRuns"]).values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        kind: "research",
        model: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getModelId"])()
    }).returning();
    const system = `You are the QURTIZ AI research analyst for "${brand?.businessName ?? ctx.workspaceId}".
Business context: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$brand$2d$summary$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["summarizeBrandBrain"])(brand ?? null)}
Active brand memory: ${memories.map((m)=>m.content).join("; ") || "(none)"}

Find concrete, specific social-media content opportunities. Never invent source URLs.
Scores are 0-10 integers. competition is INVERTED: 10 = very low competition.
Reply with ONLY a JSON array, 6 items, each: {"topic","angle","summary","category","scores":{"trend","audience","search","competition","business","viral","conversion"},"recommendedFormats":["carousel"|"reel"|"single_image"|"text_post"|"story"],"sourceUrls":[]}
sourceUrls: ONLY real URLs you are confident exist from search results; empty array if you have none.`;
    const userPrompt = `Niche/topic to research: ${ctx.niche}
${ctx.notes ? `Extra context from the user: ${ctx.notes}` : ""}
Research content opportunities: trending angles, audience questions, content gaps, seasonal hooks.`;
    // Attempt grounded (live) research; fall back honestly when quota blocks it.
    let sourced = false;
    let note;
    let rawTopics = [];
    try {
        const grounded = await groundedSources(userPrompt);
        const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$ai$2f$dist$2f$index$2e$mjs__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$locals$3e$__["generateText"])({
            model,
            system,
            prompt: grounded.length > 0 ? `${userPrompt}\n\nUse this live web context (cite only URLs from it):\n${grounded.map((s)=>`- ${s.title}: ${s.url}`).join("\n")}` : userPrompt,
            maxOutputTokens: 4096
        });
        try {
            await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["agentRuns"]).set({
                status: "completed",
                inputTokens: res.usage?.inputTokens ?? null,
                outputTokens: res.usage?.outputTokens ?? null,
                costUsd: res.usage ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["estimateCostFromUsage"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$provider$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getModelId"])(), res.usage).toFixed(6) : null,
                finishedAt: new Date()
            }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["agentRuns"].id, run.id));
        } catch  {
        // bookkeeping only
        }
        const parsed = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].array(researchedTopicSchema).safeParse(extractJson(res.text));
        if (!parsed.success) throw new Error("Model returned malformed topics JSON");
        rawTopics = parsed.data;
        // Attach grounded sources when we actually have them.
        if (grounded.length > 0) {
            sourced = true;
            rawTopics = rawTopics.map((t, i)=>({
                    ...t,
                    sourceUrls: t.sourceUrls.length > 0 ? t.sourceUrls : [
                        grounded[i % grounded.length].url
                    ]
                }));
        } else {
            note = "Live web search unavailable on the current API plan — topics are AI-knowledge estimates without live sources. Enable billing or add a search API key for sourced research.";
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Research failed";
        try {
            await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["agentRuns"]).set({
                status: "failed",
                error: message,
                finishedAt: new Date()
            }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["agentRuns"].id, run.id));
        } catch  {}
        return {
            ok: false,
            reason: "api_error",
            message
        };
    }
    if (rawTopics.length === 0) return {
        ok: false,
        reason: "empty",
        message: "No topics were produced — try a more specific niche."
    };
    await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["researchItems"]).values(rawTopics.map((t)=>({
            workspaceId: ctx.workspaceId,
            topic: t.topic,
            summary: t.angle ? `${t.angle}\n\n${t.summary}` : t.summary,
            sourceUrl: t.sourceUrls[0] ?? null,
            sourceName: t.sourceUrls[0] ? new URL(t.sourceUrls[0]).hostname : sourced ? "web" : "AI knowledge",
            category: t.category,
            scores: {
                ...t.scores,
                overall: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$scores$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["overallOpportunity"])(t.scores),
                estimated: true
            },
            recommendedFormats: t.recommendedFormats,
            status: "new",
            createdBy: ctx.userId
        })));
    return {
        ok: true,
        sourced,
        note,
        count: rawTopics.length
    };
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/Documents/QURTIZ AI/src/lib/jobs/workflows.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "registerWorkers",
    ()=>registerWorkers
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/next/dist/compiled/server-only/empty.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/sql/expressions/conditions.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$select$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/node_modules/drizzle-orm/sql/expressions/select.js [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/index.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/db/schema.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$jobs$2f$boss$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/jobs/boss.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$crypto$2f$tokens$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/crypto/tokens.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$publish$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/meta/publish.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$analytics$2f$sync$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/analytics/sync.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$research$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/research.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$scheduling$2f$time$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/scheduling/time.ts [instrumentation] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$content$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/QURTIZ AI/src/lib/ai/content.ts [instrumentation] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$jobs$2f$boss$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$analytics$2f$sync$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$research$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$content$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$jobs$2f$boss$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$analytics$2f$sync$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$research$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$content$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
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
/**
 * Attempt to publish one due publishing job. M4 will provide the real Meta
 * adapters; until then this fails HONESTLY with a clear reason so the UI
 * shows a genuine failure state instead of pretending success.
 */ async function attemptPublish(publishingJobId) {
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    const [job] = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].id, publishingJobId));
    if (!job || job.status !== "pending") return;
    await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"]).set({
        status: "processing",
        attempts: job.attempts + 1,
        updatedAt: new Date()
    }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].id, job.id));
    const [conn] = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["platformConnections"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["platformConnections"].workspaceId, job.workspaceId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["platformConnections"].platform, job.platform)));
    if (!conn || conn.status !== "connected" || !conn.encryptedToken) {
        const reason = `${job.platform === "facebook" ? "Facebook Page" : "Instagram"} is not connected. Connect it on the Connections page${process.env.META_APP_ID ? "" : " (Meta app credentials missing in .env.local)"}.`;
        await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"]).set({
            status: "failed",
            lastError: reason,
            updatedAt: new Date()
        }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].id, job.id));
        await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifications"]).values({
            workspaceId: job.workspaceId,
            userId: job.workspaceId,
            kind: "publishing_failed",
            title: "Publishing failed",
            body: reason,
            link: "/connections"
        });
        return;
    }
    // Load variant + item + latest visual
    const [variant] = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"].id, job.contentVariantId));
    if (!variant) {
        await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"]).set({
            status: "failed",
            lastError: "Variant not found.",
            updatedAt: new Date()
        }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].id, job.id));
        return;
    }
    const [item] = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].id, variant.contentItemId));
    // Latest template or AI visual for this item
    const [visual] = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["visualAssets"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["visualAssets"].contentItemId, variant.contentItemId)).orderBy((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$select$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["desc"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["visualAssets"].createdAt)).limit(1);
    // Signed public URL for the image (IG requires a reachable URL)
    let imageUrl = null;
    if (visual) {
        const { createClient } = await __turbopack_context__.A("[project]/Documents/QURTIZ AI/src/lib/supabase/server.ts [instrumentation] (ecmascript, async loader)");
        const supabase = await createClient();
        const { data } = await supabase.storage.from("brand-assets").createSignedUrl(visual.storagePath, 60 * 60 * 24 * 6);
        imageUrl = data?.signedUrl ?? null;
    }
    const token = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$crypto$2f$tokens$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["decryptToken"])(conn.encryptedToken);
    if (!token) {
        const reason = "Stored access token could not be decrypted — reconnect the account.";
        await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"]).set({
            status: "failed",
            lastError: reason,
            updatedAt: new Date()
        }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].id, job.id));
        await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifications"]).values({
            workspaceId: job.workspaceId,
            userId: job.workspaceId,
            kind: "auth_expired",
            title: "Reconnection required",
            body: reason,
            link: "/connections"
        });
        return;
    }
    const meta = conn.meta ?? {};
    const message = [
        item?.caption ?? variant.caption,
        (variant.hashtags ?? []).map((h)=>`#${h}`).join(" ")
    ].filter(Boolean).join("\n\n");
    const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$meta$2f$publish$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishPost"])({
        pageToken: token,
        pageId: conn.platform === "instagram" ? String(meta.pageId ?? "") : String(meta.pageId ?? ""),
        igUserId: meta.igUserId ?? null,
        platform: job.platform,
        message,
        imageUrl
    });
    if (result.ok) {
        await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"]).set({
            status: "published",
            result: {
                postId: result.postId,
                permalink: result.permalink
            },
            updatedAt: new Date()
        }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].id, job.id));
        await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"]).set({
            status: "published",
            updatedAt: new Date()
        }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"].id, variant.id));
        const allPublished = (await db.select({
            status: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"].status
        }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"].contentItemId, variant.contentItemId))).every((v)=>v.status === "published");
        if (allPublished) {
            await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"]).set({
                status: "published",
                publishedAt: new Date(),
                updatedAt: new Date()
            }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].id, variant.contentItemId));
        }
        await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifications"]).values({
            workspaceId: job.workspaceId,
            userId: job.workspaceId,
            kind: "publishing_completed",
            title: "Published successfully",
            body: `${job.platform === "facebook" ? "Facebook" : "Instagram"} post is live${result.permalink ? `: ${result.permalink}` : "."}`,
            link: "/content-studio"
        });
    } else {
        await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"]).set({
            status: "failed",
            lastError: result.message,
            updatedAt: new Date()
        }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].id, job.id));
        await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifications"]).values({
            workspaceId: job.workspaceId,
            userId: job.workspaceId,
            kind: "publishing_failed",
            title: "Publishing failed",
            body: result.message,
            link: "/content-studio"
        });
    }
}
/** Scan for due publishing jobs (runs every minute via pg-boss cron). */ async function publishDueScan() {
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    const due = await db.select({
        id: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].id
    }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].status, "pending"), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["lte"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"].scheduledAt, new Date()))).limit(10);
    for (const j of due){
        await attemptPublish(j.id);
    }
}
/**
 * Bulk content plan: delegates to the staged pipeline in lib/jobs/bulk.ts.
 */ async function bulkGenerate(jobId) {
    const { runBulkPlan } = await __turbopack_context__.A("[project]/Documents/QURTIZ AI/src/lib/jobs/bulk.ts [instrumentation] (ecmascript, async loader)");
    await runBulkPlan(jobId);
}
/**
 * Campaign generation: produce content for each day of the arc.
 */ async function generateCampaign(campaignId) {
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    const [campaign] = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["campaigns"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["campaigns"].id, campaignId));
    if (!campaign || campaign.status !== "generating") return;
    const days = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["campaignItems"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["campaignItems"].campaignId, campaignId));
    const pending = days.filter((d)=>!d.contentItemId).sort((a, b)=>a.dayIndex - b.dayIndex);
    const platforms = campaign.platforms ?? [
        "facebook",
        "instagram"
    ];
    for (const day of pending){
        try {
            const { itemId } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$content$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["generateAndPersistContent"])({
                workspaceId: campaign.workspaceId,
                userId: campaign.createdBy ?? campaign.workspaceId,
                input: {
                    topic: "Campaign \"" + campaign.name + "\" - Day " + day.dayIndex + ": " + day.theme + (campaign.offer ? " (offer: " + campaign.offer + ")" : ""),
                    objective: "Campaign day " + day.dayIndex + "/" + campaign.durationDays + ": " + day.theme,
                    platforms,
                    preferredFormat: null
                }
            });
            await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["campaignItems"]).set({
                contentItemId: itemId
            }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["campaignItems"].id, day.id));
        } catch (e) {
            console.error("[campaign] day failed", e instanceof Error ? e.message : e);
        }
    }
    await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["campaigns"]).set({
        status: "active",
        updatedAt: new Date()
    }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["campaigns"].id, campaignId));
    await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifications"]).values({
        workspaceId: campaign.workspaceId,
        userId: campaign.createdBy ?? campaign.workspaceId,
        kind: "job_completed",
        title: "Campaign content ready",
        body: pending.length + " posts generated.",
        link: "/campaigns"
    });
}
/**
 * Daily autonomous loop for workspaces with autopilot enabled.
 * Guardrails: max posts per run (1-3), approval default on, one slot per day.
 */ async function autopilotLoop() {
    const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
    const rows = await db.select({
        workspaceId: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["settings"].workspaceId,
        value: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["settings"].value
    }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["settings"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["settings"].key, "autopilot"));
    for (const row of rows){
        const cfg = row.value ?? {};
        if (!cfg.enabled) continue;
        try {
            const [ws] = await db.select({
                createdBy: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["workspaces"].createdBy,
                timezone: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["workspaces"].timezone
            }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["workspaces"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["workspaces"].id, row.workspaceId));
            if (!ws) continue;
            const research = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$research$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["researchTopics"])({
                workspaceId: row.workspaceId,
                userId: ws.createdBy,
                niche: cfg.nicheFocus || "the brand's niche",
                notes: "Autopilot daily loop"
            });
            if (!research.ok) continue;
            const items = await db.select().from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["researchItems"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["researchItems"].workspaceId, row.workspaceId), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["researchItems"].status, "new")));
            const top = items.map((i)=>({
                    item: i,
                    score: (i.scores ?? {}).overall ?? 0
                })).sort((a, b)=>b.score - a.score).slice(0, cfg.maxPostsPerRun ?? 1);
            for (const t of top){
                const { itemId } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$ai$2f$content$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["generateAndPersistContent"])({
                    workspaceId: row.workspaceId,
                    userId: ws.createdBy,
                    input: {
                        topic: t.item.topic,
                        objective: "Autopilot daily plan",
                        platforms: [
                            "facebook",
                            "instagram"
                        ],
                        preferredFormat: null
                    }
                });
                await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["researchItems"]).set({
                    status: "converted",
                    updatedAt: new Date()
                }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["researchItems"].id, t.item.id));
                if (cfg.requireApproval === false) {
                    await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"]).set({
                        status: "approved",
                        updatedAt: new Date()
                    }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].id, itemId));
                    await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"]).set({
                        status: "approved",
                        updatedAt: new Date()
                    }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"].contentItemId, itemId));
                    const slot = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$scheduling$2f$time$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["defaultSlotFor"])(new Date(Date.now() + 86400000).toISOString().slice(0, 10), ws.timezone);
                    const variants = await db.select({
                        id: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"].id,
                        platform: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"].platform
                    }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentVariants"].contentItemId, itemId));
                    for (const v of variants){
                        await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["publishingJobs"]).values({
                            workspaceId: row.workspaceId,
                            contentItemId: itemId,
                            contentVariantId: v.id,
                            platform: v.platform,
                            scheduledAt: slot
                        });
                    }
                    await db.update(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"]).set({
                        status: "scheduled",
                        scheduledAt: slot,
                        updatedAt: new Date()
                    }).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["contentItems"].id, itemId));
                    await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifications"]).values({
                        workspaceId: row.workspaceId,
                        userId: ws.createdBy,
                        kind: "content_ready",
                        title: "Autopilot scheduled a post",
                        body: "Tomorrow at 18:30: " + t.item.topic,
                        link: "/calendar"
                    });
                } else {
                    await db.insert(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["notifications"]).values({
                        workspaceId: row.workspaceId,
                        userId: ws.createdBy,
                        kind: "content_ready",
                        title: "Autopilot created content for review",
                        body: t.item.topic,
                        link: "/content-studio"
                    });
                }
            }
        } catch (e) {
            console.error("[autopilot]", e instanceof Error ? e.message : e);
        }
    }
}
async function registerWorkers(boss) {
    await boss.work(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$jobs$2f$boss$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUES"].publishScan, async ()=>{
        await publishDueScan();
    });
    await boss.work(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$jobs$2f$boss$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUES"].bulkGenerate, async ()=>{
        // Payload-independent: process every queued bulk_plan row (oldest first).
        // This survives any handler-payload shape differences across pg-boss versions.
        const db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$index$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["getDb"])();
        const queued = await db.select({
            id: __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].id
        }).from(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"]).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["and"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].type, "bulk_plan"), (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].status, "queued"))).orderBy((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$select$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["asc"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$db$2f$schema$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["jobs"].createdAt)).limit(5);
        for (const row of queued){
            await bulkGenerate(row.id);
        }
    });
    await boss.work(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$jobs$2f$boss$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUES"].campaignGenerate, async (job)=>{
        const data = job.data;
        if (data?.campaignId) await generateCampaign(data.campaignId);
    });
    await boss.work(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$jobs$2f$boss$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUES"].syncInsights, async ()=>{
        // The cron schedule passes workspace scoping by iterating all connected
        // workspaces via platform_connections (service-style scan).
        const { getDb } = await __turbopack_context__.A("[project]/Documents/QURTIZ AI/src/db/index.ts [instrumentation] (ecmascript, async loader)");
        const { platformConnections } = await __turbopack_context__.A("[project]/Documents/QURTIZ AI/src/db/schema.ts [instrumentation] (ecmascript, async loader)");
        const db = getDb();
        const conns = await db.selectDistinct({
            workspaceId: platformConnections.workspaceId
        }).from(platformConnections).where((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$node_modules$2f$drizzle$2d$orm$2f$sql$2f$expressions$2f$conditions$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["eq"])(platformConnections.status, "connected"));
        for (const row of conns){
            try {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$analytics$2f$sync$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["syncInsightsForWorkspace"])(row.workspaceId);
            } catch (e) {
                console.error("[sync-insights]", e instanceof Error ? e.message : e);
            }
        }
    });
    await boss.work(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$jobs$2f$boss$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUES"].autopilotLoop, async ()=>{
        await autopilotLoop();
    });
    await boss.work(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$jobs$2f$boss$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUES"].campaignGenerate, async (job)=>{
        const data = job.data;
        if (data?.campaignId) await generateCampaign(data.campaignId);
    });
    await boss.work(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$QURTIZ__AI$2f$src$2f$lib$2f$jobs$2f$boss$2e$ts__$5b$instrumentation$5d$__$28$ecmascript$29$__["QUEUES"].autopilotLoop, async ()=>{
        await autopilotLoop();
    });
    console.log("[qurtiz] workers registered");
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__9b58fbb0._.js.map