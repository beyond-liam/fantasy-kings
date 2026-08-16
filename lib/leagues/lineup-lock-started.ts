import "server-only";

import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { getGameWeekCloseState } from "@/lib/nfl/current-week-board";

/**
 * NFL teams whose games have started this fantasy week.
 * Returns null when the scoreboard is unavailable (callers fail open).
 */
export async function loadStartedNflTeamsForLineupLock(
  schedule?: ScheduleSettings | null,
): Promise<Set<string> | null> {
  try {
    const close = await getGameWeekCloseState(schedule);
    return close.startedNflTeams;
  } catch {
    return null;
  }
}
