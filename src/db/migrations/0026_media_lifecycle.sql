CREATE TABLE "media_cleanup_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"source_table" text NOT NULL,
	"source_row_id" uuid,
	"source_kind" text NOT NULL,
	"ref_count_at_queue" integer DEFAULT 1 NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"grace_until" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"cleaned_at" timestamp with time zone,
	"cleaned_bytes" integer,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_storage_quotas" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"max_storage_bytes" integer,
	"max_per_file_bytes" integer DEFAULT 52428800 NOT NULL,
	"max_image_bytes" integer DEFAULT 9437184 NOT NULL,
	"max_video_bytes" integer DEFAULT 52428800 NOT NULL,
	"warn_ratio" real DEFAULT 0.8 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_assets" ADD COLUMN "ref_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD COLUMN "last_used_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD COLUMN "cleanup_status" text DEFAULT 'permanent' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_assets" ADD COLUMN "cleanup_eligible_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "visual_assets" ADD COLUMN "ref_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "visual_assets" ADD COLUMN "last_used_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "visual_assets" ADD COLUMN "cleanup_status" text DEFAULT 'permanent' NOT NULL;--> statement-breakpoint
ALTER TABLE "visual_assets" ADD COLUMN "cleanup_eligible_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "visual_assets" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "media_cleanup_queue" ADD CONSTRAINT "media_cleanup_queue_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_storage_quotas" ADD CONSTRAINT "workspace_storage_quotas_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_cleanup_queue_pending_idx" ON "media_cleanup_queue" USING btree ("grace_until") WHERE "media_cleanup_queue"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "media_cleanup_queue_workspace_idx" ON "media_cleanup_queue" USING btree ("workspace_id","created_at" DESC);--> statement-breakpoint
-- Seed every existing workspace with a free-plan quota row so quota reads
-- never see NULL. ON CONFLICT keeps this idempotent on re-runs.
INSERT INTO workspace_storage_quotas (workspace_id, plan, max_storage_bytes)
SELECT id, 'free', 1073741824 FROM workspaces
ON CONFLICT (workspace_id) DO NOTHING;
--> statement-breakpoint
-- Helpful partial index for the "find eligible cleanup rows" hot path —
-- only rows actually marked for deletion are in the index, so it stays
-- tiny even with millions of permanent visual_assets.
CREATE INDEX IF NOT EXISTS visual_assets_cleanup_eligible_idx
  ON visual_assets (cleanup_eligible_at)
  WHERE cleanup_status IN ('temporary', 'soft_deleted');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS brand_assets_cleanup_eligible_idx
  ON brand_assets (cleanup_eligible_at)
  WHERE cleanup_status IN ('temporary', 'soft_deleted');
--> statement-breakpoint
-- Workspace delete already cascades through FKs on workspaces, but
-- Storage objects live in Supabase Storage, not Postgres. The cleanup
-- queue rows are FK-cascade-deleted with the workspace, which is fine
-- (the Storage cleanup that the worker would have done is skipped — the
-- workspace no longer exists, so we accept orphaned storage rows and
-- rely on a separate workspace-delete worker to purge them; that path
-- is documented in src/server/actions/workspace-delete.ts).
