import type { LeagueStandingsRow } from "@/lib/leagues/standings";

export type LeaguePlayoffStandingsRow = LeagueStandingsRow & {
  seed: number;
};

/** Seed number for the last playoff berth, or null when playoffs are off. */
export function resolvePlayoffCutoffSeed(input: {
  enabled: boolean;
  playoffTeamCount: number;
  teamCount: number;
}): number | null {
  if (!input.enabled) {
    return null;
  }
  const cutoff = Math.min(
    Math.max(0, input.playoffTeamCount),
    Math.max(0, input.teamCount),
  );
  return cutoff > 0 ? cutoff : null;
}

/** Attach 1-based seeds from current standings order. */
export function buildPlayoffStandingsRows(
  rows: LeagueStandingsRow[],
): LeaguePlayoffStandingsRow[] {
  return rows.map((row, index) => ({
    ...row,
    seed: index + 1,
  }));
}
