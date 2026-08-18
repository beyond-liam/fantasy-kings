-- Journal: 0035_team_week_lineup_plans

CREATE TABLE IF NOT EXISTS "team_week_lineup_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_season_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"week" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"slot_position_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_week_lineup_plans_season_team_week_player_uniq" UNIQUE("league_season_id","team_id","week","player_id")
);--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_week_lineup_plans_league_season_id_league_seasons_id_fk'
  ) THEN
    ALTER TABLE "team_week_lineup_plans"
      ADD CONSTRAINT "team_week_lineup_plans_league_season_id_league_seasons_id_fk"
      FOREIGN KEY ("league_season_id") REFERENCES "public"."league_seasons"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_week_lineup_plans_team_id_teams_id_fk'
  ) THEN
    ALTER TABLE "team_week_lineup_plans"
      ADD CONSTRAINT "team_week_lineup_plans_team_id_teams_id_fk"
      FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_week_lineup_plans_player_id_players_id_fk'
  ) THEN
    ALTER TABLE "team_week_lineup_plans"
      ADD CONSTRAINT "team_week_lineup_plans_player_id_players_id_fk"
      FOREIGN KEY ("player_id") REFERENCES "public"."players"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_week_lineup_plans_slot_position_id_positions_id_fk'
  ) THEN
    ALTER TABLE "team_week_lineup_plans"
      ADD CONSTRAINT "team_week_lineup_plans_slot_position_id_positions_id_fk"
      FOREIGN KEY ("slot_position_id") REFERENCES "public"."positions"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_week_lineup_plans_season_team_week_idx"
  ON "team_week_lineup_plans" USING btree ("league_season_id","team_id","week");--> statement-breakpoint
ALTER TABLE "team_week_lineup_plans" ENABLE ROW LEVEL SECURITY;
