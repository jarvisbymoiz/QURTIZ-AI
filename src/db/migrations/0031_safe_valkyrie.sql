CREATE TABLE "image_mode_preferences" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" text DEFAULT 'api' NOT NULL,
	"model_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_mode_preferences_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "image_mode_preferences" ADD CONSTRAINT "image_mode_preferences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_mode_preferences" ADD CONSTRAINT "image_mode_preferences_member_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "image_mode_preferences" ADD CONSTRAINT "image_mode_preferences_mode_valid" CHECK ("mode" IN ('api', 'local_companion'));
--> statement-breakpoint
ALTER TABLE "image_mode_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "image_mode_preferences" FROM PUBLIC, anon, authenticated;
