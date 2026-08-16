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
  | "sun"
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat";

export type WaiverWireSettings = {
  allowZeroBids: boolean;
  waiverPool: "drops_only" | "drops_and_free_agents";
  dropWaiverHours: 24 | 48;
  churnPrevention: "return_to_fa" | "block_late_drops" | "none";
  fcfsMode: "after_process" | "never";
  processDays: WaiverProcessDay[];
  resetOrderWeekly: boolean;
  /**
   * When true, dropped players who have not played yet process daily.
   * Players who already played, or whose game is before the next daily run,
   * wait until `processDays` (weekly).
   */
  dailyDropProcessing: boolean;
  /**
   * When true during fantasy-league preseason (after the draft, until the
   * league's first counting fantasy week), free agents always require a waiver
   * claim (FCFS is paused). When false, free agents are unlocked.
   * Drop waivers still apply either way unless churn prevention skips them.
   */
  preseasonWaivers: boolean;
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
  /**
   * @deprecated Prefer `waiverWire.preseasonWaivers`. Kept for migration.
   * `always_on_waivers` ≈ preseasonWaivers true; `unlocked` ≈ false.
   */
  preseasonFreeAgents: "always_on_waivers" | "unlocked";
  preventCutsAfterGameStart: boolean;
  allowVetoes: boolean;
  transactionLimits: "unlimited" | "weekly" | "season" | "both";
  /** Cap when weekly or both; ignored when unlimited/season. */
  transactionWeeklyMax?: number | null;
  /** Cap when season or both; ignored when unlimited/weekly. */
  transactionSeasonMax?: number | null;
};

export type DraftStyle = "snake" | "linear";

export type DraftSettings = {
  style: DraftStyle;
  /** Timed seats autodraft on clock expiry. Mirrors pickTimeLimitEnabled. */
  autoPickEnabled: boolean;
  /**
   * Slow/email drafts only: when false, managers have unlimited time on the clock.
   * Live drafts always use the pick timer.
   */
  pickTimeLimitEnabled?: boolean;
  /**
   * Timed email drafts only: daily UK (`Europe/London`) window when the draft
   * auto-pauses. Times are `HH:mm` UK wall clock (GMT/BST); overnight wrap
   * (e.g. 22:00→08:00) is allowed.
   */
  pauseWindowEnabled?: boolean;
  pauseWindowStart?: string;
  pauseWindowEnd?: string;
};

/** How many times each pair should ideally face off over the regular season. */
export type PlayEachOtherTimes = 1 | 2 | 3;

export type ScheduleSettings = {
  playEachOtherTimes: PlayEachOtherTimes;
  /**
   * When true, fantasy Week 1 starts in NFL preseason (extend calendar).
   * Championship still ends on the configured NFL championship week.
   */
  includePreseason?: boolean;
  /** First user Preseason Week (1–3) that counts as fantasy Week 1. ESPN HOF is excluded. */
  preseasonStartWeek?: number;
};

export type PlayoffSettings = {
  /** When false, the season has no playoff tournament. */
  enabled: boolean;
  reSeedAfterEachRound: boolean;
  twoWeekChampionship: boolean;
};

/** Dynasty-only rules (omit on redraft). See docs/DYNASTY.md §3.2. */
export type DynastyDraftPlayerPool = "rookies" | "all";

export type DynastySettings = {
  /** Hard ceiling on counting keepers (IR/Taxi toggles below). Null = not set. */
  keepersMax: number | null;
  /** Optional floor; null = off. When set, 0 ≤ min ≤ max. */
  keepersMin: number | null;
  /** ISO timestamptz; display/interpret in Europe/London. */
  keeperDeadlineAt: string | null;
  irCountsTowardKeepers: boolean;
  taxiCountsTowardKeepers: boolean;
  /** Future draft years beyond the upcoming draft that can be owned/traded. */
  futurePickTradeYears: number;
  draftPlayerPool: DynastyDraftPlayerPool;
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
  /** Dynasty rules — present when league_type is dynasty. */
  dynasty?: DynastySettings;
  /** Public URL for the league logo. */
  logoUrl?: string | null;
  /** Injury designations that qualify a player for an IR slot. */
  irEligibleStatuses?: string[];
  /**
   * Max NFL years of experience allowed on Taxi
   * (`0` rookies … `5` = 5+ years).
   */
  taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5;
  /**
   * When true, a player who has left Taxi for the active roster cannot return
   * to Taxi. When false (default), Taxi ↔ active moves are unrestricted
   * (aside from years-exp eligibility).
   */
  taxiPreventReaddAfterActivation?: boolean;
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
      .default(true),
    /** Commissioner opened FA before/without completing a draft. */
    freeAgencyOpen: boolean("free_agency_open").notNull().default(false),
    /** Last time waivers were processed for this season (manual or scheduled). */
    lastWaiverProcessedAt: timestamp("last_waiver_processed_at", {
      withTimezone: true,
    }),
    /** Lease timestamp to prevent concurrent waiver processing. */
    waiverProcessingLeaseUntil: timestamp("waiver_processing_lease_until", {
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
