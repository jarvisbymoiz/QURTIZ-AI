CREATE TABLE "companion_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"credential_hash" text NOT NULL,
	"credential_version" integer DEFAULT 1 NOT NULL,
	"chatgpt_connected" boolean DEFAULT false NOT NULL,
	"image_status" text DEFAULT 'unavailable' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companion_image_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"content_item_id" uuid,
	"variant_id" uuid,
	"slide_index" integer,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"prompt" text NOT NULL,
	"content_type" text NOT NULL,
	"size" text NOT NULL,
	"target_width" integer,
	"target_height" integer,
	"reference_assets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"claim_token_hash" text,
	"lease_expires_at" timestamp with time zone,
	"upload_path" text,
	"visual_asset_id" uuid,
	"error" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companion_pairing_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"challenge_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_mode_preferences" ADD COLUMN "companion_offline_policy" text DEFAULT 'wait' NOT NULL;--> statement-breakpoint
ALTER TABLE "image_mode_preferences" ADD COLUMN "companion_timeout_minutes" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "companion_devices" ADD CONSTRAINT "companion_devices_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_devices" ADD CONSTRAINT "companion_devices_member_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_image_jobs" ADD CONSTRAINT "companion_image_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_image_jobs" ADD CONSTRAINT "companion_image_jobs_device_id_companion_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."companion_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_image_jobs" ADD CONSTRAINT "companion_image_jobs_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_image_jobs" ADD CONSTRAINT "companion_image_jobs_variant_id_content_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."content_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_image_jobs" ADD CONSTRAINT "companion_image_jobs_visual_asset_id_visual_assets_id_fk" FOREIGN KEY ("visual_asset_id") REFERENCES "public"."visual_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_image_jobs" ADD CONSTRAINT "companion_image_jobs_member_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_pairing_challenges" ADD CONSTRAINT "companion_pairing_challenges_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_pairing_challenges" ADD CONSTRAINT "companion_pairing_member_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companion_devices_credential_hash_idx" ON "companion_devices" USING btree ("credential_hash");--> statement-breakpoint
CREATE INDEX "companion_devices_owner_idx" ON "companion_devices" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companion_image_jobs_idempotency_idx" ON "companion_image_jobs" USING btree ("workspace_id","user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "companion_image_jobs_claim_idx" ON "companion_image_jobs" USING btree ("device_id","status","created_at");--> statement-breakpoint
CREATE INDEX "companion_image_jobs_owner_idx" ON "companion_image_jobs" USING btree ("workspace_id","user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "companion_pairing_challenge_hash_idx" ON "companion_pairing_challenges" USING btree ("challenge_hash");--> statement-breakpoint
CREATE INDEX "companion_pairing_expiry_idx" ON "companion_pairing_challenges" USING btree ("expires_at");
--> statement-breakpoint
ALTER TABLE "image_mode_preferences" ADD CONSTRAINT "image_mode_preferences_companion_policy_valid"
  CHECK ("companion_offline_policy" IN ('wait', 'api_fallback', 'fail'));
--> statement-breakpoint
ALTER TABLE "image_mode_preferences" ADD CONSTRAINT "image_mode_preferences_companion_timeout_valid"
  CHECK ("companion_timeout_minutes" BETWEEN 5 AND 1440);
--> statement-breakpoint
ALTER TABLE "companion_devices" ADD CONSTRAINT "companion_devices_image_status_valid"
  CHECK ("image_status" IN ('available', 'rate_limited', 'unavailable'));
--> statement-breakpoint
ALTER TABLE "companion_image_jobs" ADD CONSTRAINT "companion_image_jobs_status_valid"
  CHECK ("status" IN ('queued', 'waiting_for_companion', 'claimed', 'generating', 'uploading', 'completed', 'failed'));
--> statement-breakpoint
ALTER TABLE "companion_image_jobs" ADD CONSTRAINT "companion_image_jobs_prompt_bounded"
  CHECK (char_length("prompt") BETWEEN 1 AND 24000);
--> statement-breakpoint
ALTER TABLE "companion_pairing_challenges" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "companion_devices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "companion_image_jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "companion_pairing_challenges", "companion_devices", "companion_image_jobs" FROM PUBLIC, anon, authenticated;
