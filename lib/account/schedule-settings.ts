import { z } from "zod";

import type { EspnSeasonType } from "@/lib/espn/scoreboard";

export const PRESEASON_START_WEEK_OPTIONS = [
  { value: "1", label: "Week 1" },
  { value: "2", label: "Week 2" },
  { value: "3", label: "Week 3" },
  { value: "4", label: "Week 4" },
] as const;

export type ScheduleSettingsValues = {
  includePreseason: boolean;
  preseasonStartWeek: number;
};

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettingsValues = {
  includePreseason: true,
  preseasonStartWeek: 1,
};

export const scheduleSettingsSchema = z.object({
  includePreseason: z.boolean(),
  preseasonStartWeek: z.number().int().min(1).max(4),
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

/** Drop preseason weeks before the configured start week. */
export function filterScheduleWeeks<T extends ScheduleWeekEntry>(
  weeks: T[],
  settings: ScheduleSettingsValues,
): T[] {
  if (!settings.includePreseason) {
    return weeks.filter((week) => week.seasonType !== 1);
  }

  return weeks.filter(
    (week) =>
      week.seasonType !== 1 || week.number >= settings.preseasonStartWeek,
  );
}
