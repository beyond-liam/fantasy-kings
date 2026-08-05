-- Per-team draft grade snapshots (one-time popup via seen_at)
DO $$ BEGIN
  CREATE TYPE "public"."draft_grade_letter" AS ENUM('A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "draft_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"letter" "draft_grade_letter" NOT NULL,
	"score" real NOT NULL,
	"league_rank" integer NOT NULL,
	"team_count" integer NOT NULL,
	"projected_wins" integer NOT NULL,
	"projected_losses" integer NOT NULL,
	"playoff_odds" real NOT NULL,
	"championship_odds" real NOT NULL,
	"best_value_player_id" uuid,
	"best_value_overall" integer,
	"best_value_round" integer,
	"best_value_pick_in_round" integer,
	"best_value_adp" double precision,
	"worst_value_player_id" uuid,
	"worst_value_overall" integer,
	"worst_value_round" integer,
	"worst_value_pick_in_round" integer,
	"worst_value_adp" double precision,
	"headline" text,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "draft_grades" ADD CONSTRAINT "draft_grades_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "draft_grades" ADD CONSTRAINT "draft_grades_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "draft_grades" ADD CONSTRAINT "draft_grades_best_value_player_id_players_id_fk" FOREIGN KEY ("best_value_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "draft_grades" ADD CONSTRAINT "draft_grades_worst_value_player_id_players_id_fk" FOREIGN KEY ("worst_value_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "draft_grades_draft_team_idx" ON "draft_grades" USING btree ("draft_id","team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "draft_grades_team_id_idx" ON "draft_grades" USING btree ("team_id");
