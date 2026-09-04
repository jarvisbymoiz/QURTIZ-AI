ALTER TABLE "publishing_jobs" ADD COLUMN "provider_post_id" text;--> statement-breakpoint
CREATE INDEX "publishing_jobs_provider_post_id_idx" ON "publishing_jobs" USING btree ("provider_post_id");