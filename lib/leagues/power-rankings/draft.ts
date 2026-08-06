import {
  standingsOwnerName,
  type LeagueStandingsMember,
} from "@/lib/leagues/standings";
import type { DraftGradeTeamResult } from "@/lib/leagues/draft/grades";
import {
  powerScoreTone,
  scalePowerScoresToBarometer,
  type PowerRankingTeamRow,
} from "@/lib/leagues/power-rankings/types";

type ClaimedTeam = LeagueStandingsMember & { teamId: string };

function claimedTeams(teams: LeagueStandingsMember[]): ClaimedTeam[] {
  return teams.filter(
    (team): team is ClaimedTeam => Boolean(team.teamId),
  );
}

function toRow(
  team: ClaimedTeam,
  rank: number,
  powerScore: number,
): PowerRankingTeamRow {
  return {
    rank,
    rankDelta: null,
    teamId: team.teamId,
    teamPublicId: team.teamPublicId ?? null,
    teamName: team.teamName?.trim() || "Team",
    ownerName: standingsOwnerName(team, "Manager"),
    ownerUserId: team.userId ?? null,
    logoUrl: team.logoUrl ?? null,
    powerScore,
    tone: powerScoreTone(powerScore),
  };
}

/** All claimed teams at 0 before any picks land. */
export function buildEmptyDraftPowerRankingRows(
  teams: LeagueStandingsMember[],
): PowerRankingTeamRow[] {
  return claimedTeams(teams).map((team, index) => toRow(team, index + 1, 0));
}

/**
 * Live Draft Rankings from draft-grade composite scores (projection strength +
 * ADP value), scaled so the league leader is always 100.
 */
export function buildDraftPowerRankingRows(input: {
  teams: LeagueStandingsMember[];
  grades: DraftGradeTeamResult[];
}): PowerRankingTeamRow[] {
  const claimed = claimedTeams(input.teams);
  if (claimed.length === 0) return [];

  const gradeByTeamId = new Map(
    input.grades.map((grade) => [grade.teamId, grade]),
  );
  const rawByTeamId = new Map<string, number>();
  for (const team of claimed) {
    rawByTeamId.set(team.teamId, gradeByTeamId.get(team.teamId)?.score ?? 0);
  }

  const scores = scalePowerScoresToBarometer(rawByTeamId);

  return [...claimed]
    .sort((a, b) => {
      const scoreDiff =
        (scores.get(b.teamId) ?? 0) - (scores.get(a.teamId) ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const rankA = gradeByTeamId.get(a.teamId)?.leagueRank ?? Number.MAX_SAFE_INTEGER;
      const rankB = gradeByTeamId.get(b.teamId)?.leagueRank ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      return a.teamId.localeCompare(b.teamId);
    })
    .map((team, index) =>
      toRow(team, index + 1, scores.get(team.teamId) ?? 0),
    );
}
