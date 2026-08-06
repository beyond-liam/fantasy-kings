import "server-only";

import { cache } from "react";

import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { computeDraftGrades } from "@/lib/leagues/draft/grades";
import {
  countStarterSlots,
  toDraftGradePickInputs,
} from "@/lib/leagues/draft/grade-picks";
import {
  buildDraftPowerRankingRows,
  buildEmptyDraftPowerRankingRows,
} from "@/lib/leagues/power-rankings/draft";
import type { PowerRankingTeamRow } from "@/lib/leagues/power-rankings/types";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import { getDraftBySeasonId, getDraftPicks } from "@/lib/queries/draft";
import { getRankedPlayers } from "@/lib/queries/players";

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
