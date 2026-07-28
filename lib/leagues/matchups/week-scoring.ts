import type { GameProgress, WinProbPlayer } from "@/lib/leagues/win-probability";
import { normalizeNflTeamAbbrev } from "@/lib/nfl/matchups";

/**
 * Check if all starters in a lineup have finished games.
 * Empty lineup → false.
 * Missing progress → false (fail-closed; treat scoreboard outage as not final).
 */
export function allStartersFinal(
  lineup: Array<Pick<WinProbPlayer, "nflTeam">>,
  progressByNflTeam: Map<string, GameProgress>,
) {
  if (lineup.length === 0) return false;
  return lineup.every((player) => {
    const abbrev = normalizeNflTeamAbbrev(player.nflTeam);
    if (!abbrev) return true;
    const progress = progressByNflTeam.get(abbrev);
    return progress != null && progress.status === "post";
  });
}

/**
 * Whether a Matchup week result is ready to lock as final.
 * Past fantasy weeks are final once both sides have actuals; the current week
 * also requires every starter's NFL game to be post.
 */
export function isMatchupResultFinal(input: {
  week: number;
  currentWeek: number;
  awayActualPts: number | null;
  homeActualPts: number | null;
  starters: Array<Pick<WinProbPlayer, "nflTeam">>;
  progressByNflTeam: Map<string, GameProgress>;
}): boolean {
  if (input.awayActualPts == null || input.homeActualPts == null) {
    return false;
  }
  if (input.week < input.currentWeek) {
    return true;
  }
  return allStartersFinal(input.starters, input.progressByNflTeam);
}
