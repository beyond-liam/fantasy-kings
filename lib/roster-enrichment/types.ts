import type { PlayerOpponent } from "@/lib/nfl/matchups";
import type {
  RosterEvaluationData,
  RosterEvaluationMode,
} from "@/lib/leagues/roster-evaluation/types";
import type { TeamSummaryMatchupRef } from "@/lib/leagues/team-summary";
import type { TeamStatsChartsData } from "@/lib/queries/team-stats-charts";

export const ROSTER_ENRICHMENT_VERSION = 1 as const;

export type RosterPlayerEnrichment = {
  ownedPct: number | null;
  startPct: number | null;
  projectedPts: number | null;
  actualPts: number | null;
  positionRank: number | null;
  fantasyPts: number | null;
  avgPts: number | null;
  opponent: PlayerOpponent | null;
};

export type RosterEnrichmentSuccess = {
  ok: true;
  version: typeof ROSTER_ENRICHMENT_VERSION;
  enrichmentByPlayerId: Record<string, RosterPlayerEnrichment>;
};

export type RosterEnrichmentFailure = {
  ok: false;
  error: string;
};

export type RosterEnrichmentPayload =
  | RosterEnrichmentSuccess
  | RosterEnrichmentFailure;

export type StatsPlayerEnrichment = {
  opponent: PlayerOpponent | null;
};

export type StatsEnrichmentSuccess = {
  ok: true;
  version: typeof ROSTER_ENRICHMENT_VERSION;
  enrichmentByPlayerId: Record<string, StatsPlayerEnrichment>;
  charts: TeamStatsChartsData | null;
  rosterEvaluationByMode: Record<
    RosterEvaluationMode,
    RosterEvaluationData
  > | null;
};

export type StatsEnrichmentFailure = {
  ok: false;
  error: string;
};

export type StatsEnrichmentPayload =
  | StatsEnrichmentSuccess
  | StatsEnrichmentFailure;

export type StatsOptionalEnrichmentSuccess = {
  ok: true;
  version: typeof ROSTER_ENRICHMENT_VERSION;
  charts: TeamStatsChartsData | null;
  rosterEvaluationByMode: Record<
    RosterEvaluationMode,
    RosterEvaluationData
  > | null;
};

export type StatsOptionalEnrichmentFailure = {
  ok: false;
  error: string;
};

export type StatsOptionalEnrichmentPayload =
  | StatsOptionalEnrichmentSuccess
  | StatsOptionalEnrichmentFailure;

export type EnrichmentShellPlayer = {
  id: string;
  nflTeam: string | null;
  byeWeek: number | null;
  primaryPositionId: string;
};

export type RosterWeekPlayerPatch = {
  projectedPts: number | null;
  actualPts: number | null;
  opponent: PlayerOpponent | null;
  slotPositionId?: string | null;
};

export type RosterWeekDisplaySuccess = {
  ok: true;
  week: number;
  currentWeek: number;
  players: Record<string, RosterWeekPlayerPatch>;
  gameLockedPlayerIds: string[];
  slateFinalized: boolean;
  summary: {
    previous: TeamSummaryMatchupRef | null;
    current: TeamSummaryMatchupRef | null;
  };
};

export type RosterWeekDisplayFailure = {
  ok: false;
  error: string;
};

export type RosterWeekDisplayPayload =
  | RosterWeekDisplaySuccess
  | RosterWeekDisplayFailure;
