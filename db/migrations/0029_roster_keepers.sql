ALTER TABLE "roster_players" ADD COLUMN "is_keeper" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TYPE "public"."league_activity_type" ADD VALUE IF NOT EXISTS 'keepers_set';
