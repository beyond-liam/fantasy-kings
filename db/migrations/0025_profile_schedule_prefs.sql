ALTER TABLE "profiles" ADD COLUMN "include_preseason" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "preseason_start_week" integer DEFAULT 1 NOT NULL;
