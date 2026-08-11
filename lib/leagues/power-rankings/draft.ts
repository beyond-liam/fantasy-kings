import type { DraftGradeTeamResult } from "@/lib/leagues/draft/grades";
import {
  buildEmptyPowerRankingRows,
  buildPowerRankingRowsFromStrength,
} from "@/lib/leagues/power-rankings/rows";
import type { PowerRankingTeamRow } from "@/lib/leagues/power-rankings/types";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";

/** All claimed teams at 0 before any picks land. */
export function buildEmptyDraftPowerRankingRows(
  teams: LeagueStandingsMember[],
): PowerRankingTeamRow[] {
  return buildEmptyPowerRankingRows(teams);
}

/**
 * Live Draft Rankings from absolute draft-grade projection strength
 * (starters full + bench ×0.35), scaled so the league leader is 100.
 */
export function buildDraftPowerRankingRows(input: {
  teams: LeagueStandingsMember[];
  grades: DraftGradeTeamResult[];
}): PowerRankingTeamRow[] {
  const strengthByTeamId = new Map(
    input.grades.map((grade) => [grade.teamId, grade.projectedStrength]),
  );
  return buildPowerRankingRowsFromStrength({
    teams: input.teams,
    strengthByTeamId,
  });
}
