CREATE TYPE "public"."brand_asset_kind" AS ENUM('logo', 'avatar', 'reference');--> statement-breakpoint
CREATE TABLE "brand_assets" (
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
--> statement-breakpoint
CREATE TABLE "visual_assets" (
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
--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_assets" ADD CONSTRAINT "visual_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_assets" ADD CONSTRAINT "visual_assets_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_assets_ws_idx" ON "brand_assets" USING btree ("workspace_id","kind");--> statement-breakpoint
CREATE INDEX "visual_assets_item_idx" ON "visual_assets" USING btree ("content_item_id","created_at");