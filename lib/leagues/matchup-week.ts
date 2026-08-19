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
import { getDefaultScheduleWeek } from "@/lib/nfl/schedule-week";
import { getFantasyWeekStartUtc } from "@/lib/leagues/waivers/calendar";
import { getNflState } from "@/lib/sleeper/api";

function nflSeasonTypeFromEspn(
  seasonType: EspnSeasonType,
): NflCalendarPoint["seasonType"] {
  if (seasonType === 1) return "pre";
  if (seasonType === 3) return "post";
  return "regular";
}

function espnEntryToFantasyWeek(
  entry: ScheduleWeek,
  settings: ScheduleSettings | null | undefined,
): number | null {
  return nflToFantasyWeek(
    { seasonType: nflSeasonTypeFromEspn(entry.seasonType), week: entry.number },
    settings,
  );
}

/**
 * Current fantasy week derived from ESPN calendar windows + the Wed 00:01 UTC
 * fantasy-week boundary (same clock waivers use).
 *
 * ESPN windows run roughly Thu→Wed. Fantasy weeks roll on Wednesday 00:01 UTC.
 * After that boundary we show the *next* ESPN week's matchups, even though
 * ESPN still considers the previous window active.
 */
export function fantasyWeekFromCalendarWeeks(
  calendarWeeks: ScheduleWeek[],
  settings: ScheduleSettings | null | undefined,
  now: Date = new Date(),
): number | null {
  const eligible = calendarWeeks
    .filter((entry) => espnEntryToFantasyWeek(entry, settings) != null)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  if (eligible.length === 0) return null;

  // The Wednesday 00:01 UTC boundary that started the current fantasy week.
  const wedBoundary = getFantasyWeekStartUtc(now);

  // Find the ESPN window that contains `now`.
  let currentIdx = -1;
  for (let i = eligible.length - 1; i >= 0; i--) {
    if (now >= eligible[i].startDate) {
      currentIdx = i;
      break;
    }
  }
  if (currentIdx === -1) {
    return espnEntryToFantasyWeek(eligible[0], settings);
  }

  const currentEntry = eligible[currentIdx];

  // If the Wed 00:01 boundary for THIS week is strictly after the ESPN window
  // start, then we've rolled past this NFL week into the next fantasy week.
  // Example: ESPN Pre Wk1 starts Thu Aug 13, Wed boundary is Aug 19 00:01 —
  // that's past the start, so we should show the next week's matchups.
  if (wedBoundary > currentEntry.startDate) {
    const next = eligible[currentIdx + 1];
    if (next) {
      return espnEntryToFantasyWeek(next, settings);
    }
  }

  return espnEntryToFantasyWeek(currentEntry, settings);
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
  /** Fantasy week that is "now" for the league calendar. */
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
