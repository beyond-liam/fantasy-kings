import { pgEnum } from "drizzle-orm/pg-core";

export const leagueTypeEnum = pgEnum("league_type", ["redraft", "dynasty"]);

export const scoringPresetEnum = pgEnum("scoring_preset", [
  "standard",
  "half_ppr",
  "full_ppr",
]);

export const rosterModeEnum = pgEnum("roster_mode", ["standard", "custom"]);

export const waiverTypeEnum = pgEnum("waiver_type", ["priority", "faab"]);

export const waiverClaimStatusEnum = pgEnum("waiver_claim_status", [
  "pending",
  "awarded",
  "failed",
  "cancelled",
]);

export const leagueActivityTypeEnum = pgEnum("league_activity_type", [
  "waiver_awarded",
  "waiver_failed",
  "trade_proposed",
  "trade_completed",
  "trade_rejected",
  "trade_cancelled",
  "trade_vetoed",
  "member_removed",
  "player_added",
  "player_dropped",
  "ir_added",
  "ir_removed",
  "taxi_added",
  "taxi_removed",
]);

export const tradeStatusEnum = pgEnum("trade_status", [
  "pending",
  "review",
  "awaiting_commissioner",
  "completed",
  "rejected",
  "cancelled",
  "commissioner_rejected",
  "vetoed",
  "invalidated",
]);

export const tradeProcessingEnum = pgEnum("trade_processing", [
  "commissioner",
  "review_24h",
  "instant",
]);

export const draftTypeEnum = pgEnum("draft_type", ["live", "email"]);

export const seasonStatusEnum = pgEnum("season_status", [
  "setup",
  "recruiting",
  "draft",
  "active",
]);
