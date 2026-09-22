CREATE TABLE "research_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"provider" text DEFAULT 'brave' NOT NULL,
	"strategy" text DEFAULT 'web' NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"query_hash" text NOT NULL,
	"region" text,
	"language" text,
	"freshness" text,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"http_status" integer,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_usage_events" ADD CONSTRAINT "research_usage_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_usage_events_ws_created_idx" ON "research_usage_events" USING btree ("workspace_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "research_usage_events_created_hash_idx" ON "research_usage_events" USING btree ("query_hash","created_at");--> statement-breakpoint
-- Server-only: the Brave API key never lives here, and per-tenant usage
-- rows are platform telemetry — browser roles (anon/authenticated via
-- PostgREST) must have no access. Mirrors the 0025 convention.
REVOKE ALL ON TABLE public.research_usage_events FROM PUBLIC, anon, authenticated;
