import "server-only";

import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { getGameWeekCloseState } from "@/lib/nfl/current-week-board";

export async function loadNflKickoffsThisWeek(
  schedule?: ScheduleSettings | null,
): Promise<Map<string, Date>> {
  try {
    const close = await getGameWeekCloseState(schedule);
    const map = new Map<string, Date>();
    for (const game of close.games) {
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
