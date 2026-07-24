-- CreateTable
CREATE TABLE IF NOT EXISTS "team_week_stats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "league_season_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "week" integer NOT NULL,
  "points_for" double precision,
  "optimum_points_for" double precision,
  "by_position" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "team_week_stats_season_team_week_idx"
  ON "team_week_stats" ("league_season_id", "team_id", "week");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "team_week_stats"
    ADD CONSTRAINT "team_week_stats_league_season_id_league_seasons_id_fk"
    FOREIGN KEY ("league_season_id") REFERENCES "league_seasons"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "team_week_stats"
    ADD CONSTRAINT "team_week_stats_team_id_teams_id_fk"
    FOREIGN KEY ("team_id") REFERENCES "teams"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
