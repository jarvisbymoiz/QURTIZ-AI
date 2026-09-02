CREATE TABLE "workspace_ai_config" (
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
--> statement-breakpoint
ALTER TABLE "workspace_ai_config" ADD CONSTRAINT "workspace_ai_config_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- RLS: same member-based policy shape as 0014 (qurtiz_is_workspace_member
-- helper). The app connects as the table owner (bypasses RLS) for runtime
-- resolution; these policies protect the row from direct anon-key access.
ALTER TABLE "workspace_ai_config" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "workspace_ai_config_member_select" ON "workspace_ai_config" FOR SELECT USING (qurtiz_is_workspace_member(workspace_id));
--> statement-breakpoint
CREATE POLICY "workspace_ai_config_member_insert" ON "workspace_ai_config" FOR INSERT WITH CHECK (qurtiz_is_workspace_member(workspace_id));
--> statement-breakpoint
CREATE POLICY "workspace_ai_config_member_update" ON "workspace_ai_config" FOR UPDATE USING (qurtiz_is_workspace_member(workspace_id)) WITH CHECK (qurtiz_is_workspace_member(workspace_id));
--> statement-breakpoint
CREATE POLICY "workspace_ai_config_member_delete" ON "workspace_ai_config" FOR DELETE USING (qurtiz_is_workspace_member(workspace_id));
