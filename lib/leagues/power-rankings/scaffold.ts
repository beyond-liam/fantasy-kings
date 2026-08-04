import type { LeagueStandingsMember } from "@/lib/leagues/standings";
import {
  powerScoreTone,
  scalePowerScoresToBarometer,
  type PowerRankingMode,
  type PowerRankingTeamRow,
} from "@/lib/leagues/power-rankings/types";

/**
 * Temporary scaffold rows so the Power Rankings UI can ship before the
 * projection engine. Placeholder strengths are evenly spaced; scores scale
 * so the leader is always 100.
 *
 * Mode is accepted for API stability — scoring is identical until projections
 * land.
 */
export function buildScaffoldPowerRankingRows(
  teams: LeagueStandingsMember[],
  _mode: PowerRankingMode = "draft",
): PowerRankingTeamRow[] {
  void _mode;
  const claimed = teams.filter(
    (team): team is LeagueStandingsMember & { teamId: string } =>
      Boolean(team.teamId),
  );
  if (claimed.length === 0) return [];

  const n = claimed.length;
  const rawByTeamId = new Map<string, number>();
  for (let index = 0; index < n; index++) {
    const team = claimed[index]!;
    // Descending placeholder strength: leader = n, last = 1.
    rawByTeamId.set(team.teamId, n - index);
  }

  const scores = scalePowerScoresToBarometer(rawByTeamId);

  return claimed.map((team, index) => {
    const powerScore = scores.get(team.teamId) ?? 0;
    return {
      rank: index + 1,
      rankDelta: null,
      teamId: team.teamId,
      teamPublicId: team.teamPublicId ?? null,
      teamName: team.teamName?.trim() || "Team",
      ownerName: team.displayName?.trim() || "Manager",
      ownerUserId: team.userId ?? null,
      logoUrl: team.logoUrl ?? null,
      powerScore,
      tone: powerScoreTone(powerScore),
    };
  });
}
