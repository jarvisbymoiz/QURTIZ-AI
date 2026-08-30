ALTER TABLE "content_items" ADD COLUMN "first_comment" text;--> statement-breakpoint
ALTER TABLE "content_variants" ADD COLUMN "first_comment" text;--> statement-breakpoint
ALTER TABLE "content_variants" ADD COLUMN "slides" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "visual_assets" ADD COLUMN "slide_index" integer;