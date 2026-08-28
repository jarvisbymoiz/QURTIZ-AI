CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('content_ready', 'generation_completed', 'publishing_completed', 'publishing_failed', 'auth_expired', 'job_completed', 'system');--> statement-breakpoint
CREATE TYPE "public"."publishing_job_status" AS ENUM('pending', 'processing', 'published', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "jobs" (
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
--> statement-breakpoint
CREATE TABLE "notifications" (
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
--> statement-breakpoint
CREATE TABLE "publishing_jobs" (
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
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_jobs" ADD CONSTRAINT "publishing_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_jobs" ADD CONSTRAINT "publishing_jobs_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_jobs" ADD CONSTRAINT "publishing_jobs_content_variant_id_content_variants_id_fk" FOREIGN KEY ("content_variant_id") REFERENCES "public"."content_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_ws_idx" ON "jobs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_ws_idx" ON "notifications" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "publishing_jobs_due_idx" ON "publishing_jobs" USING btree ("status","scheduled_at");