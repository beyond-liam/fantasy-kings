import "server-only";

import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { calendarSeasonTypesForSchedule } from "@/lib/account/schedule-settings";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import {
  espnSeasonTypeForNfl,
  fantasyWeekFromNflState,
  fantasyWeekToNfl,
} from "@/lib/leagues/schedule/fantasy-week-map";
import { resolveScheduleSettings } from "@/lib/leagues/schedule/settings";
import { getStartedNflTeamAbbreviations } from "@/lib/leagues/waivers/game-lock";
import { getGameWeekCloseState } from "@/lib/nfl/current-week-board";
import { isGameWeekFinalized } from "@/lib/nfl/game-week";
import { getNflState } from "@/lib/sleeper/api";

export type FantasyWeekLineupLockState = {
  startedNflTeams: Set<string> | null;
  slateFinalized: boolean;
};

/**
 * Game-start locks and slate closure for a specific fantasy week.
 * Returns null started teams when the scoreboard is unavailable (fail open).
 */
export async function loadFantasyWeekLineupLockState(input: {
  schedule?: ScheduleSettings | null;
  fantasyWeek: number;
  seasonYear?: number;
}): Promise<FantasyWeekLineupLockState> {
  try {
    const settings = resolveScheduleSettings(input.schedule);
    const nflState = await getNflState();
    const seasonYear =
      input.seasonYear ??
      (Number(nflState.season) || new Date().getUTCFullYear());
    const nflPoint = fantasyWeekToNfl(input.fantasyWeek, settings);
    if (!nflPoint) {
      return { startedNflTeams: new Set(), slateFinalized: false };
    }

    const board = await getNflScoreboard({
      season: seasonYear,
      week: nflPoint.week,
      seasonType: espnSeasonTypeForNfl(nflPoint.seasonType),
      calendarSeasonTypes: calendarSeasonTypesForSchedule({
        includePreseason: settings.includePreseason ?? false,
        preseasonStartWeek: settings.preseasonStartWeek ?? 1,
      }),
    });

    const now = new Date();
    return {
      startedNflTeams: getStartedNflTeamAbbreviations(board.games, now),
      slateFinalized: isGameWeekFinalized(board.games, now),
    };
  } catch {
    return { startedNflTeams: null, slateFinalized: false };
  }
}

/**
 * NFL teams whose games have started for the live fantasy week.
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

/** Resolve the live fantasy week number for lock lookups. */
export async function resolveLiveFantasyWeekForLineupLock(
  schedule?: ScheduleSettings | null,
): Promise<number> {
  const settings = resolveScheduleSettings(schedule);
  const nflState = await getNflState();
  return fantasyWeekFromNflState(nflState, settings) ?? 1;
}
