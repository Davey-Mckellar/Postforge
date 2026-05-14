ALTER TABLE "users" ADD COLUMN "intro_answers" jsonb;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "intro_completed_at" timestamp with time zone;
