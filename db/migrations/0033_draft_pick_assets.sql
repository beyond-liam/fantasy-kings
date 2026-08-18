ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "lineage_id" uuid;--> statement-breakpoint
UPDATE "teams" SET "lineage_id" = "id" WHERE "lineage_id" IS NULL;--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "lineage_id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "lineage_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "teams_season_lineage_idx"
  ON "teams" USING btree ("league_season_id", "lineage_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "draft_pick_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "league_id" uuid NOT NULL,
  "draft_year" integer NOT NULL,
  "round" integer NOT NULL,
  "original_team_id" uuid NOT NULL,
  "owner_team_id" uuid NOT NULL,
  "slot" integer,
  "overall" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'draft_pick_assets_league_id_leagues_id_fk'
  ) THEN
    ALTER TABLE "draft_pick_assets"
      ADD CONSTRAINT "draft_pick_assets_league_id_leagues_id_fk"
      FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'draft_pick_assets_original_team_id_teams_id_fk'
  ) THEN
    ALTER TABLE "draft_pick_assets"
      ADD CONSTRAINT "draft_pick_assets_original_team_id_teams_id_fk"
      FOREIGN KEY ("original_team_id") REFERENCES "public"."teams"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'draft_pick_assets_owner_team_id_teams_id_fk'
  ) THEN
    ALTER TABLE "draft_pick_assets"
      ADD CONSTRAINT "draft_pick_assets_owner_team_id_teams_id_fk"
      FOREIGN KEY ("owner_team_id") REFERENCES "public"."teams"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "draft_pick_assets_league_year_round_original_uidx"
  ON "draft_pick_assets" USING btree ("league_id", "draft_year", "round", "original_team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "draft_pick_assets_owner_team_id_idx"
  ON "draft_pick_assets" USING btree ("owner_team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "draft_pick_assets_original_team_id_idx"
  ON "draft_pick_assets" USING btree ("original_team_id");--> statement-breakpoint
ALTER TABLE "draft_pick_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TYPE "public"."league_activity_type" ADD VALUE IF NOT EXISTS 'season_started';
