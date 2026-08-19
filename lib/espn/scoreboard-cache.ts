import "server-only";

import { createProcessCache } from "@/lib/cache/process-cache";
import {
  getNflScoreboard,
  type EspnSeasonType,
  type NflScoreboard,
  type ScheduleWeek,
} from "@/lib/espn/scoreboard";

type SerializedScheduleWeek = Omit<ScheduleWeek, "startDate" | "endDate"> & {
  startDate: string;
  endDate: string;
};

type SerializedNflScoreboard = Omit<NflScoreboard, "weeks"> & {
  weeks: SerializedScheduleWeek[];
};

const getCachedScoreboardPayload = createProcessCache<SerializedNflScoreboard>({
  ttlMs: 60 * 1000,
  maxEntries: 48,
});

function scoreboardCacheKey(input: {
  season: number;
  week: number;
  seasonType: EspnSeasonType;
  calendarSeasonTypes: EspnSeasonType[];
}): string {
  return [
    input.season,
    input.week,
    input.seasonType,
    input.calendarSeasonTypes.join(","),
  ].join("|");
}

function serializeScoreboard(board: NflScoreboard): SerializedNflScoreboard {
  return {
    ...board,
    weeks: board.weeks.map((week) => ({
      ...week,
      startDate: week.startDate.toISOString(),
      endDate: week.endDate.toISOString(),
    })),
  };
}

function deserializeScoreboard(payload: SerializedNflScoreboard): NflScoreboard {
  return {
    ...payload,
    weeks: payload.weeks.map((week) => ({
      ...week,
      startDate: new Date(week.startDate),
      endDate: new Date(week.endDate),
    })),
  };
}

/** Process-cached ESPN scoreboard for roster/matchup opponent lookups. */
export async function getCachedNflScoreboard(options: {
  season: number;
  week: number;
  seasonType?: EspnSeasonType;
  calendarSeasonTypes?: EspnSeasonType[];
}): Promise<NflScoreboard> {
  const seasonType = options.seasonType ?? 2;
  const calendarSeasonTypes = options.calendarSeasonTypes ?? [2];
  const key = scoreboardCacheKey({
    season: options.season,
    week: options.week,
    seasonType,
    calendarSeasonTypes,
  });

  const payload = await getCachedScoreboardPayload(key, async () =>
    serializeScoreboard(
      await getNflScoreboard({
        season: options.season,
        week: options.week,
        seasonType,
        calendarSeasonTypes,
      }),
    ),
  );

  return deserializeScoreboard(payload);
}
