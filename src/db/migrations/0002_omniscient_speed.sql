CREATE TYPE "public"."content_format" AS ENUM('single_image', 'carousel', 'reel', 'story', 'text_post');--> statement-breakpoint
CREATE TYPE "public"."content_variant_status" AS ENUM('generating', 'ready_for_review', 'approved', 'scheduled', 'published', 'failed', 'archived');--> statement-breakpoint
CREATE TABLE "content_pillars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"target_share" integer DEFAULT 20 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_variants" (
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
--> statement-breakpoint
CREATE TABLE "research_items" (
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
--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "objective" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "pillar_id" uuid;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "format" "content_format" DEFAULT 'single_image' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "hook" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "main_copy" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "caption" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "cta" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "hashtags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "keywords" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "visual_concept" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "ai_scores" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "qa" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "research_item_id" uuid;--> statement-breakpoint
ALTER TABLE "content_pillars" ADD CONSTRAINT "content_pillars_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_variants" ADD CONSTRAINT "content_variants_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_variants" ADD CONSTRAINT "content_variants_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_items" ADD CONSTRAINT "research_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_pillars_ws_idx" ON "content_pillars" USING btree ("workspace_id","active");--> statement-breakpoint
CREATE INDEX "content_variants_item_idx" ON "content_variants" USING btree ("content_item_id","platform");--> statement-breakpoint
CREATE INDEX "research_items_ws_idx" ON "research_items" USING btree ("workspace_id","created_at");--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_pillar_id_content_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."content_pillars"("id") ON DELETE set null ON UPDATE no action;