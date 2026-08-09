import { z } from "zod";

import type { EspnSeasonType } from "@/lib/espn/scoreboard";

export const PRESEASON_START_WEEK_OPTIONS = [
  { value: "1", label: "Week 1" },
  { value: "2", label: "Week 2" },
  { value: "3", label: "Week 3" },
] as const;

export type ScheduleSettingsValues = {
  includePreseason: boolean;
  /** User Preseason Week 1–3 (maps to ESPN weeks 2–4; HOF is excluded). */
  preseasonStartWeek: number;
};

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettingsValues = {
  includePreseason: false,
  preseasonStartWeek: 1,
};

export const scheduleSettingsSchema = z.object({
  includePreseason: z.boolean(),
  preseasonStartWeek: z.number().int().min(1).max(3),
});

export type ScheduleWeekEntry = {
  number: number;
  seasonType: EspnSeasonType;
};

/** Calendar season types to request from ESPN for NFL Scores. */
export function calendarSeasonTypesForSchedule(
  settings: ScheduleSettingsValues,
): EspnSeasonType[] {
  return settings.includePreseason ? [1, 2] : [2];
}

/**
 * Drop Hall of Fame and any preseason weeks before the configured start.
 * `preseasonStartWeek` is user Preseason Week 1–3 → ESPN week N+1.
 */
export function filterScheduleWeeks<T extends ScheduleWeekEntry>(
  weeks: T[],
  settings: ScheduleSettingsValues,
): T[] {
  if (!settings.includePreseason) {
    return weeks.filter((week) => week.seasonType !== 1);
  }

  const espnStartWeek = settings.preseasonStartWeek + 1;

  return weeks.filter(
    (week) => week.seasonType !== 1 || week.number >= espnStartWeek,
  );
}
