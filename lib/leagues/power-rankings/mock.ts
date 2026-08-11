import {
  pickTrendingTeams,
  summarizePowerRankTrajectory,
  trajectoryToChartData,
  type PowerRankTrajectoryTick,
} from "@/lib/leagues/power-rankings/trajectory";
import {
  powerScoreTone,
  scalePowerScoresToBarometer,
  type PowerRankingTeamRow,
} from "@/lib/leagues/power-rankings/types";
import {
  standingsOwnerName,
  type LeagueStandingsMember,
} from "@/lib/leagues/standings";
import type { PowerRankingsOverview } from "@/lib/queries/power-rankings";

/** Throwaway multi-week overview — remove when weekly power rankings are live. */
const MOCK_WEEKS = 6;

function claimedTeams(members: LeagueStandingsMember[]) {
  return members.flatMap((team) => {
    if (!team.teamId) return [];
    return [
      {
        teamId: team.teamId,
        teamPublicId: team.teamPublicId ?? null,
        teamName: team.teamName?.trim() || "Team",
        ownerName: standingsOwnerName(team, "Manager"),
        ownerUserId: team.userId ?? null,
        logoUrl: team.logoUrl ?? null,
      },
    ];
  });
}

/** Rotate ranks so every team moves over the mock season. */
function ranksForTick(
  teamIds: string[],
  tickIndex: number,
): Record<string, number> {
  const n = teamIds.length;
  const ranks: Record<string, number> = {};
  teamIds.forEach((teamId, index) => {
    ranks[teamId] = ((index + tickIndex) % n) + 1;
  });
  return ranks;
}

function draftRowsFromRanks(
  teams: ReturnType<typeof claimedTeams>,
  ranksByTeamId: Record<string, number>,
): PowerRankingTeamRow[] {
  const raw = new Map(
    teams.map((team) => [
      team.teamId,
      Math.max(1, teams.length + 1 - (ranksByTeamId[team.teamId] ?? teams.length)),
    ]),
  );
  const scores = scalePowerScoresToBarometer(raw);

  return [...teams]
    .sort(
      (a, b) =>
        (ranksByTeamId[a.teamId] ?? 99) - (ranksByTeamId[b.teamId] ?? 99),
    )
    .map((team, index) => {
      const powerScore = scores.get(team.teamId) ?? 0;
      return {
        rank: index + 1,
        rankDelta: null,
        teamId: team.teamId,
        teamPublicId: team.teamPublicId,
        teamName: team.teamName,
        ownerName: team.ownerName,
        ownerUserId: team.ownerUserId,
        logoUrl: team.logoUrl,
        powerScore,
        tone: powerScoreTone(powerScore),
      };
    });
}

/**
 * Dev-only mock overview using the league’s real teams with a fake
 * Draft → Week 1…N trajectory so trends + chart have something to show.
 */
export function buildMockPowerRankingsOverview(input: {
  standingsTeams: LeagueStandingsMember[];
  myTeamId: string | null;
}): PowerRankingsOverview {
  const teams = claimedTeams(input.standingsTeams);
  if (teams.length === 0) {
    return {
      draftRows: [],
      weekRows: [],
      rosRows: [],
      ticks: [],
      chartData: [],
      summaries: [],
      trendingUp: [],
      trendingDown: [],
      teamCount: 0,
      mySummary: null,
    };
  }

  const teamIds = teams.map((team) => team.teamId);
  const ticks: PowerRankTrajectoryTick[] = [
    {
      id: "draft",
      label: "Draft",
      week: null,
      ranksByTeamId: ranksForTick(teamIds, 0),
    },
  ];

  for (let week = 1; week <= MOCK_WEEKS; week++) {
    ticks.push({
      id: `week-${week}`,
      label: `Week ${week}`,
      week,
      ranksByTeamId: ranksForTick(teamIds, week),
    });
  }

  const summaries = summarizePowerRankTrajectory({ ticks, teams });
  const summaryById = new Map(
    summaries.map((row) => [row.teamId, row] as const),
  );
  const draftRanks = ticks[0]!.ranksByTeamId;
  const draftRows = draftRowsFromRanks(teams, draftRanks);

  return {
    draftRows,
    weekRows: draftRowsFromRanks(teams, ranksForTick(teamIds, 1)),
    rosRows: draftRowsFromRanks(teams, ranksForTick(teamIds, 2)),
    ticks,
    chartData: trajectoryToChartData(ticks, teamIds),
    summaries,
    trendingUp: pickTrendingTeams(summaries, "up"),
    trendingDown: pickTrendingTeams(summaries, "down"),
    teamCount: teams.length,
    mySummary: input.myTeamId
      ? (summaryById.get(input.myTeamId) ?? null)
      : null,
  };
}
