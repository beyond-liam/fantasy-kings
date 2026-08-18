ALTER TABLE "teams" ADD COLUMN "consecutive_expired_picks" integer DEFAULT 0 NOT NULL;
ALTER TABLE "teams" ADD COLUMN "forced_auto_pick" boolean DEFAULT false NOT NULL;
