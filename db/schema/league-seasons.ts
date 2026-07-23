import {
  boolean,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  draftTypeEnum,
  leagueTypeEnum,
  rosterModeEnum,
  scoringPresetEnum,
  seasonStatusEnum,
  tradeProcessingEnum,
  waiverTypeEnum,
} from "./league-enums";
import { leagues } from "./leagues";

export type RosterSlotConfig = {
  positionId: string;
  slotCount: number;
  minSlots: number;
  maxSlots: number;
  isStarter: boolean;
};

import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";

export type LineupLockMode = "first_game" | "individual";

export type WaiverProcessDay =
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun"
  | "mon";

export type WaiverWireSettings = {
  allowZeroBids: boolean;
  waiverPool: "drops_only" | "drops_and_free_agents";
  dropWaiverHours: 24 | 48;
  churnPrevention: "return_to_fa" | "block_late_drops" | "none";
  fcfsMode: "after_process" | "never";
  processDays: WaiverProcessDay[];
  resetOrderWeekly: boolean;
};

export type GameTiebreakerId =
  | "offensive_special_tds"
  | "highest_starter"
  | "bench_points";

export type RankTiebreakerId =
  | "head_to_head"
  | "points_per_game"
  | "schedule_record"
  | "schedule_points";

export type TiebreakerSettings = {
  gameTiebreakers: GameTiebreakerId[];
  breakRegularSeasonTies: boolean;
  rankTiebreakers: RankTiebreakerId[];
  applyOfficialStatChanges: boolean;
};

export type TransactionRulesSettings = {
  permitTradesAfterSeason: boolean;
  addDropDeadlineWeek: number | null;
  permitAddDropsAfterSeason: boolean;
  enforceRosterMinimums: boolean;
  preseasonFreeAgents: "always_on_waivers" | "unlocked";
  preventCutsAfterGameStart: boolean;
  allowVetoes: boolean;
  transactionLimits: "unlimited" | "weekly" | "season" | "both";
};

export type DraftStyle = "snake" | "linear";

export type DraftSettings = {
  style: DraftStyle;
  /** League-wide default for whether managers draft with autopick on. */
  autoPickEnabled: boolean;
  /**
   * Slow/email drafts only: when false, managers have unlimited time on the clock.
   * Live drafts always use the pick timer.
   */
  pickTimeLimitEnabled?: boolean;
};

/** How many times each pair should ideally face off over the regular season. */
export type PlayEachOtherTimes = 1 | 2 | 3;

export type ScheduleSettings = {
  playEachOtherTimes: PlayEachOtherTimes;
};

export type PlayoffSettings = {
  /** When false, the season has no playoff tournament. */
  enabled: boolean;
  reSeedAfterEachRound: boolean;
  twoWeekChampionship: boolean;
};

export type LeagueSeasonSettings = {
  rosterSlots: RosterSlotConfig[];
  scoringRules?: ScoringRuleDefinition[];
  /** When starter lineup edits lock for the week. */
  lineupLockMode?: LineupLockMode;
  waiverWire?: WaiverWireSettings;
  tiebreakers?: TiebreakerSettings;
  transactionRules?: TransactionRulesSettings;
  draft?: DraftSettings;
  schedule?: ScheduleSettings;
  playoffs?: PlayoffSettings;
  /** Public URL for the league logo. */
  logoUrl?: string | null;
  /** Injury designations that qualify a player for an IR slot. */
  irEligibleStatuses?: string[];
};

export const leagueSeasons = pgTable(
  "league_seasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    seasonYear: integer("season_year").notNull(),
    status: seasonStatusEnum("status").notNull().default("recruiting"),
    leagueType: leagueTypeEnum("league_type").notNull().default("redraft"),
    teamCount: integer("team_count").notNull(),
    divisionCount: integer("division_count").notNull().default(1),
    playoffTeamCount: integer("playoff_team_count").notNull(),
    championshipWeek: integer("championship_week").notNull(),
    regularSeasonEndWeek: integer("regular_season_end_week").notNull(),
    rosterMode: rosterModeEnum("roster_mode").notNull().default("standard"),
    benchSlots: integer("bench_slots").notNull().default(6),
    irEnabled: boolean("ir_enabled").notNull().default(false),
    irSlots: integer("ir_slots").notNull().default(0),
    taxiEnabled: boolean("taxi_enabled").notNull().default(false),
    taxiSlots: integer("taxi_slots").notNull().default(0),
    scoringPreset: scoringPresetEnum("scoring_preset")
      .notNull()
      .default("full_ppr"),
    waiversEnabled: boolean("waivers_enabled").notNull().default(true),
    waiverType: waiverTypeEnum("waiver_type").notNull().default("priority"),
    faabBudget: integer("faab_budget"),
    tradesEnabled: boolean("trades_enabled").notNull().default(true),
    tradeProcessing: tradeProcessingEnum("trade_processing")
      .notNull()
      .default("review_24h"),
    tradeDeadlineWeek: integer("trade_deadline_week"),
    draftType: draftTypeEnum("draft_type").notNull().default("live"),
    draftStartAt: timestamp("draft_start_at", { withTimezone: true }).notNull(),
    pickTimeLimitSeconds: integer("pick_time_limit_seconds").notNull(),
    emailNotificationsEnabled: boolean("email_notifications_enabled")
      .notNull()
      .default(false),
    /** Commissioner opened FA before/without completing a draft. */
    freeAgencyOpen: boolean("free_agency_open").notNull().default(false),
    /** Last time waivers were processed for this season (manual or scheduled). */
    lastWaiverProcessedAt: timestamp("last_waiver_processed_at", {
      withTimezone: true,
    }),
    settings: jsonb("settings").$type<LeagueSeasonSettings>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("league_seasons_league_year_idx").on(
      table.leagueId,
      table.seasonYear,
    ),
  ],
);
