import "server-only";

import { cache } from "react";

import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { computeDraftGrades } from "@/lib/leagues/draft/grades";
import {
  countStarterSlots,
  toDraftGradePickInputs,
} from "@/lib/leagues/draft/grade-picks";
import { getFinalMatchupsForSeason } from "@/lib/leagues/matchups/finals";
import {
  buildDraftPowerRankingRows,
  buildEmptyDraftPowerRankingRows,
} from "@/lib/leagues/power-rankings/draft";
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

export type PowerRankingsOverview = {
  draftRows: PowerRankingTeamRow[];
  ticks: PowerRankTrajectoryTick[];
  chartData: Array<Record<string, string | number>>;
  summaries: PowerRankTeamSummary[];
  trendingUp: PowerRankTrendEntry[];
  trendingDown: PowerRankTrendEntry[];
  teamCount: number;
  mySummary: PowerRankTeamSummary | null;
};

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
  }): Promise<PowerRankingsOverview> => {
    const [draftRows, finals] = await Promise.all([
      getDraftPowerRankingRows(input),
      getFinalMatchupsForSeason(input.leagueSeasonId).catch(() => []),
    ]);

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
