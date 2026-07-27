import type { GameProgress, WinProbPlayer } from "@/lib/leagues/win-probability";
import { normalizeNflTeamAbbrev } from "@/lib/nfl/matchups";

/**
 * Check if all starters in a lineup have finished games.
 * Empty lineup → false.
 * Missing progress → false (fail-closed; treat scoreboard outage as not final).
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
    return progress != null && progress.status === "post";
  });
}
