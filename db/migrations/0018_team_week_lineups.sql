-- Journal: 0018_team_week_lineups

CREATE TABLE "team_week_lineups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_season_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"week" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"slot_position_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_week_lineups_season_team_week_player_uniq" UNIQUE("league_season_id","team_id","week","player_id")
);
--> statement-breakpoint
ALTER TABLE "team_week_lineups" ADD CONSTRAINT "team_week_lineups_league_season_id_league_seasons_id_fk" FOREIGN KEY ("league_season_id") REFERENCES "public"."league_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_week_lineups" ADD CONSTRAINT "team_week_lineups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_week_lineups" ADD CONSTRAINT "team_week_lineups_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_week_lineups" ADD CONSTRAINT "team_week_lineups_slot_position_id_positions_id_fk" FOREIGN KEY ("slot_position_id") REFERENCES "public"."positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_week_lineups_season_team_week_idx" ON "team_week_lineups" USING btree ("league_season_id","team_id","week");
