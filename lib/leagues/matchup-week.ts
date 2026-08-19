import { cache } from "react";

import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { calendarSeasonTypesForSchedule } from "@/lib/account/schedule-settings";
import { createProcessCache } from "@/lib/cache/process-cache";
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

export type FantasyMatchupWeekResolution = {
  week: number;
  weeks: FantasyWeekOption[];
  calendarWeeks: ScheduleWeek[];
  /** Fantasy week that is "now" for the league calendar. */
  currentWeek: number;
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

export function resolveCurrentFantasyWeekFromSources(options: {
  calendarWeeks: ScheduleWeek[];
  settings: ScheduleSettings;
  sleeperWeek: number | null;
  maxWeek: number;
  nflRegularSeasonEndWeek: number;
}): number {
  const {
    calendarWeeks,
    settings,
    sleeperWeek,
    maxWeek,
    nflRegularSeasonEndWeek,
  } = options;

  const calendarWeek = fantasyWeekFromCalendarWeeks(calendarWeeks, settings);
  if (calendarWeek != null) {
    return Math.min(Math.max(1, calendarWeek), maxWeek);
  }

  if (sleeperWeek != null) {
    return Math.min(Math.max(1, sleeperWeek), maxWeek);
  }

  const regularWeeks = calendarWeeks.filter(
    (entry) =>
      entry.seasonType === 2 &&
      entry.number >= 1 &&
      entry.number <= nflRegularSeasonEndWeek,
  );
  if (regularWeeks.length === 0) {
    return 1;
  }

  const espnDefault = getDefaultScheduleWeek(regularWeeks);
  const mapped = fantasyWeekToNfl(1, settings)
    ? espnDefault + (maxWeek - nflRegularSeasonEndWeek)
    : espnDefault;
  return Math.min(Math.max(1, mapped), maxWeek);
}

type SerializedScheduleWeek = {
  number: number;
  label: string;
  rangeLabel: string;
  seasonType: ScheduleWeek["seasonType"];
  startDate: string;
  endDate: string;
};

type FantasyWeekCalendarBase = {
  calendarWeeks: ScheduleWeek[];
  currentWeek: number;
  weeks: FantasyWeekOption[];
};

type SerializedFantasyWeekCalendarBase = {
  calendarWeeks: SerializedScheduleWeek[];
  currentWeek: number;
  weeks: FantasyWeekOption[];
};

function serializeScheduleWeeks(
  weeks: ScheduleWeek[],
): SerializedScheduleWeek[] {
  return weeks.map((week) => ({
    number: week.number,
    label: week.label,
    rangeLabel: week.rangeLabel,
    seasonType: week.seasonType,
    startDate: week.startDate.toISOString(),
    endDate: week.endDate.toISOString(),
  }));
}

function deserializeScheduleWeeks(
  weeks: SerializedScheduleWeek[],
): ScheduleWeek[] {
  return weeks.map((week) => ({
    number: week.number,
    label: week.label,
    rangeLabel: week.rangeLabel,
    seasonType: week.seasonType,
    startDate: new Date(week.startDate),
    endDate: new Date(week.endDate),
  }));
}

function fantasyWeekCalendarProcessKey(input: {
  seasonYear: number;
  nflRegularSeasonEndWeek: number;
  includePreseason: boolean;
  preseasonStartWeek: number;
}): string {
  return [
    input.seasonYear,
    input.nflRegularSeasonEndWeek,
    input.includePreseason ? 1 : 0,
    input.preseasonStartWeek,
  ].join(":");
}

const getCachedFantasyWeekCalendar = createProcessCache<
  SerializedFantasyWeekCalendarBase
>({
  ttlMs: 5 * 60 * 1000,
  maxEntries: 16,
});

async function loadFantasyWeekCalendarBase(input: {
  seasonYear: number;
  nflRegularSeasonEndWeek: number;
  settings: ScheduleSettings;
}): Promise<FantasyWeekCalendarBase> {
  const calendarSeasonTypes = calendarSeasonTypesForSchedule({
    includePreseason: input.settings.includePreseason ?? false,
    preseasonStartWeek: input.settings.preseasonStartWeek ?? 1,
  });
  const maxWeek = Math.max(
    1,
    fantasyRegularSeasonEndWeek(input.nflRegularSeasonEndWeek, input.settings),
  );

  const serialized = await getCachedFantasyWeekCalendar(
    fantasyWeekCalendarProcessKey({
      seasonYear: input.seasonYear,
      nflRegularSeasonEndWeek: input.nflRegularSeasonEndWeek,
      includePreseason: input.settings.includePreseason ?? false,
      preseasonStartWeek: input.settings.preseasonStartWeek ?? 1,
    }),
    async () => {
      let currentWeek = 1;
      let calendarWeeks: ScheduleWeek[] = [];
      try {
        const state = await getNflState();
        const sleeperWeek =
          Number(state.season) === input.seasonYear
            ? fantasyWeekFromNflState(state, input.settings)
            : null;

        const bootstrapNfl = fantasyWeekToNfl(sleeperWeek ?? 1, input.settings);
        const board = await getNflScoreboard({
          season: input.seasonYear,
          week: bootstrapNfl?.week ?? 1,
          seasonType: espnSeasonTypeForNfl(bootstrapNfl?.seasonType ?? "regular"),
          calendarSeasonTypes,
        });
        calendarWeeks = board.weeks;

        currentWeek = resolveCurrentFantasyWeekFromSources({
          calendarWeeks,
          settings: input.settings,
          sleeperWeek,
          maxWeek,
          nflRegularSeasonEndWeek: input.nflRegularSeasonEndWeek,
        });
      } catch {
        currentWeek = 1;
      }

      const weeks: FantasyWeekOption[] = [];
      for (let number = 1; number <= maxWeek; number++) {
        const nfl = fantasyWeekToNfl(number, input.settings);
        weeks.push({
          number,
          label: `Week ${number}`,
          rangeLabel: rangeLabelForNflWeek(calendarWeeks, nfl),
        });
      }

      return {
        calendarWeeks: serializeScheduleWeeks(calendarWeeks),
        currentWeek,
        weeks,
      };
    },
  );

  return {
    calendarWeeks: deserializeScheduleWeeks(serialized.calendarWeeks),
    currentWeek: serialized.currentWeek,
    weeks: serialized.weeks,
  };
}

function pickFantasyMatchupWeek(
  base: FantasyWeekCalendarBase,
  requestedWeek?: number | null,
): number {
  const requested = requestedWeek;
  return requested != null &&
    base.weeks.some((entry) => entry.number === requested)
    ? requested
    : base.currentWeek;
}

const loadFantasyWeekCalendarCached = cache(
  async (
    seasonYear: number,
    nflRegularSeasonEndWeek: number,
    includePreseason: boolean,
    preseasonStartWeek: number,
  ): Promise<FantasyWeekCalendarBase> =>
    loadFantasyWeekCalendarBase({
      seasonYear,
      nflRegularSeasonEndWeek,
      settings: {
        playEachOtherTimes: 1,
        includePreseason,
        preseasonStartWeek,
      },
    }),
);

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
}): Promise<FantasyMatchupWeekResolution> {
  const settings = resolveScheduleSettings(options.schedule);
  const base = await loadFantasyWeekCalendarCached(
    options.seasonYear,
    options.nflRegularSeasonEndWeek,
    settings.includePreseason ?? false,
    settings.preseasonStartWeek ?? 1,
  );
  const week = pickFantasyMatchupWeek(base, options.requestedWeek);
  return { ...base, week };
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
