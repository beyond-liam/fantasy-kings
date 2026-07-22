import { getNflScoreboard, type ScheduleWeek } from "@/lib/espn/scoreboard";
import { getDefaultScheduleWeek } from "@/lib/nfl/schedule-week";

export type FantasyWeekOption = {
  number: number;
  label: string;
  rangeLabel: string;
};

/**
 * Resolve the fantasy schedule week using ESPN Wed→Tue windows (same refresh
 * boundary as NFL Scores). Clamped to the league's regular-season weeks.
 */
export async function resolveFantasyMatchupWeek(options: {
  seasonYear: number;
  /** Inclusive max week with regular-season matchups. */
  maxWeek: number;
  requestedWeek?: number | null;
}): Promise<{
  week: number;
  weeks: FantasyWeekOption[];
  calendarWeeks: ScheduleWeek[];
}> {
  const maxWeek = Math.max(1, options.maxWeek);
  const bootstrap = await getNflScoreboard({
    season: options.seasonYear,
    week: 1,
  });

  const calendarWeeks = bootstrap.weeks.filter(
    (entry) => entry.number >= 1 && entry.number <= maxWeek,
  );

  const weeks: FantasyWeekOption[] =
    calendarWeeks.length > 0
      ? calendarWeeks.map((entry) => ({
          number: entry.number,
          label: entry.label,
          rangeLabel: entry.rangeLabel,
        }))
      : Array.from({ length: maxWeek }, (_, index) => {
          const number = index + 1;
          return {
            number,
            label: `Week ${number}`,
            rangeLabel: "",
          };
        });

  const defaultWeek = Math.min(
    calendarWeeks.length > 0
      ? getDefaultScheduleWeek(calendarWeeks)
      : 1,
    maxWeek,
  );

  const requested = options.requestedWeek;
  const week =
    requested != null && weeks.some((entry) => entry.number === requested)
      ? requested
      : defaultWeek;

  return { week, weeks, calendarWeeks };
}

export function parseWeekQueryParam(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const week = Number(raw);
  if (!Number.isFinite(week) || week < 1 || week > 18) {
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
