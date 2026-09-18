import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ── Enums ─────────────────────────────────────────────────────────── */

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "editor",
  "viewer",
]);

export const contentStatusEnum = pgEnum("content_status", [
  "draft",
  "generating",
  "ready_for_review",
  "approved",
  "rejected",
  "scheduled",
  "published",
  "failed",
  "archived",
]);

export const brandMemoryTypeEnum = pgEnum("brand_memory_type", [
  "preference",
  "fact",
  "rule",
]);

export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const platformEnum = pgEnum("platform", ["facebook", "instagram"]);

export const platformConnectionStatusEnum = pgEnum(
  "platform_connection_status",
  ["not_connected", "connected", "expired", "error"],
);

export const contentFormatEnum = pgEnum("content_format", [
  "single_image",
  "carousel",
  "reel",
  "story",
  "text_post",
]);

export const contentVariantStatusEnum = pgEnum("content_variant_status", [
  "generating",
  "ready_for_review",
  "approved",
  "scheduled",
  "published",
  "failed",
  "archived",
]);

/* ── Identity & workspaces ─────────────────────────────────────────── */

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    timezone: text("timezone").notNull().default("Asia/Karachi"),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("workspaces_slug_uq").on(t.slug)],
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: workspaceRoleEnum("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("workspace_members_ws_user_uq").on(t.workspaceId, t.userId),
    index("workspace_members_user_idx").on(t.userId),
  ],
);

export const settings = pgTable(
  "settings",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
);

/* ── Workspace AI config (BYOK, Phase 1) ─────────────────────────────
   Each workspace owns its own AI provider/model/keys. Keys are encrypted
   at rest (AES-256-GCM via lib/crypto/tokens) and never leave the server
   unmasked. Resolution happens at runtime from this single row; there is
   NO production fallback to a shared GEMINI_API_KEY (that would mix
   tenants). See lib/ai/config.ts + lib/ai/provider.ts. */

export const workspaceAiConfig = pgTable(
  "workspace_ai_config",
  {
    workspaceId: uuid("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    textProvider: text("text_provider").notNull(),
    textModel: text("text_model").notNull(),
    textBaseUrl: text("text_base_url"),
    textApiKeyEnc: text("text_api_key_enc").notNull(),
    imageProvider: text("image_provider").notNull(),
    imageModel: text("image_model").notNull(),
    imageBaseUrl: text("image_base_url"),
    imageApiKeyEnc: text("image_api_key_enc").notNull(),
    taskOverrides: jsonb("task_overrides").$type<import("@/lib/ai/provider").AiTaskOverrides>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

/* ── Brand Brain ───────────────────────────────────────────────────── */

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    businessName: text("business_name"),
    description: text("description"),
    industry: text("industry"),
    products: text("products"),
    services: text("services"),
    pricing: text("pricing"),
    offers: text("offers"),
    locations: text("locations"),
    website: text("website"),
    contact: text("contact"),
    cta: text("cta"),
    targetMarket: text("target_market"),
    audience: jsonb("audience").notNull().default({}),
    voicePresets: text("voice_presets").array().notNull().default([]),
    voiceCustom: text("voice_custom"),
    visualIdentity: jsonb("visual_identity").notNull().default({}),
    contentRules: jsonb("content_rules").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("brands_workspace_uq").on(t.workspaceId)],
);

export const brandMemory = pgTable(
  "brand_memory",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: brandMemoryTypeEnum("type").notNull(),
    memoryKey: text("memory_key"),
    category: text("category").notNull().default("general"),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    content: text("content").notNull(),
    source: text("source").notNull().default("chat"),
    confidence: real("confidence").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("brand_memory_ws_idx").on(t.workspaceId, t.createdAt),
    uniqueIndex("brand_memory_active_key_uq").on(t.workspaceId, t.memoryKey).where(sql`${t.active} AND ${t.deletedAt} IS NULL`)],
);

export const agentIdentities = pgTable("agent_identities", {
  version: integer("version").primaryKey(),
  instructions: text("instructions").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceAgentProfiles = pgTable("workspace_agent_profiles", {
  workspaceId: uuid("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  operatingInstructions: text("operating_instructions").notNull().default(""),
  strategy: text("strategy").notNull().default(""),
  workflow: text("workflow").notNull().default(""),
  platforms: text("platforms").notNull().default(""),
  updatedBy: uuid("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userAgentMemories = pgTable("user_agent_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  memoryKey: text("memory_key").notNull(),
  category: text("category").notNull().default("general"),
  type: brandMemoryTypeEnum("type").notNull(),
  content: text("content").notNull(),
  source: text("source").notNull(),
  confidence: real("confidence").notNull().default(1),
  active: boolean("active").notNull().default(true),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("user_agent_memories_scope_idx").on(t.workspaceId, t.userId, t.active),
  uniqueIndex("user_agent_memories_active_key_uq").on(t.workspaceId, t.userId, t.memoryKey).where(sql`${t.active}`),
  foreignKey({ columns: [t.workspaceId, t.userId], foreignColumns: [workspaceMembers.workspaceId, workspaceMembers.userId] }).onDelete("cascade"),
]);

/* ── Connections (schema now, features in M4) ──────────────────────── */

export const platformConnections = pgTable(
  "platform_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    // Publishing provider that owns this row: "meta" (direct Meta Graph
    // publishing, the original behavior) or "buffer" (Buffer OAuth queue).
    // A workspace may hold both rows for one platform — one per provider —
    // and publishing jobs snapshot the provider they were created under.
    provider: text("provider").notNull().default("meta"),
    status: platformConnectionStatusEnum("status").notNull().default("not_connected"),
    // External channel id on the provider ("buffer" → Buffer profile id).
    channelRef: text("channel_ref"),
    meta: jsonb("meta").notNull().default({}),
    encryptedToken: text("encrypted_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("platform_connections_ws_platform_provider_uq").on(
      t.workspaceId,
      t.platform,
      t.provider,
    ),
  ],
);

/* ── AI chat & agent runs ──────────────────────────────────────────── */

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull().default("New chat"),
    context: jsonb("context"),
    pinned: boolean("pinned").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("chat_threads_ws_idx").on(t.workspaceId, t.updatedAt)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull().default(""),
    message: jsonb("message").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_thread_idx").on(t.threadId, t.createdAt)],
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    kind: text("kind").notNull().default("chat"),
    status: agentRunStatusEnum("status").notNull().default("running"),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("agent_runs_ws_idx").on(t.workspaceId, t.startedAt)],
);

export const agentSteps = pgTable(
  "agent_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    toolName: text("tool_name"),
    input: jsonb("input").notNull().default({}),
    output: jsonb("output").notNull().default({}),
    durationMs: integer("duration_ms"),
    status: text("status").notNull().default("completed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agent_steps_run_idx").on(t.runId, t.idx)],
);

/* ── Content engine (M2) ───────────────────────────────────────────── */

export const contentPillars = pgTable(
  "content_pillars",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    targetShare: integer("target_share").notNull().default(20),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("content_pillars_ws_idx").on(t.workspaceId, t.active)],
);

export const researchItems = pgTable(
  "research_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    summary: text("summary").notNull().default(""),
    sourceUrl: text("source_url"),
    sourceName: text("source_name"),
    category: text("category"),
    scores: jsonb("scores").notNull().default({}),
    recommendedFormats: text("recommended_formats").array().notNull().default([]),
    status: text("status").notNull().default("new"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("research_items_ws_idx").on(t.workspaceId, t.createdAt)],
);

export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    objective: text("objective"),
    pillarId: uuid("pillar_id").references(() => contentPillars.id, { onDelete: "set null" }),
    format: contentFormatEnum("format").notNull().default("single_image"),
    hook: text("hook"),
    mainCopy: text("main_copy"),
    caption: text("caption"),
    cta: text("cta"),
    firstComment: text("first_comment"),
    hashtags: text("hashtags").array().notNull().default([]),
    keywords: text("keywords").array().notNull().default([]),
    visualConcept: text("visual_concept"),
    internalEdits: jsonb("internal_edits").notNull().default({}),
    aiScores: jsonb("ai_scores").notNull().default({}),
    qa: jsonb("qa").notNull().default({}),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    researchItemId: uuid("research_item_id"),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("content_items_ws_status_idx").on(t.workspaceId, t.status)],
);

export const contentVariants = pgTable(
  "content_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    format: contentFormatEnum("format").notNull(),
    caption: text("caption").notNull().default(""),
    script: jsonb("script").notNull().default({}),
    hashtags: text("hashtags").array().notNull().default([]),
    firstComment: text("first_comment"),
    slides: jsonb("slides").notNull().default([]),
    cta: text("cta"),
    status: contentVariantStatusEnum("status").notNull().default("generating"),
    qa: jsonb("qa").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("content_variants_item_idx").on(t.contentItemId, t.platform)],
);

/* ── Brand assets & visuals (M2c) ──────────────────────────────────── */

export const brandAssetKindEnum = pgEnum("brand_asset_kind", [
  "logo",
  "avatar",
  "reference",
]);

export const brandAssets = pgTable(
  "brand_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: brandAssetKindEnum("kind").notNull(),
    label: text("label"),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Media-lifecycle columns added in 0026. Existing rows are treated as
    // permanent (refCount=1, no grace period) so legacy uploads stay live.
    refCount: integer("ref_count").notNull().default(1),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    cleanupStatus: text("cleanup_status").notNull().default("permanent"),
    cleanupEligibleAt: timestamp("cleanup_eligible_at", { withTimezone: true }),
  },
  (t) => [index("brand_assets_ws_idx").on(t.workspaceId, t.kind)],
);

export const visualAssets = pgTable(
  "visual_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("template"),
    slideIndex: integer("slide_index"),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull().default("image/png"),
    width: integer("width"),
    height: integer("height"),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Media-lifecycle columns added in 0026. Same defaults as brand_assets:
    // existing rows are permanent, refCount=1, no grace period.
    refCount: integer("ref_count").notNull().default(1),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    cleanupStatus: text("cleanup_status").notNull().default("permanent"),
    cleanupEligibleAt: timestamp("cleanup_eligible_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
  },
  (t) => [index("visual_assets_item_idx").on(t.contentItemId, t.createdAt)],
);

/* ── Jobs, publishing & notifications (M3) ─────────────────────────── */

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    type: text("type").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    total: integer("total").notNull().default(0),
    input: jsonb("input").notNull().default({}),
    result: jsonb("result").notNull().default({}),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("jobs_ws_idx").on(t.workspaceId, t.createdAt)],
);

export const publishingJobStatusEnum = pgEnum("publishing_job_status", [
  "pending",
  "processing",
  "published",
  "failed",
  "cancelled",
]);

export const publishingJobs = pgTable(
  "publishing_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    contentVariantId: uuid("content_variant_id")
      .notNull()
      .references(() => contentVariants.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    // Provider selected when the job is created. The worker re-resolves the
    // live healthy connection at execution time and updates this audit field
    // before sending when failover changes the route.
    provider: text("provider").notNull().default("meta"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: publishingJobStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    /** Platform-side post/update id returned by the provider (Buffer's
     *  createPost `post.id` or Meta's `postId`). Used for client-side
     *  idempotency on retry: a row already carrying a providerPostId has
     *  been accepted by the platform and must not be re-created. */
    providerPostId: text("provider_post_id"),
    result: jsonb("result").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("publishing_jobs_due_idx").on(t.status, t.scheduledAt),
    index("publishing_jobs_provider_post_id_idx").on(t.providerPostId),
  ],
);

export const notificationKindEnum = pgEnum("notification_kind", [
  "content_ready",
  "generation_completed",
  "publishing_completed",
  "publishing_failed",
  "auth_expired",
  "job_completed",
  "system",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    kind: notificationKindEnum("kind").notNull().default("system"),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_ws_idx").on(t.workspaceId, t.createdAt)],
);

/* ── Campaigns (M3) ────────────────────────────────────────────────── */

export const campaignStatusEnum = pgEnum("campaign_status", [
  "planning",
  "generating",
  "active",
  "completed",
  "cancelled",
]);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    goal: text("goal"),
    offer: text("offer"),
    audience: text("audience"),
    durationDays: integer("duration_days").notNull().default(7),
    platforms: text("platforms").array().notNull().default([]),
    cta: text("cta"),
    status: campaignStatusEnum("status").notNull().default("planning"),
    jobId: uuid("job_id"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campaigns_ws_idx").on(t.workspaceId, t.createdAt)],
);

export const campaignItems = pgTable(
  "campaign_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    dayIndex: integer("day_index").notNull(),
    theme: text("theme").notNull(),
    contentItemId: uuid("content_item_id").references(() => contentItems.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campaign_items_campaign_idx").on(t.campaignId, t.dayIndex)],
);



/* ── Analytics (M5) ────────────────────────────────────────────────── */

export const postMetrics = pgTable(
  "post_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    contentItemId: uuid("content_item_id").references(() => contentItems.id, { onDelete: "set null" }),
    externalPostId: text("external_post_id").notNull(),
    metrics: jsonb("metrics").notNull().default({}),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("post_metrics_external_uq").on(t.workspaceId, t.platform, t.externalPostId)],
);

export const aiInsights = pgTable(
  "ai_insights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("performance"),
    content: text("content").notNull(),
    data: jsonb("data").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_insights_ws_idx").on(t.workspaceId, t.createdAt)],
);

/* ── Competitors (M6) ──────────────────────────────────────────────── */

export const competitors = pgTable(
  "competitors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    platform: platformEnum("platform").notNull().default("instagram"),
    handle: text("handle").notNull(), // IG username (business discovery)
    notes: text("notes"),
    lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("competitors_ws_handle_uq").on(t.workspaceId, t.platform, t.handle)],
);

export const competitorSnapshots = pgTable(
  "competitor_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    competitorId: uuid("competitor_id")
      .notNull()
      .references(() => competitors.id, { onDelete: "cascade" }),
    followers: integer("followers"),
    postsCount: integer("posts_count"),
    recentPosts: jsonb("recent_posts").notNull().default([]),
    avgEngagement: real("avg_engagement"),
    analysis: text("analysis"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("competitor_snapshots_comp_idx").on(t.competitorId, t.capturedAt)],
);

/* ── Media lifecycle (0026) ─────────────────────────────────────────
   Cleanup queue: append-only log of storage paths eligible for deletion
   once grace_until has passed AND ref_count is 0. The mediaCleanup worker
   reads from this table to know WHAT to clean, then DELETEs both the
   Storage object AND the source DB row in one transaction. We keep a
   history row for 30 days post-cleanup for audit / explainability. */

export const mediaCleanupQueue = pgTable(
  "media_cleanup_queue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceRowId: uuid("source_row_id"),
    sourceKind: text("source_kind").notNull(),
    refCountAtQueue: integer("ref_count_at_queue").notNull().default(1),
    bytes: integer("bytes").notNull().default(0),
    reason: text("reason").notNull(),
    graceUntil: timestamp("grace_until", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    cleanedAt: timestamp("cleaned_at", { withTimezone: true }),
    cleanedBytes: integer("cleaned_bytes"),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("media_cleanup_queue_pending_idx").on(t.graceUntil).where(sql`${t.status} = 'pending'`),
    index("media_cleanup_queue_workspace_idx").on(t.workspaceId, sql`${t.createdAt} DESC`),
  ],
);

/* Workspace storage quotas: per-workspace plan + caps. Used by the
   beginMediaUploadAction to reject over-quota uploads and by the in-app
   storage chip to show progress against the cap. warnRatio is 0..1 in
   Postgres (real); the UI multiplies by 100 for display. */
export const workspaceStorageQuotas = pgTable(
  "workspace_storage_quotas",
  {
    workspaceId: uuid("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
    plan: text("plan").notNull().default("free"),
    maxStorageBytes: integer("max_storage_bytes"),
    maxPerFileBytes: integer("max_per_file_bytes").notNull().default(52428800),
    maxImageBytes: integer("max_image_bytes").notNull().default(9437184),
    maxVideoBytes: integer("max_video_bytes").notNull().default(52428800),
    warnRatio: real("warn_ratio").notNull().default(0.8),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);


