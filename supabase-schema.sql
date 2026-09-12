-- QURTIZ AI COMPLETE SUPABASE DATABASE SCHEMA
-- Run this in your Supabase SQL Editor if tables have not been created.

-- MIGRATION: 0000_yummy_ultimates.sql
DO $$ BEGIN
  CREATE TYPE "public"."agent_run_status" AS ENUM('running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."brand_memory_type" AS ENUM('preference', 'fact', 'rule');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."content_status" AS ENUM('draft', 'generating', 'ready_for_review', 'approved', 'scheduled', 'published', 'failed', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."platform_connection_status" AS ENUM('not_connected', 'connected', 'expired', 'error');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."platform" AS ENUM('facebook', 'instagram');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'editor', 'viewer');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text DEFAULT 'chat' NOT NULL,
	"status" "agent_run_status" DEFAULT 'running' NOT NULL,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(12, 6),
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "agent_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"tool_name" text,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"duration_ms" integer,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "brand_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" "brand_memory_type" NOT NULL,
	"content" text NOT NULL,
	"source" text DEFAULT 'chat' NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"business_name" text,
	"description" text,
	"industry" text,
	"products" text,
	"services" text,
	"pricing" text,
	"offers" text,
	"locations" text,
	"website" text,
	"contact" text,
	"cta" text,
	"target_market" text,
	"audience" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"voice_presets" text[] DEFAULT '{}' NOT NULL,
	"voice_custom" text,
	"visual_identity" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"message" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "platform_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"status" "platform_connection_status" DEFAULT 'not_connected' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "settings" (
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_workspace_id_key_pk" PRIMARY KEY("workspace_id","key")
);

CREATE TABLE IF NOT EXISTS "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_role" DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Karachi' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "brand_memory" ADD CONSTRAINT "brand_memory_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "brands" ADD CONSTRAINT "brands_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "content_items" ADD CONSTRAINT "content_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "settings" ADD CONSTRAINT "settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "agent_runs_ws_idx" ON "agent_runs" USING btree ("workspace_id","started_at");

CREATE INDEX IF NOT EXISTS "agent_steps_run_idx" ON "agent_steps" USING btree ("run_id","idx");

CREATE INDEX IF NOT EXISTS "brand_memory_ws_idx" ON "brand_memory" USING btree ("workspace_id","created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "brands_workspace_uq" ON "brands" USING btree ("workspace_id");

CREATE INDEX IF NOT EXISTS "chat_messages_thread_idx" ON "chat_messages" USING btree ("thread_id","created_at");

CREATE INDEX IF NOT EXISTS "chat_threads_ws_idx" ON "chat_threads" USING btree ("workspace_id","updated_at");

CREATE INDEX IF NOT EXISTS "content_items_ws_status_idx" ON "content_items" USING btree ("workspace_id","status");

CREATE UNIQUE INDEX IF NOT EXISTS "platform_connections_ws_platform_uq" ON "platform_connections" USING btree ("workspace_id","platform");

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_ws_user_uq" ON "workspace_members" USING btree ("workspace_id","user_id");

CREATE INDEX IF NOT EXISTS "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_slug_uq" ON "workspaces" USING btree ("slug");

-- MIGRATION: 0001_rls_policies.sql
-- Row-Level Security: defense-in-depth for workspace isolation.
-- The application connects as the table owner (bypasses RLS) and enforces
-- tenancy in its data-access layer; these policies protect any direct
-- client access path (e.g. PostgREST with a user JWT).

-- Helper: is the current auth user a member of the workspace?
-- SECURITY DEFINER prevents recursion on workspace_members policies.
CREATE OR REPLACE FUNCTION qurtiz_is_workspace_member(ws uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members m
    WHERE m.workspace_id = ws
      AND m.user_id = auth.uid()
  );
$$;

-- workspace_members: users can see their own memberships.
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_select_own" ON workspace_members
  FOR SELECT USING (user_id = auth.uid());

-- workspaces: members can read/update their workspaces (key column: id).
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspaces_member_select" ON workspaces
  FOR SELECT USING (qurtiz_is_workspace_member(id));

CREATE POLICY "workspaces_member_update" ON workspaces
  FOR UPDATE USING (qurtiz_is_workspace_member(id))
  WITH CHECK (qurtiz_is_workspace_member(id));

-- Generic member-based policies for every table that carries workspace_id.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'settings',
    'brands',
    'brand_memory',
    'platform_connections',
    'chat_threads',
    'chat_messages',
    'agent_runs',
    'agent_steps',
    'content_items'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format(
      'CREATE POLICY "%s_member_select" ON %I FOR SELECT USING (qurtiz_is_workspace_member(workspace_id));',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_member_insert" ON %I FOR INSERT WITH CHECK (qurtiz_is_workspace_member(workspace_id));',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_member_update" ON %I FOR UPDATE USING (qurtiz_is_workspace_member(workspace_id)) WITH CHECK (qurtiz_is_workspace_member(workspace_id));',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_member_delete" ON %I FOR DELETE USING (qurtiz_is_workspace_member(workspace_id));',
      t, t
    );
  END LOOP;
END $$;

-- MIGRATION: 0002_omniscient_speed.sql
DO $$ BEGIN
  CREATE TYPE "public"."content_format" AS ENUM('single_image', 'carousel', 'reel', 'story', 'text_post');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."content_variant_status" AS ENUM('generating', 'ready_for_review', 'approved', 'scheduled', 'published', 'failed', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "content_pillars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"target_share" integer DEFAULT 20 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "content_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"format" "content_format" NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"script" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hashtags" text[] DEFAULT '{}' NOT NULL,
	"cta" text,
	"status" "content_variant_status" DEFAULT 'generating' NOT NULL,
	"qa" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "research_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"source_url" text,
	"source_name" text,
	"category" text,
	"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recommended_formats" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "content_items" ADD COLUMN "objective" text;

ALTER TABLE "content_items" ADD COLUMN "pillar_id" uuid;

ALTER TABLE "content_items" ADD COLUMN "format" "content_format" DEFAULT 'single_image' NOT NULL;

ALTER TABLE "content_items" ADD COLUMN "hook" text;

ALTER TABLE "content_items" ADD COLUMN "main_copy" text;

ALTER TABLE "content_items" ADD COLUMN "caption" text;

ALTER TABLE "content_items" ADD COLUMN "cta" text;

ALTER TABLE "content_items" ADD COLUMN "hashtags" text[] DEFAULT '{}' NOT NULL;

ALTER TABLE "content_items" ADD COLUMN "keywords" text[] DEFAULT '{}' NOT NULL;

ALTER TABLE "content_items" ADD COLUMN "visual_concept" text;

ALTER TABLE "content_items" ADD COLUMN "ai_scores" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "content_items" ADD COLUMN "qa" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "content_items" ADD COLUMN "scheduled_at" timestamp with time zone;

ALTER TABLE "content_items" ADD COLUMN "published_at" timestamp with time zone;

ALTER TABLE "content_items" ADD COLUMN "research_item_id" uuid;

ALTER TABLE "content_pillars" ADD CONSTRAINT "content_pillars_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "content_variants" ADD CONSTRAINT "content_variants_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "content_variants" ADD CONSTRAINT "content_variants_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "research_items" ADD CONSTRAINT "research_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "content_pillars_ws_idx" ON "content_pillars" USING btree ("workspace_id","active");

CREATE INDEX IF NOT EXISTS "content_variants_item_idx" ON "content_variants" USING btree ("content_item_id","platform");

CREATE INDEX IF NOT EXISTS "research_items_ws_idx" ON "research_items" USING btree ("workspace_id","created_at");

ALTER TABLE "content_items" ADD CONSTRAINT "content_items_pillar_id_content_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."content_pillars"("id") ON DELETE set null ON UPDATE no action;

-- MIGRATION: 0003_rls_m2.sql
-- RLS for M2 tables (same member-based pattern as 0001).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'content_pillars',
    'research_items',
    'content_variants'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY "%s_member_select" ON %I FOR SELECT USING (qurtiz_is_workspace_member(workspace_id));',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_member_insert" ON %I FOR INSERT WITH CHECK (qurtiz_is_workspace_member(workspace_id));',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_member_update" ON %I FOR UPDATE USING (qurtiz_is_workspace_member(workspace_id)) WITH CHECK (qurtiz_is_workspace_member(workspace_id));',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "%s_member_delete" ON %I FOR DELETE USING (qurtiz_is_workspace_member(workspace_id));',
      t, t
    );
  END LOOP;
END $$;

-- MIGRATION: 0004_unknown_mojo.sql
DO $$ BEGIN
  CREATE TYPE "public"."brand_asset_kind" AS ENUM('logo', 'avatar', 'reference');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "brand_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "brand_asset_kind" NOT NULL,
	"label" text,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "visual_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"kind" text DEFAULT 'template' NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text DEFAULT 'image/png' NOT NULL,
	"width" integer,
	"height" integer,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "visual_assets" ADD CONSTRAINT "visual_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "visual_assets" ADD CONSTRAINT "visual_assets_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "brand_assets_ws_idx" ON "brand_assets" USING btree ("workspace_id","kind");

CREATE INDEX IF NOT EXISTS "visual_assets_item_idx" ON "visual_assets" USING btree ("content_item_id","created_at");

-- MIGRATION: 0005_odd_ben_parker.sql
DO $$ BEGIN
  CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."notification_kind" AS ENUM('content_ready', 'generation_completed', 'publishing_completed', 'publishing_failed', 'auth_expired', 'job_completed', 'system');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."publishing_job_status" AS ENUM('pending', 'processing', 'published', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" DEFAULT 'system' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "publishing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"content_variant_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "publishing_job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "jobs" ADD CONSTRAINT "jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "publishing_jobs" ADD CONSTRAINT "publishing_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "publishing_jobs" ADD CONSTRAINT "publishing_jobs_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "publishing_jobs" ADD CONSTRAINT "publishing_jobs_content_variant_id_content_variants_id_fk" FOREIGN KEY ("content_variant_id") REFERENCES "public"."content_variants"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "jobs_ws_idx" ON "jobs" USING btree ("workspace_id","created_at");

CREATE INDEX IF NOT EXISTS "notifications_ws_idx" ON "notifications" USING btree ("workspace_id","created_at");

CREATE INDEX IF NOT EXISTS "publishing_jobs_due_idx" ON "publishing_jobs" USING btree ("status","scheduled_at");

-- MIGRATION: 0006_special_hobgoblin.sql
DO $$ BEGIN
  CREATE TYPE "public"."campaign_status" AS ENUM('planning', 'generating', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "campaign_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"day_index" integer NOT NULL,
	"theme" text NOT NULL,
	"content_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal" text,
	"offer" text,
	"audience" text,
	"duration_days" integer DEFAULT 7 NOT NULL,
	"platforms" text[] DEFAULT '{}' NOT NULL,
	"cta" text,
	"status" "campaign_status" DEFAULT 'planning' NOT NULL,
	"job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "campaign_items_campaign_idx" ON "campaign_items" USING btree ("campaign_id","day_index");

CREATE INDEX IF NOT EXISTS "campaigns_ws_idx" ON "campaigns" USING btree ("workspace_id","created_at");

-- MIGRATION: 0007_fearless_gamora.sql
ALTER TABLE "platform_connections" ADD COLUMN "encrypted_token" text;

-- MIGRATION: 0008_salty_ender_wiggin.sql
ALTER TABLE "campaigns" ADD COLUMN "created_by" uuid;

-- MIGRATION: 0009_curvy_scream.sql
CREATE TABLE IF NOT EXISTS "ai_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text DEFAULT 'performance' NOT NULL,
	"content" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "post_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"content_item_id" uuid,
	"external_post_id" text NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"posted_at" timestamp with time zone,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "post_metrics" ADD CONSTRAINT "post_metrics_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "post_metrics" ADD CONSTRAINT "post_metrics_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "ai_insights_ws_idx" ON "ai_insights" USING btree ("workspace_id","created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "post_metrics_external_uq" ON "post_metrics" USING btree ("workspace_id","platform","external_post_id");

-- MIGRATION: 0010_brave_ben_grimm.sql
CREATE TABLE IF NOT EXISTS "competitor_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"competitor_id" uuid NOT NULL,
	"followers" integer,
	"posts_count" integer,
	"recent_posts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avg_engagement" real,
	"analysis" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"platform" "platform" DEFAULT 'instagram' NOT NULL,
	"handle" text NOT NULL,
	"notes" text,
	"last_analyzed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "competitor_snapshots" ADD CONSTRAINT "competitor_snapshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "competitor_snapshots" ADD CONSTRAINT "competitor_snapshots_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "competitors" ADD CONSTRAINT "competitors_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "competitor_snapshots_comp_idx" ON "competitor_snapshots" USING btree ("competitor_id","captured_at");

CREATE UNIQUE INDEX IF NOT EXISTS "competitors_ws_handle_uq" ON "competitors" USING btree ("workspace_id","platform","handle");

-- MIGRATION: 0011_safe_mordo.sql
ALTER TABLE "chat_threads" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;

ALTER TABLE "chat_threads" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;

-- MIGRATION: 0012_shallow_timeslip.sql
ALTER TYPE "public"."content_status" ADD VALUE 'rejected' BEFORE 'scheduled';

-- MIGRATION: 0013_pale_lady_ursula.sql
ALTER TABLE "content_items" ADD COLUMN "first_comment" text;

ALTER TABLE "content_variants" ADD COLUMN "first_comment" text;

ALTER TABLE "content_variants" ADD COLUMN "slides" jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE "visual_assets" ADD COLUMN "slide_index" integer;

-- MIGRATION: 0014_rls_backfill.sql
-- RLS backfill for the 11 tables created after 0001/0003 that have no RLS
-- SQL in the repo. The live DB enabled RLS on them out-of-band, so a fresh
-- environment would otherwise ship them unprotected with a public anon key.
-- Same member-based policy pattern as 0001_rls_policies.sql / 0003_rls_m2.sql
-- (qurtiz_is_workspace_member helper + SELECT/INSERT/UPDATE/DELETE per table).
-- All 11 tables carry a workspace_id column (verified in 0004/0005/0006/
-- 0009/0010 and src/db/schema.ts).
--
-- DROP POLICY IF EXISTS + CREATE POLICY keeps this safe to run against a DB
-- that already received out-of-band RLS, while staying valid Postgres
-- (CREATE POLICY has no IF NOT EXISTS clause — the original file was a
-- syntax error on fresh deploys, 42601). Fresh deployments get exactly the
-- 0001/0003 policy shape; re-runs are no-ops.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brand_assets',
    'visual_assets',
    'jobs',
    'notifications',
    'publishing_jobs',
    'campaigns',
    'campaign_items',
    'post_metrics',
    'ai_insights',
    'competitors',
    'competitor_snapshots'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_member_select" ON %I; CREATE POLICY "%s_member_select" ON %I FOR SELECT USING (qurtiz_is_workspace_member(workspace_id));',
      t, t, t, t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_member_insert" ON %I; CREATE POLICY "%s_member_insert" ON %I FOR INSERT WITH CHECK (qurtiz_is_workspace_member(workspace_id));',
      t, t, t, t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_member_update" ON %I; CREATE POLICY "%s_member_update" ON %I FOR UPDATE USING (qurtiz_is_workspace_member(workspace_id)) WITH CHECK (qurtiz_is_workspace_member(workspace_id));',
      t, t, t, t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_member_delete" ON %I; CREATE POLICY "%s_member_delete" ON %I FOR DELETE USING (qurtiz_is_workspace_member(workspace_id));',
      t, t, t, t
    );
  END LOOP;
END $$;

-- MIGRATION: 0015_workspace_ai_config.sql
CREATE TABLE IF NOT EXISTS "workspace_ai_config" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"text_provider" text NOT NULL,
	"text_model" text NOT NULL,
	"text_base_url" text,
	"text_api_key_enc" text NOT NULL,
	"image_provider" text NOT NULL,
	"image_model" text NOT NULL,
	"image_base_url" text,
	"image_api_key_enc" text NOT NULL,
	"task_overrides" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "workspace_ai_config" ADD CONSTRAINT "workspace_ai_config_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;

-- RLS: same member-based policy shape as 0014 (qurtiz_is_workspace_member
-- helper). The app connects as the table owner (bypasses RLS) for runtime
-- resolution; these policies protect the row from direct anon-key access.
ALTER TABLE "workspace_ai_config" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_ai_config_member_select" ON "workspace_ai_config" FOR SELECT USING (qurtiz_is_workspace_member(workspace_id));

CREATE POLICY "workspace_ai_config_member_insert" ON "workspace_ai_config" FOR INSERT WITH CHECK (qurtiz_is_workspace_member(workspace_id));

CREATE POLICY "workspace_ai_config_member_update" ON "workspace_ai_config" FOR UPDATE USING (qurtiz_is_workspace_member(workspace_id)) WITH CHECK (qurtiz_is_workspace_member(workspace_id));

CREATE POLICY "workspace_ai_config_member_delete" ON "workspace_ai_config" FOR DELETE USING (qurtiz_is_workspace_member(workspace_id));

-- MIGRATION: 0016_publishing_provider.sql
DROP INDEX IF EXISTS "platform_connections_ws_platform_uq";

ALTER TABLE "platform_connections" ADD COLUMN "provider" text DEFAULT 'meta' NOT NULL;

ALTER TABLE "platform_connections" ADD COLUMN "channel_ref" text;

ALTER TABLE "publishing_jobs" ADD COLUMN "provider" text DEFAULT 'meta' NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "platform_connections_ws_platform_provider_uq" ON "platform_connections" USING btree ("workspace_id","platform","provider");

-- MIGRATION: 0017_publishing_provider_post_id.sql
ALTER TABLE "publishing_jobs" ADD COLUMN "provider_post_id" text;

CREATE INDEX IF NOT EXISTS "publishing_jobs_provider_post_id_idx" ON "publishing_jobs" USING btree ("provider_post_id");

