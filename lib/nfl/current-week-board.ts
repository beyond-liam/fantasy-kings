import "server-only";

import { cache } from "react";

import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { calendarSeasonTypesForSchedule } from "@/lib/account/schedule-settings";
import { getNflScoreboard, type ScheduleGame } from "@/lib/espn/scoreboard";
import {
  espnSeasonTypeForNfl,
  fantasyWeekFromNflState,
  fantasyWeekToNfl,
} from "@/lib/leagues/schedule/fantasy-week-map";
import { resolveScheduleSettings } from "@/lib/leagues/schedule/settings";
import { getStartedNflTeamAbbreviations } from "@/lib/leagues/waivers/game-lock";
import {
  isGameWeekFinalized,
  isNflSlateComplete,
  lastKickoffAt,
} from "@/lib/nfl/game-week";
import { getNflState } from "@/lib/sleeper/api";

export type GameWeekCloseState = {
  fantasyWeek: number | null;
  nflWeek: number;
  nflSeason: number;
  seasonType: "pre" | "regular" | "post";
  games: ScheduleGame[];
  startedNflTeams: Set<string>;
  lastKickoff: Date | null;
  slateComplete: boolean;
  weekFinalized: boolean;
};

const loadCurrentNflWeekBoardCached = cache(
  async (includePreseason: boolean, preseasonStartWeek: number) => {
    const schedule = resolveScheduleSettings({
      playEachOtherTimes: 1,
      includePreseason,
      preseasonStartWeek,
    });
    const nflState = await getNflState();
    const seasonYear = Number(nflState.season) || new Date().getUTCFullYear();
    const fantasyWeek = fantasyWeekFromNflState(nflState, schedule);
    const nflPoint = fantasyWeekToNfl(fantasyWeek ?? 1, schedule) ?? {
      seasonType: "regular" as const,
      week: Math.max(1, Number(nflState.display_week ?? nflState.week) || 1),
    };

    const board = await getNflScoreboard({
      season: seasonYear,
      week: nflPoint.week,
      seasonType: espnSeasonTypeForNfl(nflPoint.seasonType),
      calendarSeasonTypes: calendarSeasonTypesForSchedule({
        includePreseason: schedule.includePreseason ?? false,
        preseasonStartWeek: schedule.preseasonStartWeek ?? 1,
      }),
    });

    return {
      nflState,
      fantasyWeek,
      nflPoint,
      seasonYear,
      board,
    };
  },
);

/** Current fantasy week's NFL scoreboard (pre vs regular). */
export async function loadCurrentNflWeekBoard(
  schedule?: ScheduleSettings | null,
) {
  const settings = resolveScheduleSettings(schedule);
  return loadCurrentNflWeekBoardCached(
    settings.includePreseason ?? false,
    settings.preseasonStartWeek ?? 1,
  );
}

const emptyCloseState = (): GameWeekCloseState => ({
  fantasyWeek: null,
  nflWeek: 1,
  nflSeason: new Date().getUTCFullYear(),
  seasonType: "regular",
  games: [],
  startedNflTeams: new Set(),
  lastKickoff: null,
  slateComplete: false,
  weekFinalized: false,
});

const getGameWeekCloseStateCached = cache(
  async (
    includePreseason: boolean,
    preseasonStartWeek: number,
  ): Promise<GameWeekCloseState> => {
    const now = new Date();
    try {
      const loaded = await loadCurrentNflWeekBoardCached(
        includePreseason,
        preseasonStartWeek,
      );
      const games = loaded.board.games;
      return {
        fantasyWeek: loaded.fantasyWeek,
        nflWeek: loaded.nflPoint.week,
        nflSeason: loaded.seasonYear,
        seasonType: loaded.nflPoint.seasonType,
        games,
        startedNflTeams: getStartedNflTeamAbbreviations(games, now),
        lastKickoff: lastKickoffAt(games),
        slateComplete: isNflSlateComplete(games),
        weekFinalized: isGameWeekFinalized(games, now),
      };
    } catch {
      return emptyCloseState();
    }
  },
);

export async function getGameWeekCloseState(
  schedule?: ScheduleSettings | null,
): Promise<GameWeekCloseState> {
  const settings = resolveScheduleSettings(schedule);
  return getGameWeekCloseStateCached(
    settings.includePreseason ?? false,
    settings.preseasonStartWeek ?? 1,
  );
}
