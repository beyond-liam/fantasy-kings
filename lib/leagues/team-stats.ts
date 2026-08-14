import type { ScheduleSettings } from "@/db/schema/league-seasons";
import {
  resolvePlayerScorePoint,
  type PlayerScoreNflState,
} from "@/lib/leagues/schedule/player-score-point";
import { playerWeekHasFantasyAppearance } from "@/lib/players/week-appearance";
import type { RankedPlayerRow } from "@/lib/queries/players";
import type { PositionFilter } from "@/lib/rankings/column-config";
import {
  countingGamesHaveStarted,
  resolveTablePositionRanks,
  type PositionRankSource,
} from "@/lib/rankings/table-rank-source";

export type TeamStatsSectionId =
  | "quarterbacks"
  | "running-backs"
  | "receivers"
  | "kickers"
  | "defensive-backs"
  | "defensive-linemen"
  | "linebackers"
  | "defense";

export type TeamStatsSection = {
  id: TeamStatsSectionId;
  title: string;
  /** Column layout source for players-table stats. */
  columnPosition: PositionFilter;
  players: RankedPlayerRow[];
};

const ADP_STAT_KEYS = [
  "adp_ppr",
  "adp_dd_ppr",
  "adp_half_ppr",
  "adp_std",
  "adp_idp",
  "adp_idp_1qb",
] as const;

const RECEIVER_POSITIONS = new Set(["WR", "TE", "FLEX"]);
const DEFENSIVE_BACK_POSITIONS = new Set(["CB", "S"]);
const DEFENSIVE_LINE_POSITIONS = new Set(["DT", "DE"]);

export type TeamPlayerStatsSource = {
  kind: "projection" | "stats";
  week: number;
  seasonType: string;
  positionRanks: PositionRankSource;
};

/**
 * Player Stats tab: projections until counting games start, then this week's
 * actuals (pre vs regular follows league `includePreseason`).
 */
export function resolveTeamPlayerStatsSource(input: {
  nfl: PlayerScoreNflState;
  schedule?: ScheduleSettings | null;
  seasonYear: number;
}): TeamPlayerStatsSource {
  const statsPoint = resolvePlayerScorePoint({
    selectedWeek: 0,
    kind: "stats",
    nfl: input.nfl,
    schedule: input.schedule,
    seasonYear: input.seasonYear,
  });
  const seasonStarted = countingGamesHaveStarted(statsPoint);
  const kind = seasonStarted ? "stats" : "projection";
  const scorePoint =
    kind === "stats"
      ? statsPoint
      : { week: 0, seasonType: "regular" as const };

  return {
    kind,
    week: scorePoint.week,
    seasonType: scorePoint.seasonType,
    positionRanks: resolveTablePositionRanks({
      kind,
      scorePoint,
      statsPoint,
      isCurrentSeason: true,
    }),
  };
}

function pickAdpStats(
  stats: Record<string, number | null>,
): Record<string, number | null> {
  const adp: Record<string, number | null> = {};
  for (const key of ADP_STAT_KEYS) {
    const value = stats[key];
    if (value != null) {
      adp[key] = value;
    }
  }
  return adp;
}

/**
 * Keep every rostered player; swap in this week's actuals when they exist.
 * Unplayed rows stay on the table with null PTS (ADP preserved).
 */
export function overlayTeamPlayerStatRows(
  universe: RankedPlayerRow[],
  actuals: RankedPlayerRow[],
): RankedPlayerRow[] {
  const actualById = new Map(actuals.map((row) => [row.id, row]));
  return universe.map((player) => {
    const adp = pickAdpStats(player.stats);
    const actual = actualById.get(player.id);
    if (!actual || !playerWeekHasFantasyAppearance(actual.stats)) {
      return {
        ...player,
        fantasyPts: null,
        ptsPpr: null,
        ptsStd: null,
        stats: adp,
      };
    }
    return {
      ...player,
      stats: { ...actual.stats, ...adp },
      fantasyPts: actual.fantasyPts,
      ptsPpr: actual.ptsPpr,
      ptsStd: actual.ptsStd,
      positionRank: actual.positionRank ?? player.positionRank,
    };
  });
}

function byFantasyPts(a: RankedPlayerRow, b: RankedPlayerRow) {
  return (b.fantasyPts ?? 0) - (a.fantasyPts ?? 0);
}

function section(
  id: TeamStatsSectionId,
  title: string,
  columnPosition: PositionFilter,
  players: RankedPlayerRow[],
): TeamStatsSection {
  return {
    id,
    title,
    columnPosition,
    players: players.sort(byFantasyPts),
  };
}

/**
 * Group roster players into Player Stats tables.
 * Team DEF and IDP buckets are omitted when empty so offense-only rosters
 * stay clean.
 */
export function groupRosterPlayersForStats(
  players: RankedPlayerRow[],
): TeamStatsSection[] {
  const quarterbacks: RankedPlayerRow[] = [];
  const runningBacks: RankedPlayerRow[] = [];
  const receivers: RankedPlayerRow[] = [];
  const kickers: RankedPlayerRow[] = [];
  const defensiveBacks: RankedPlayerRow[] = [];
  const defensiveLinemen: RankedPlayerRow[] = [];
  const linebackers: RankedPlayerRow[] = [];
  const defense: RankedPlayerRow[] = [];

  for (const player of players) {
    const position = player.primaryPositionId;

    if (position === "QB") {
      quarterbacks.push(player);
      continue;
    }

    if (position === "RB") {
      runningBacks.push(player);
      continue;
    }

    if (RECEIVER_POSITIONS.has(position)) {
      receivers.push(player);
      continue;
    }

    if (position === "K") {
      kickers.push(player);
      continue;
    }

    if (DEFENSIVE_BACK_POSITIONS.has(position)) {
      defensiveBacks.push(player);
      continue;
    }

    if (DEFENSIVE_LINE_POSITIONS.has(position)) {
      defensiveLinemen.push(player);
      continue;
    }

    if (position === "LB") {
      linebackers.push(player);
      continue;
    }

    if (position === "DEF") {
      defense.push(player);
    }
  }

  const sections: TeamStatsSection[] = [
    section("quarterbacks", "Quarterbacks", "QB", quarterbacks),
    section("running-backs", "Running Backs", "RB", runningBacks),
    section("receivers", "Receivers", "WR", receivers),
    section("kickers", "Kickers", "K", kickers),
  ];

  if (defensiveBacks.length > 0) {
    sections.push(
      section("defensive-backs", "Defensive Backs", "CB", defensiveBacks),
    );
  }
  if (defensiveLinemen.length > 0) {
    sections.push(
      section("defensive-linemen", "Defensive Linemen", "DE", defensiveLinemen),
    );
  }
  if (linebackers.length > 0) {
    sections.push(section("linebackers", "Linebackers", "LB", linebackers));
  }
  if (defense.length > 0) {
    sections.push(section("defense", "Team Defense", "DEF", defense));
  }

  return sections;
}
