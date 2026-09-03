DROP INDEX "platform_connections_ws_platform_uq";--> statement-breakpoint
ALTER TABLE "platform_connections" ADD COLUMN "provider" text DEFAULT 'meta' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_connections" ADD COLUMN "channel_ref" text;--> statement-breakpoint
ALTER TABLE "publishing_jobs" ADD COLUMN "provider" text DEFAULT 'meta' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_connections_ws_platform_provider_uq" ON "platform_connections" USING btree ("workspace_id","platform","provider");