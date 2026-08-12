import "server-only";

import { getNflScoreboard } from "@/lib/espn/scoreboard";
import { getNflState } from "@/lib/sleeper/api";

export async function loadNflKickoffsThisWeek(): Promise<Map<string, Date>> {
  try {
    const nfl = await getNflState();
    const board = await getNflScoreboard({
      season: Number(nfl.season) || new Date().getUTCFullYear(),
      week: Math.max(1, Number(nfl.week) || 1),
    });
    const map = new Map<string, Date>();
    for (const game of board.games) {
      const kickoff = new Date(game.kickoff);
      if (!Number.isFinite(kickoff.getTime())) continue;
      const home = game.home.abbreviation.trim().toUpperCase();
      const away = game.away.abbreviation.trim().toUpperCase();
      if (home) map.set(home, kickoff);
      if (away) map.set(away, kickoff);
    }
    return map;
  } catch {
    return new Map();
  }
}

export function kickoffDateForNflTeam(
  nflTeam: string | null | undefined,
  kickoffs: Map<string, Date>,
): Date | null {
  if (!nflTeam?.trim()) return null;
  const abbr = nflTeam.trim().toUpperCase();
  return (
    kickoffs.get(abbr) ??
    (abbr === "WAS" ? kickoffs.get("WSH") : null) ??
    (abbr === "WSH" ? kickoffs.get("WAS") : null) ??
    null
  );
}
