ALTER TABLE "chat_threads" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;