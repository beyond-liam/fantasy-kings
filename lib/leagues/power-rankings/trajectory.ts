import type { TiebreakerSettings } from "@/db/schema/league-seasons";
import { buildLeagueStandings } from "@/lib/leagues/standings-from-matchups";
import type { PowerRankingTeamRow } from "@/lib/leagues/power-rankings/types";
import type {
  BuildStandingsOptions,
  FinalMatchupRecord,
  LeagueStandingsMember,
} from "@/lib/leagues/standings";

export type PowerRankTrajectoryTick = {
  id: string;
  label: string;
  /** null = draft starting point. */
  week: number | null;
  ranksByTeamId: Record<string, number>;
};

export type PowerRankTeamSummary = {
  teamId: string;
  teamPublicId: string | null;
  teamName: string;
  ownerName: string;
  logoUrl: string | null;
  draftRank: number | null;
  currentRank: number | null;
  highestRank: number | null;
  lowestRank: number | null;
  /** Previous tick rank − current (positive = moved up). */
  rankDelta: number | null;
};

export type PowerRankTrendEntry = {
  teamId: string;
  teamPublicId: string | null;
  teamName: string;
  ownerName: string;
  logoUrl: string | null;
  currentRank: number;
  rankDelta: number;
};

function scoredWeeks(finals: FinalMatchupRecord[]): number[] {
  const weeks = new Set<number>();
  for (const row of finals) {
    if (row.homePts == null || row.awayPts == null) continue;
    weeks.add(row.week);
  }
  return [...weeks].sort((a, b) => a - b);
}

function ranksFromDraftRows(
  rows: PowerRankingTeamRow[],
): Record<string, number> {
  const ranks: Record<string, number> = {};
  for (const row of rows) {
    ranks[row.teamId] = row.rank;
  }
  return ranks;
}

function ranksFromStandingsThroughWeek(input: {
  members: LeagueStandingsMember[];
  standingsOptions: BuildStandingsOptions;
  finals: FinalMatchupRecord[];
  week: number;
  tiebreakers?: TiebreakerSettings | null;
}): Record<string, number> {
  const filtered = input.finals.filter(
    (row) =>
      row.week <= input.week &&
      row.homePts != null &&
      row.awayPts != null,
  );
  const standings = buildLeagueStandings(
    input.members,
    input.standingsOptions,
    filtered,
    input.tiebreakers,
  );
  const ranks: Record<string, number> = {};
  for (const row of standings) {
    if (!row.teamId || row.rank == null) continue;
    ranks[row.teamId] = row.rank;
  }
  return ranks;
}

/**
 * Draft power ranks, then one tick per scored fantasy week using standings
 * rank through that week (until weekly power rankings exist).
 */
export function buildPowerRankTrajectory(input: {
  draftRows: PowerRankingTeamRow[];
  members: LeagueStandingsMember[];
  standingsOptions: BuildStandingsOptions;
  finals: FinalMatchupRecord[];
  tiebreakers?: TiebreakerSettings | null;
  /** Cap weekly ticks (e.g. regular season end). */
  maxWeek?: number;
}): PowerRankTrajectoryTick[] {
  const ticks: PowerRankTrajectoryTick[] = [];
  const draftRanks = ranksFromDraftRows(input.draftRows);
  if (Object.keys(draftRanks).length > 0) {
    ticks.push({
      id: "draft",
      label: "Draft",
      week: null,
      ranksByTeamId: draftRanks,
    });
  }

  const maxWeek = input.maxWeek ?? Number.POSITIVE_INFINITY;
  for (const week of scoredWeeks(input.finals)) {
    if (week > maxWeek) continue;
    ticks.push({
      id: `week-${week}`,
      label: `Week ${week}`,
      week,
      ranksByTeamId: ranksFromStandingsThroughWeek({
        members: input.members,
        standingsOptions: input.standingsOptions,
        finals: input.finals,
        week,
        tiebreakers: input.tiebreakers,
      }),
    });
  }

  return ticks;
}

export function summarizePowerRankTrajectory(input: {
  ticks: PowerRankTrajectoryTick[];
  teams: Array<{
    teamId: string;
    teamPublicId: string | null;
    teamName: string;
    ownerName: string;
    logoUrl: string | null;
  }>;
}): PowerRankTeamSummary[] {
  const draftTick = input.ticks.find((tick) => tick.week == null) ?? null;
  const currentTick =
    input.ticks.length > 0 ? input.ticks[input.ticks.length - 1]! : null;
  const previousTick =
    input.ticks.length > 1 ? input.ticks[input.ticks.length - 2]! : null;

  return input.teams.map((team) => {
    const ranks = input.ticks
      .map((tick) => tick.ranksByTeamId[team.teamId])
      .filter((rank): rank is number => rank != null);

    const draftRank = draftTick?.ranksByTeamId[team.teamId] ?? null;
    const currentRank = currentTick?.ranksByTeamId[team.teamId] ?? null;
    const previousRank = previousTick?.ranksByTeamId[team.teamId] ?? null;
    const rankDelta =
      currentRank != null && previousRank != null
        ? previousRank - currentRank
        : null;

    return {
      teamId: team.teamId,
      teamPublicId: team.teamPublicId,
      teamName: team.teamName,
      ownerName: team.ownerName,
      logoUrl: team.logoUrl,
      draftRank,
      currentRank,
      highestRank: ranks.length > 0 ? Math.min(...ranks) : null,
      lowestRank: ranks.length > 0 ? Math.max(...ranks) : null,
      rankDelta,
    };
  });
}

export function pickTrendingTeams(
  summaries: PowerRankTeamSummary[],
  direction: "up" | "down",
  limit = 1,
): PowerRankTrendEntry[] {
  const filtered = summaries.filter(
    (row): row is PowerRankTeamSummary & {
      currentRank: number;
      rankDelta: number;
    } =>
      row.currentRank != null &&
      row.rankDelta != null &&
      (direction === "up" ? row.rankDelta > 0 : row.rankDelta < 0),
  );

  filtered.sort((a, b) => {
    if (direction === "up") {
      if (b.rankDelta !== a.rankDelta) return b.rankDelta - a.rankDelta;
    } else if (a.rankDelta !== b.rankDelta) {
      return a.rankDelta - b.rankDelta;
    }
    return a.currentRank - b.currentRank;
  });

  return filtered.slice(0, limit).map((row) => ({
    teamId: row.teamId,
    teamPublicId: row.teamPublicId,
    teamName: row.teamName,
    ownerName: row.ownerName,
    logoUrl: row.logoUrl,
    currentRank: row.currentRank,
    rankDelta: row.rankDelta,
  }));
}

/** Recharts-friendly rows: `{ label, [teamId]: rank }`. */
export function trajectoryToChartData(
  ticks: PowerRankTrajectoryTick[],
  teamIds: string[],
): Array<Record<string, string | number>> {
  return ticks.map((tick) => {
    const row: Record<string, string | number> = {
      label: tick.label,
      tickId: tick.id,
    };
    for (const teamId of teamIds) {
      const rank = tick.ranksByTeamId[teamId];
      if (rank != null) row[teamId] = rank;
    }
    return row;
  });
}

export function chartColorVar(index: number): string {
  const n = (index % 6) + 1;
  return `var(--chart-${n})`;
}
