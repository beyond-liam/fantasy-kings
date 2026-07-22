-- Auth onboarding fields + nullable team owners for Claim Team flow.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "favourite_nfl_team" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "onboarded_at" timestamp with time zone;--> statement-breakpoint
UPDATE "profiles" SET "onboarded_at" = COALESCE("created_at", now()) WHERE "onboarded_at" IS NULL;--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "teams_season_user_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "teams_season_user_idx" ON "teams" USING btree ("league_season_id","user_id") WHERE "user_id" IS NOT NULL;
