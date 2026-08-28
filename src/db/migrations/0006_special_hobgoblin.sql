CREATE TYPE "public"."campaign_status" AS ENUM('planning', 'generating', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "campaign_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"day_index" integer NOT NULL,
	"theme" text NOT NULL,
	"content_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
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
--> statement-breakpoint
ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_items_campaign_idx" ON "campaign_items" USING btree ("campaign_id","day_index");--> statement-breakpoint
CREATE INDEX "campaigns_ws_idx" ON "campaigns" USING btree ("workspace_id","created_at");