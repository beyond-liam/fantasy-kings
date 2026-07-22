CREATE TYPE "public"."position_side" AS ENUM('offense', 'defense', 'special', 'flex');--> statement-breakpoint
CREATE TYPE "public"."draft_type" AS ENUM('live', 'email');--> statement-breakpoint
CREATE TYPE "public"."league_activity_type" AS ENUM('waiver_awarded', 'waiver_failed', 'trade_proposed', 'trade_completed', 'trade_rejected', 'trade_cancelled');--> statement-breakpoint
CREATE TYPE "public"."league_type" AS ENUM('redraft', 'dynasty');--> statement-breakpoint
CREATE TYPE "public"."roster_mode" AS ENUM('standard', 'custom');--> statement-breakpoint
CREATE TYPE "public"."scoring_preset" AS ENUM('standard', 'half_ppr', 'full_ppr');--> statement-breakpoint
CREATE TYPE "public"."season_status" AS ENUM('setup', 'recruiting', 'draft', 'active');--> statement-breakpoint
CREATE TYPE "public"."trade_processing" AS ENUM('commissioner', 'review_24h', 'instant');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('pending', 'review', 'awaiting_commissioner', 'completed', 'rejected', 'cancelled', 'commissioner_rejected');--> statement-breakpoint
CREATE TYPE "public"."waiver_claim_status" AS ENUM('pending', 'awarded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."waiver_type" AS ENUM('priority', 'faab');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('commissioner', 'member');--> statement-breakpoint
CREATE TYPE "public"."roster_player_status" AS ENUM('rostered', 'waived');--> statement-breakpoint
CREATE TYPE "public"."draft_pick_source" AS ENUM('manual', 'commissioner', 'autopick');--> statement-breakpoint
CREATE TYPE "public"."draft_status" AS ENUM('scheduled', 'live', 'paused', 'complete');--> statement-breakpoint
CREATE TYPE "public"."player_external_id_provider" AS ENUM('sleeper');--> statement-breakpoint
CREATE TYPE "public"."player_score_kind" AS ENUM('projection', 'stats');--> statement-breakpoint
CREATE TABLE "positions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"side" "position_side" NOT NULL,
	"sort_order" integer NOT NULL,
	"is_starter_slot" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"invite_code" text NOT NULL,
	"commissioner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leagues_slug_unique" UNIQUE("slug"),
	CONSTRAINT "leagues_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "league_seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"season_year" integer NOT NULL,
	"status" "season_status" DEFAULT 'recruiting' NOT NULL,
	"league_type" "league_type" DEFAULT 'redraft' NOT NULL,
	"team_count" integer NOT NULL,
	"division_count" integer DEFAULT 1 NOT NULL,
	"playoff_team_count" integer NOT NULL,
	"championship_week" integer NOT NULL,
	"regular_season_end_week" integer NOT NULL,
	"roster_mode" "roster_mode" DEFAULT 'standard' NOT NULL,
	"bench_slots" integer DEFAULT 6 NOT NULL,
	"ir_enabled" boolean DEFAULT false NOT NULL,
	"ir_slots" integer DEFAULT 0 NOT NULL,
	"taxi_enabled" boolean DEFAULT false NOT NULL,
	"taxi_slots" integer DEFAULT 0 NOT NULL,
	"scoring_preset" "scoring_preset" DEFAULT 'full_ppr' NOT NULL,
	"waivers_enabled" boolean DEFAULT true NOT NULL,
	"waiver_type" "waiver_type" DEFAULT 'priority' NOT NULL,
	"faab_budget" integer,
	"trades_enabled" boolean DEFAULT true NOT NULL,
	"trade_processing" "trade_processing" DEFAULT 'review_24h' NOT NULL,
	"trade_deadline_week" integer,
	"draft_type" "draft_type" DEFAULT 'live' NOT NULL,
	"draft_start_at" timestamp with time zone NOT NULL,
	"pick_time_limit_seconds" integer NOT NULL,
	"email_notifications_enabled" boolean DEFAULT false NOT NULL,
	"free_agency_open" boolean DEFAULT false NOT NULL,
	"last_waiver_processed_at" timestamp with time zone,
	"settings" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_season_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_season_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"division_id" uuid,
	"draft_slot" integer,
	"auto_pick_enabled" boolean DEFAULT false NOT NULL,
	"waiver_priority" integer DEFAULT 1 NOT NULL,
	"faab_remaining" integer,
	"last_waiver_results_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_watchlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"status" "roster_player_status" DEFAULT 'rostered' NOT NULL,
	"slot_position_id" text,
	"waiver_clears_at" timestamp with time zone,
	"acquired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waiver_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_season_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"drop_player_id" uuid,
	"bid" integer,
	"status" "waiver_claim_status" DEFAULT 'pending' NOT NULL,
	"fail_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"is_drop" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_season_id" uuid NOT NULL,
	"proposing_team_id" uuid NOT NULL,
	"receiving_team_id" uuid NOT NULL,
	"status" "trade_status" DEFAULT 'pending' NOT NULL,
	"comment" text,
	"review_ends_at" timestamp with time zone,
	"counterparty_accepted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_season_id" uuid NOT NULL,
	"type" "league_activity_type" NOT NULL,
	"team_id" uuid,
	"actor_user_id" uuid,
	"player_id" uuid,
	"related_player_id" uuid,
	"claim_id" uuid,
	"trade_id" uuid,
	"summary" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"overall" integer NOT NULL,
	"round" integer NOT NULL,
	"pick_in_round" integer NOT NULL,
	"team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"source" "draft_pick_source" DEFAULT 'manual' NOT NULL,
	"made_at" timestamp with time zone DEFAULT now() NOT NULL,
	"made_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "draft_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_season_id" uuid NOT NULL,
	"status" "draft_status" DEFAULT 'scheduled' NOT NULL,
	"current_pick_index" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"nfl_team" text,
	"primary_position_id" text NOT NULL,
	"sleeper_search_rank" integer,
	"years_exp" integer,
	"bye_week" integer,
	"injury_status" text,
	"rookie_year" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_external_ids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"provider" "player_external_id_provider" NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"season" text NOT NULL,
	"week" integer NOT NULL,
	"season_type" text DEFAULT 'regular' NOT NULL,
	"kind" "player_score_kind" NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pts_ppr" double precision,
	"pts_std" double precision,
	"gp" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matchups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_season_id" uuid NOT NULL,
	"week" integer NOT NULL,
	"home_team_id" uuid NOT NULL,
	"away_team_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_commissioner_id_profiles_id_fk" FOREIGN KEY ("commissioner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_seasons" ADD CONSTRAINT "league_seasons_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_league_season_id_league_seasons_id_fk" FOREIGN KEY ("league_season_id") REFERENCES "public"."league_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_league_season_id_league_seasons_id_fk" FOREIGN KEY ("league_season_id") REFERENCES "public"."league_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_watchlist" ADD CONSTRAINT "team_watchlist_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_watchlist" ADD CONSTRAINT "team_watchlist_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_players" ADD CONSTRAINT "roster_players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_players" ADD CONSTRAINT "roster_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiver_claims" ADD CONSTRAINT "waiver_claims_league_season_id_league_seasons_id_fk" FOREIGN KEY ("league_season_id") REFERENCES "public"."league_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiver_claims" ADD CONSTRAINT "waiver_claims_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiver_claims" ADD CONSTRAINT "waiver_claims_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiver_claims" ADD CONSTRAINT "waiver_claims_drop_player_id_players_id_fk" FOREIGN KEY ("drop_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_players" ADD CONSTRAINT "trade_players_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_players" ADD CONSTRAINT "trade_players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_players" ADD CONSTRAINT "trade_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_league_season_id_league_seasons_id_fk" FOREIGN KEY ("league_season_id") REFERENCES "public"."league_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_proposing_team_id_teams_id_fk" FOREIGN KEY ("proposing_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_receiving_team_id_teams_id_fk" FOREIGN KEY ("receiving_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_created_by_user_id_profiles_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_activity" ADD CONSTRAINT "league_activity_league_season_id_league_seasons_id_fk" FOREIGN KEY ("league_season_id") REFERENCES "public"."league_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_activity" ADD CONSTRAINT "league_activity_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_activity" ADD CONSTRAINT "league_activity_actor_user_id_profiles_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_activity" ADD CONSTRAINT "league_activity_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_activity" ADD CONSTRAINT "league_activity_related_player_id_players_id_fk" FOREIGN KEY ("related_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_activity" ADD CONSTRAINT "league_activity_claim_id_waiver_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."waiver_claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_activity" ADD CONSTRAINT "league_activity_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_queue" ADD CONSTRAINT "draft_queue_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_queue" ADD CONSTRAINT "draft_queue_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_league_season_id_league_seasons_id_fk" FOREIGN KEY ("league_season_id") REFERENCES "public"."league_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_primary_position_id_positions_id_fk" FOREIGN KEY ("primary_position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_external_ids" ADD CONSTRAINT "player_external_ids_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_scores" ADD CONSTRAINT "player_scores_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_league_season_id_league_seasons_id_fk" FOREIGN KEY ("league_season_id") REFERENCES "public"."league_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "league_members_league_user_idx" ON "league_members" USING btree ("league_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "league_seasons_league_year_idx" ON "league_seasons" USING btree ("league_id","season_year");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_season_user_idx" ON "teams" USING btree ("league_season_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_season_slug_idx" ON "teams" USING btree ("league_season_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "team_watchlist_team_player_idx" ON "team_watchlist" USING btree ("team_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roster_players_team_player_idx" ON "roster_players" USING btree ("team_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waiver_claims_pending_team_player_idx" ON "waiver_claims" USING btree ("team_id","player_id") WHERE "waiver_claims"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "trade_players_trade_team_player_idx" ON "trade_players" USING btree ("trade_id","team_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "draft_picks_draft_overall_idx" ON "draft_picks" USING btree ("draft_id","overall");--> statement-breakpoint
CREATE UNIQUE INDEX "draft_picks_draft_player_idx" ON "draft_picks" USING btree ("draft_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "draft_queue_team_player_idx" ON "draft_queue" USING btree ("team_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "drafts_season_idx" ON "drafts" USING btree ("league_season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_external_ids_provider_external_id_idx" ON "player_external_ids" USING btree ("provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_scores_unique_idx" ON "player_scores" USING btree ("player_id","season","week","season_type","kind");--> statement-breakpoint
CREATE INDEX "player_scores_season_week_kind_idx" ON "player_scores" USING btree ("season","week","season_type","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "matchups_season_week_home_away_idx" ON "matchups" USING btree ("league_season_id","week","home_team_id","away_team_id");