import "server-only";

import { cache } from "react";

import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { computeDraftGrades } from "@/lib/leagues/draft/grades";
import {
  countStarterSlots,
  toDraftGradePickInputs,
} from "@/lib/leagues/draft/grade-picks";
import { getLeagueRollupMatchups } from "@/lib/leagues/matchups/finals";
import {
  buildDraftPowerRankingRows,
  buildEmptyDraftPowerRankingRows,
} from "@/lib/leagues/power-rankings/draft";
import { buildEmptyPowerRankingRows } from "@/lib/leagues/power-rankings/rows";
import { buildRosterPowerRankingRows } from "@/lib/leagues/power-rankings/roster";
import {
  buildPowerRankTrajectory,
  pickTrendingTeams,
  summarizePowerRankTrajectory,
  trajectoryToChartData,
  type PowerRankTeamSummary,
  type PowerRankTrendEntry,
  type PowerRankTrajectoryTick,
} from "@/lib/leagues/power-rankings/trajectory";
import type { PowerRankingTeamRow } from "@/lib/leagues/power-rankings/types";
import {
  standingsOwnerName,
  type LeagueStandingsMember,
} from "@/lib/leagues/standings";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import { getDraftBySeasonId, getDraftPicks } from "@/lib/queries/draft";
import { getRankedPlayers } from "@/lib/queries/players";
import { getTeamRosterPlayers } from "@/lib/queries/team-roster";

export type PowerRankingsOverview = {
  draftRows: PowerRankingTeamRow[];
  weekRows: PowerRankingTeamRow[];
  rosRows: PowerRankingTeamRow[];
  ticks: PowerRankTrajectoryTick[];
  chartData: Array<Record<string, string | number>>;
  summaries: PowerRankTeamSummary[];
  trendingUp: PowerRankTrendEntry[];
  trendingDown: PowerRankTrendEntry[];
  teamCount: number;
  mySummary: PowerRankTeamSummary | null;
};

async function loadProjectionPts(input: {
  playerIds: string[];
  seasonYear: number;
  week: number;
  scoringRules: ReturnType<typeof resolveScoringRuleDefinitions>;
}): Promise<Map<string, number>> {
  if (input.playerIds.length === 0) return new Map();
  const ranked = await getRankedPlayers({
    season: String(input.seasonYear),
    week: input.week,
    kind: "projection",
    scoringRules: input.scoringRules,
    playerIds: input.playerIds,
    includePositionRanks: false,
  }).catch(() => []);
  return new Map(
    ranked.map((row) => [row.id, row.fantasyPts ?? 0] as const),
  );
}

async function loadRosterPlayerIdsByTeam(
  standingsTeams: LeagueStandingsMember[],
): Promise<Map<string, string[]>> {
  const claimed = standingsTeams.filter((team) => team.teamId);
  const entries = await Promise.all(
    claimed.map(async (team) => {
      const players = await getTeamRosterPlayers(team.teamId!);
      return [team.teamId!, players.map((player) => player.id)] as const;
    }),
  );
  return new Map(entries);
}

export const getDraftPowerRankingRows = cache(
  async (input: {
    leagueSeasonId: string;
    seasonYear: number;
    standingsTeams: LeagueStandingsMember[];
    settings: LeagueSeasonSettings;
    scoringPreset: string;
    regularSeasonEndWeek: number;
    playoffTeamCount: number;
  }): Promise<PowerRankingTeamRow[]> => {
    const claimed = input.standingsTeams.filter((team) => team.teamId);
    if (claimed.length === 0) return [];

    const draft = await getDraftBySeasonId(input.leagueSeasonId);
    if (!draft) {
      return buildEmptyDraftPowerRankingRows(input.standingsTeams);
    }

    const picks = await getDraftPicks(draft.id);
    if (picks.length === 0) {
      return buildEmptyDraftPowerRankingRows(input.standingsTeams);
    }

    const scoringRules = resolveScoringRuleDefinitions(
      input.scoringPreset as ScoringPreset,
      input.settings.scoringRules,
    );

    const playerIds = [...new Set(picks.map((pick) => pick.playerId))];
    const ranked = await getRankedPlayers({
      season: String(input.seasonYear),
      week: 0,
      kind: "projection",
      scoringRules,
      playerIds,
      includePositionRanks: false,
    }).catch(() => []);

    const rankedById = new Map(ranked.map((row) => [row.id, row]));
    const gradeInputs = toDraftGradePickInputs(picks, rankedById);
    const grades = computeDraftGrades({
      teams: claimed.map((team) => ({ teamId: team.teamId! })),
      picks: gradeInputs,
      starterSlots: countStarterSlots(input.settings),
      regularSeasonWeeks: input.regularSeasonEndWeek,
      playoffTeamCount: input.playoffTeamCount,
    });

    return buildDraftPowerRankingRows({
      teams: input.standingsTeams,
      grades,
    });
  },
);

export const getPowerRankingsOverview = cache(
  async (input: {
    leagueSeasonId: string;
    seasonYear: number;
    standingsTeams: LeagueStandingsMember[];
    settings: LeagueSeasonSettings;
    scoringPreset: string;
    regularSeasonEndWeek: number;
    playoffTeamCount: number;
    teamCount: number;
    myTeamId: string | null;
    showFaabBudget: boolean;
    faabBudget: number | null;
    upcomingWeek: number;
  }): Promise<PowerRankingsOverview> => {
    const scoringRules = resolveScoringRuleDefinitions(
      input.scoringPreset as ScoringPreset,
      input.settings.scoringRules,
    );
    const starterSlots = countStarterSlots(input.settings);
    const week = Math.max(1, input.upcomingWeek);

    const [draftRows, finals, playerIdsByTeamId] = await Promise.all([
      getDraftPowerRankingRows(input),
      getLeagueRollupMatchups(
        input.leagueSeasonId,
        input.settings.schedule,
      ).catch(() => []),
      loadRosterPlayerIdsByTeam(input.standingsTeams),
    ]);

    const allPlayerIds = [
      ...new Set([...playerIdsByTeamId.values()].flat()),
    ];

    const [seasonPts, weekPts] = await Promise.all([
      loadProjectionPts({
        playerIds: allPlayerIds,
        seasonYear: input.seasonYear,
        week: 0,
        scoringRules,
      }),
      loadProjectionPts({
        playerIds: allPlayerIds,
        seasonYear: input.seasonYear,
        week,
        scoringRules,
      }),
    ]);

    const rosRows =
      allPlayerIds.length === 0
        ? buildEmptyPowerRankingRows(input.standingsTeams)
        : buildRosterPowerRankingRows({
            teams: input.standingsTeams,
            fantasyPtsByPlayerId: seasonPts,
            playerIdsByTeamId,
            starterSlots,
          });

    const weekRows =
      allPlayerIds.length === 0
        ? buildEmptyPowerRankingRows(input.standingsTeams)
        : buildRosterPowerRankingRows({
            teams: input.standingsTeams,
            fantasyPtsByPlayerId: weekPts,
            playerIdsByTeamId,
            starterSlots,
          });

    const claimedTeams = input.standingsTeams.flatMap((team) => {
      if (!team.teamId) return [];
      return [
        {
          teamId: team.teamId,
          teamPublicId: team.teamPublicId ?? null,
          teamName: team.teamName?.trim() || "Team",
          ownerName: standingsOwnerName(team, "Manager"),
          logoUrl: team.logoUrl ?? null,
        },
      ];
    });

    const ticks = buildPowerRankTrajectory({
      draftRows,
      members: input.standingsTeams,
      standingsOptions: {
        teamCount: input.teamCount,
        faabBudget: input.showFaabBudget ? input.faabBudget : null,
      },
      finals,
      tiebreakers: input.settings.tiebreakers,
      maxWeek: input.regularSeasonEndWeek,
    });

    const summaries = summarizePowerRankTrajectory({
      ticks,
      teams: claimedTeams,
    });
    const summaryById = new Map(
      summaries.map((row) => [row.teamId, row] as const),
    );

    return {
      draftRows,
      weekRows,
      rosRows,
      ticks,
      chartData: trajectoryToChartData(
        ticks,
        claimedTeams.map((team) => team.teamId),
      ),
      summaries,
      trendingUp: pickTrendingTeams(summaries, "up"),
      trendingDown: pickTrendingTeams(summaries, "down"),
      teamCount: claimedTeams.length,
      mySummary: input.myTeamId
        ? (summaryById.get(input.myTeamId) ?? null)
        : null,
    };
  },
);
