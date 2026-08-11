import {
  standingsOwnerName,
  type LeagueStandingsMember,
} from "@/lib/leagues/standings";
import {
  powerScoreTone,
  scalePowerScoresToBarometer,
  type PowerRankingTeamRow,
} from "@/lib/leagues/power-rankings/types";

type ClaimedTeam = LeagueStandingsMember & { teamId: string };

export function claimedStandingsTeams(
  teams: LeagueStandingsMember[],
): ClaimedTeam[] {
  return teams.filter(
    (team): team is ClaimedTeam => Boolean(team.teamId),
  );
}

/**
 * Rank teams by absolute strength, scaled so the league leader is 100.
 * Close raw strengths stay close on the 0–100 bar (last ≠ 0 unless raw is 0).
 */
export function buildPowerRankingRowsFromStrength(input: {
  teams: LeagueStandingsMember[];
  strengthByTeamId: Map<string, number>;
}): PowerRankingTeamRow[] {
  const claimed = claimedStandingsTeams(input.teams);
  if (claimed.length === 0) return [];

  const rawByTeamId = new Map<string, number>();
  for (const team of claimed) {
    const raw = input.strengthByTeamId.get(team.teamId) ?? 0;
    rawByTeamId.set(team.teamId, Number.isFinite(raw) ? raw : 0);
  }

  const scores = scalePowerScoresToBarometer(rawByTeamId);

  return [...claimed]
    .sort((a, b) => {
      const scoreDiff =
        (scores.get(b.teamId) ?? 0) - (scores.get(a.teamId) ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const rawDiff =
        (rawByTeamId.get(b.teamId) ?? 0) - (rawByTeamId.get(a.teamId) ?? 0);
      if (rawDiff !== 0) return rawDiff;
      return a.teamId.localeCompare(b.teamId);
    })
    .map((team, index) => {
      const powerScore = scores.get(team.teamId) ?? 0;
      return {
        rank: index + 1,
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
    });
}

/** All claimed teams at 0 before strengths are known. */
export function buildEmptyPowerRankingRows(
  teams: LeagueStandingsMember[],
): PowerRankingTeamRow[] {
  return claimedStandingsTeams(teams).map((team, index) => ({
    rank: index + 1,
    rankDelta: null,
    teamId: team.teamId,
    teamPublicId: team.teamPublicId ?? null,
    teamName: team.teamName?.trim() || "Team",
    ownerName: standingsOwnerName(team, "Manager"),
    ownerUserId: team.userId ?? null,
    logoUrl: team.logoUrl ?? null,
    powerScore: 0,
    tone: powerScoreTone(0),
  }));
}
