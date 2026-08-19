import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { calendarSeasonTypesForSchedule } from "@/lib/account/schedule-settings";
import {
  getNflScoreboard,
  type EspnSeasonType,
  type ScheduleWeek,
} from "@/lib/espn/scoreboard";
import {
  espnSeasonTypeForNfl,
  fantasyRegularSeasonEndWeek,
  fantasyWeekFromNflState,
  fantasyWeekToNfl,
  MAX_FANTASY_WEEK,
  nflToFantasyWeek,
  type NflCalendarPoint,
} from "@/lib/leagues/schedule/fantasy-week-map";
import { resolveScheduleSettings } from "@/lib/leagues/schedule/settings";
import {
  getDefaultScheduleWeek,
  getDefaultScheduleWeekEntry,
} from "@/lib/nfl/schedule-week";
import { getFantasyWeekStartUtc } from "@/lib/leagues/waivers/calendar";
import { getNflState } from "@/lib/sleeper/api";

function nflSeasonTypeFromEspn(
  seasonType: EspnSeasonType,
): NflCalendarPoint["seasonType"] {
  if (seasonType === 1) return "pre";
  if (seasonType === 3) return "post";
  return "regular";
}

/**
 * Current fantasy week from ESPN Wed→Tue schedule windows (same calendar
 * waivers use). Sleeper's NFL state often lags a week after slate finalize.
 */
export function fantasyWeekFromCalendarWeeks(
  calendarWeeks: ScheduleWeek[],
  settings: ScheduleSettings | null | undefined,
  now: Date = new Date(),
): number | null {
  // Match waivers’ “fantasy week rolls at Wed 00:01 UTC” boundary.
  const weekStart = getFantasyWeekStartUtc(now);

  const eligible = calendarWeeks.filter((entry) => {
    const seasonType = nflSeasonTypeFromEspn(entry.seasonType);
    return nflToFantasyWeek({ seasonType, week: entry.number }, settings) != null;
  });

  const anchored = eligible.find(
    (entry) => weekStart >= entry.startDate && weekStart < entry.endDate,
  );

  if (anchored) {
    const seasonType = nflSeasonTypeFromEspn(anchored.seasonType);
    return (
      nflToFantasyWeek({ seasonType, week: anchored.number }, settings) ?? null
    );
  }

  // Fallback: if calendar windows don't cover the boundary exactly, choose the
  // default ESPN window based on `now`.
  const current = getDefaultScheduleWeekEntry(eligible, now);
  if (!current) return null;

  return nflToFantasyWeek(
    {
      seasonType: nflSeasonTypeFromEspn(current.seasonType),
      week: current.number,
    },
    settings,
  );
}

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
    const sleeperWeek =
      Number(state.season) === options.seasonYear
        ? fantasyWeekFromNflState(state, settings)
        : null;

    const bootstrapNfl = fantasyWeekToNfl(sleeperWeek ?? 1, settings);
    const board = await getNflScoreboard({
      season: options.seasonYear,
      week: bootstrapNfl?.week ?? 1,
      seasonType: espnSeasonTypeForNfl(bootstrapNfl?.seasonType ?? "regular"),
      calendarSeasonTypes,
    });
    calendarWeeks = board.weeks;

    const calendarWeek = fantasyWeekFromCalendarWeeks(calendarWeeks, settings);
    if (calendarWeek != null) {
      defaultWeek = Math.min(Math.max(1, calendarWeek), maxWeek);
    } else if (sleeperWeek != null) {
      defaultWeek = Math.min(Math.max(1, sleeperWeek), maxWeek);
    } else {
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
