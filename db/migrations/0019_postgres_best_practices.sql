-- Follow-up hardening: RLS on post-0009 tables, FK + partial indexes.
-- Runtime app continues to use the table-owner connection (bypasses RLS).

-- 1) RLS deny-by-default for Data API (no policies)
ALTER TABLE "team_week_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "message_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "message_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "message_thread_reads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_week_lineups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- 2) Matchups: FK indexes + status partials
CREATE INDEX IF NOT EXISTS "matchups_home_team_id_idx"
  ON "matchups" USING btree ("home_team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matchups_away_team_id_idx"
  ON "matchups" USING btree ("away_team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matchups_season_final_idx"
  ON "matchups" USING btree ("league_season_id", "week")
  WHERE "status" = 'final';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matchups_season_week_nonfinal_idx"
  ON "matchups" USING btree ("league_season_id", "week")
  WHERE "status" <> 'final';--> statement-breakpoint

-- 3) Priority secondary FK indexes
CREATE INDEX IF NOT EXISTS "draft_picks_team_id_idx"
  ON "draft_picks" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_week_lineups_player_id_idx"
  ON "team_week_lineups" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_week_stats_team_id_idx"
  ON "team_week_stats" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "league_activity_team_id_idx"
  ON "league_activity" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "league_activity_actor_user_id_idx"
  ON "league_activity" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "league_activity_player_id_idx"
  ON "league_activity" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "league_activity_claim_id_idx"
  ON "league_activity" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "league_activity_trade_id_idx"
  ON "league_activity" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_league_season_id_idx"
  ON "notifications" USING btree ("league_season_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_trade_id_idx"
  ON "notifications" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_claim_id_idx"
  ON "notifications" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_player_id_idx"
  ON "notifications" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_matchup_id_idx"
  ON "notifications" USING btree ("matchup_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_posts_author_user_id_idx"
  ON "message_posts" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_thread_reads_thread_id_idx"
  ON "message_thread_reads" USING btree ("thread_id");
