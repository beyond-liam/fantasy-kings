import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { getNflScoreboard, type ScheduleWeek } from "@/lib/espn/scoreboard";
import {
  espnPreseasonWeekToUser,
  espnSeasonTypeForNfl,
  fantasyRegularSeasonEndWeek,
  fantasyWeekFromNflState,
  fantasyWeekToNfl,
  MAX_FANTASY_WEEK,
} from "@/lib/leagues/schedule/fantasy-week-map";
import { resolveScheduleSettings } from "@/lib/leagues/schedule/settings";
import { getDefaultScheduleWeek } from "@/lib/nfl/schedule-week";
import { getNflState } from "@/lib/sleeper/api";

export type FantasyWeekOption = {
  number: number;
  label: string;
  rangeLabel: string;
};

/**
 * Resolve the fantasy schedule week. Fantasy week numbers may include leading
 * NFL preseason weeks when the league extends into preseason; championship
 * still lands on the configured NFL week.
 */
export async function resolveFantasyMatchupWeek(options: {
  seasonYear: number;
  /** Inclusive NFL regular-season end week (stored on league_seasons). */
  nflRegularSeasonEndWeek: number;
  schedule?: ScheduleSettings | null;
  requestedWeek?: number | null;
}): Promise<{
  week: number;
  weeks: FantasyWeekOption[];
  calendarWeeks: ScheduleWeek[];
  /** Fantasy week that is “now” for the league calendar. */
  currentWeek: number;
}> {
  const settings = resolveScheduleSettings(options.schedule);
  const maxWeek = Math.max(
    1,
    fantasyRegularSeasonEndWeek(options.nflRegularSeasonEndWeek, settings),
  );

  const weeks: FantasyWeekOption[] = [];
  for (let number = 1; number <= maxWeek; number++) {
    const nfl = fantasyWeekToNfl(number, settings);
    weeks.push({
      number,
      label: `Week ${number}`,
      rangeLabel:
        nfl?.seasonType === "pre"
          ? `NFL Preseason ${espnPreseasonWeekToUser(nfl.week) ?? nfl.week}`
          : nfl
            ? `NFL Week ${nfl.week}`
            : "",
    });
  }

  let defaultWeek = 1;
  try {
    const state = await getNflState();
    if (Number(state.season) === options.seasonYear) {
      const mapped = fantasyWeekFromNflState(state, settings);
      if (mapped != null) {
        defaultWeek = Math.min(Math.max(1, mapped), maxWeek);
      }
    } else {
      const bootstrap = await getNflScoreboard({
        season: options.seasonYear,
        week: 1,
        seasonType: 2,
      });
      const regularWeeks = bootstrap.weeks.filter(
        (entry) =>
          entry.seasonType === 2 &&
          entry.number >= 1 &&
          entry.number <= options.nflRegularSeasonEndWeek,
      );
      if (regularWeeks.length > 0) {
        const espnDefault = getDefaultScheduleWeek(regularWeeks);
        const mapped = fantasyWeekToNfl(1, settings)
          ? espnDefault + (maxWeek - options.nflRegularSeasonEndWeek)
          : espnDefault;
        defaultWeek = Math.min(Math.max(1, mapped), maxWeek);
      }
    }
  } catch {
    defaultWeek = 1;
  }

  const requested = options.requestedWeek;
  const week =
    requested != null && weeks.some((entry) => entry.number === requested)
      ? requested
      : defaultWeek;

  // Optional ESPN windows for the selected week (range labels / refresh).
  let calendarWeeks: ScheduleWeek[] = [];
  const selectedNfl = fantasyWeekToNfl(week, settings);
  if (selectedNfl) {
    try {
      const board = await getNflScoreboard({
        season: options.seasonYear,
        week: selectedNfl.week,
        seasonType: espnSeasonTypeForNfl(selectedNfl.seasonType),
      });
      calendarWeeks = board.weeks;
    } catch {
      calendarWeeks = [];
    }
  }

  return { week, weeks, calendarWeeks, currentWeek: defaultWeek };
}

export function parseWeekQueryParam(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const week = Number(raw);
  if (!Number.isFinite(week) || week < 1 || week > MAX_FANTASY_WEEK) {
    return null;
  }
  return week;
}

export function parseYearQueryParam(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const year = Number(raw);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return null;
  }
  return year;
}
