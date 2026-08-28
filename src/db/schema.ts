import {
  boolean,
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
    content: text("content").notNull(),
    source: text("source").notNull().default("chat"),
    confidence: real("confidence").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("brand_memory_ws_idx").on(t.workspaceId, t.createdAt)],
);

/* ── Connections (schema now, features in M4) ──────────────────────── */

export const platformConnections = pgTable(
  "platform_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    status: platformConnectionStatusEnum("status").notNull().default("not_connected"),
    meta: jsonb("meta").notNull().default({}),
    encryptedToken: text("encrypted_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("platform_connections_ws_platform_uq").on(t.workspaceId, t.platform)],
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
    hashtags: text("hashtags").array().notNull().default([]),
    keywords: text("keywords").array().notNull().default([]),
    visualConcept: text("visual_concept"),
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
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull().default("image/png"),
    width: integer("width"),
    height: integer("height"),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: publishingJobStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    result: jsonb("result").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("publishing_jobs_due_idx").on(t.status, t.scheduledAt)],
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
