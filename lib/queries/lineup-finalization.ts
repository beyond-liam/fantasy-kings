import type { GameProgress, WinProbPlayer } from "@/lib/leagues/win-probability";
import { normalizeNflTeamAbbrev } from "@/lib/nfl/matchups";

/**
 * Check if all starters in a lineup have finished games.
 * Empty lineup → false.
 * Missing progress → true (treats as final; current behavior).
 */
export function allStartersFinal(
  lineup: WinProbPlayer[],
  progressByNflTeam: Map<string, GameProgress>,
) {
  if (lineup.length === 0) return false;
  return lineup.every((player) => {
    const abbrev = normalizeNflTeamAbbrev(player.nflTeam);
    if (!abbrev) return true;
    const progress = progressByNflTeam.get(abbrev);
    return progress == null || progress.status === "post";
  });
}
