import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { calendarSeasonTypesForSchedule } from "@/lib/account/schedule-settings";
import { getNflScoreboard, type ScheduleWeek } from "@/lib/espn/scoreboard";
import {
  espnSeasonTypeForNfl,
  fantasyRegularSeasonEndWeek,
  fantasyWeekFromNflState,
  fantasyWeekToNfl,
  MAX_FANTASY_WEEK,
  type NflCalendarPoint,
} from "@/lib/leagues/schedule/fantasy-week-map";
import { resolveScheduleSettings } from "@/lib/leagues/schedule/settings";
import { getDefaultScheduleWeek } from "@/lib/nfl/schedule-week";
import { getNflState } from "@/lib/sleeper/api";

export type FantasyWeekOption = {
  number: number;
  label: string;
  rangeLabel: string;
};

export function rangeLabelForNflWeek(
  calendarWeeks: ScheduleWeek[],
  nfl: NflCalendarPoint | null,
): string {
  if (!nfl) return "";
  const seasonType = espnSeasonTypeForNfl(nfl.seasonType);
  return (
    calendarWeeks.find(
      (entry) =>
        entry.number === nfl.week && entry.seasonType === seasonType,
    )?.rangeLabel ?? ""
  );
}

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
  const calendarSeasonTypes = calendarSeasonTypesForSchedule({
    includePreseason: settings.includePreseason ?? false,
    preseasonStartWeek: settings.preseasonStartWeek ?? 1,
  });

  let defaultWeek = 1;
  let calendarWeeks: ScheduleWeek[] = [];
  try {
    const state = await getNflState();
    if (Number(state.season) === options.seasonYear) {
      const mapped = fantasyWeekFromNflState(state, settings);
      if (mapped != null) {
        defaultWeek = Math.min(Math.max(1, mapped), maxWeek);
      }
    }

    const bootstrapNfl = fantasyWeekToNfl(defaultWeek, settings);
    const board = await getNflScoreboard({
      season: options.seasonYear,
      week: bootstrapNfl?.week ?? 1,
      seasonType: espnSeasonTypeForNfl(bootstrapNfl?.seasonType ?? "regular"),
      calendarSeasonTypes,
    });
    calendarWeeks = board.weeks;

    if (Number(state.season) !== options.seasonYear) {
      const regularWeeks = calendarWeeks.filter(
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

  const weeks: FantasyWeekOption[] = [];
  for (let number = 1; number <= maxWeek; number++) {
    const nfl = fantasyWeekToNfl(number, settings);
    weeks.push({
      number,
      label: `Week ${number}`,
      rangeLabel: rangeLabelForNflWeek(calendarWeeks, nfl),
    });
  }

  const requested = options.requestedWeek;
  const week =
    requested != null && weeks.some((entry) => entry.number === requested)
      ? requested
      : defaultWeek;

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
