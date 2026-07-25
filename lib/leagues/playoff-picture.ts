import type { LeagueStandingsRow } from "@/lib/leagues/standings";

export type PlayoffPictureStatus = "clinched" | "eliminated" | "bubble";

export type RemainingGameCount = {
  teamId: string;
  remainingGames: number;
};

/**
 * Deterministic playoff picture from win bounds (ignores H2H conflicts).
 * - Eliminated: at least `playoffSpots` teams have minWins > our maxWins
 * - Clinched: at least `nTeams - playoffSpots` teams have maxWins < our minWins
 * - Bubble: otherwise (when the season has started)
 */
export function resolvePlayoffPictureStatus(input: {
  teamId: string;
  rows: Array<Pick<LeagueStandingsRow, "teamId" | "wins" | "claimed">>;
  remainingGamesByTeamId: Map<string, number>;
  playoffSpots: number;
}): PlayoffPictureStatus | null {
  if (input.playoffSpots <= 0) return null;

  const claimed = input.rows.filter(
    (row): row is typeof row & { teamId: string } =>
      Boolean(row.claimed && row.teamId),
  );
  if (claimed.length === 0) return null;

  const bounds = claimed.map((row) => {
    const remaining = input.remainingGamesByTeamId.get(row.teamId) ?? 0;
    return {
      teamId: row.teamId,
      minWins: row.wins,
      maxWins: row.wins + remaining,
    };
  });

  const self = bounds.find((row) => row.teamId === input.teamId);
  if (!self) return null;

  const lockedAbove = bounds.filter(
    (row) => row.teamId !== self.teamId && row.minWins > self.maxWins,
  ).length;
  if (lockedAbove >= input.playoffSpots) {
    return "eliminated";
  }

  const lockedBelow = bounds.filter(
    (row) => row.teamId !== self.teamId && row.maxWins < self.minWins,
  ).length;
  if (lockedBelow >= claimed.length - input.playoffSpots) {
    return "clinched";
  }

  return "bubble";
}

export function resolvePlayoffPictureByTeam(input: {
  rows: Array<Pick<LeagueStandingsRow, "teamId" | "wins" | "claimed">>;
  remainingGamesByTeamId: Map<string, number>;
  playoffSpots: number;
}): Map<string, PlayoffPictureStatus> {
  const result = new Map<string, PlayoffPictureStatus>();
  for (const row of input.rows) {
    if (!row.teamId || !row.claimed) continue;
    const status = resolvePlayoffPictureStatus({
      teamId: row.teamId,
      rows: input.rows,
      remainingGamesByTeamId: input.remainingGamesByTeamId,
      playoffSpots: input.playoffSpots,
    });
    if (status) result.set(row.teamId, status);
  }
  return result;
}
