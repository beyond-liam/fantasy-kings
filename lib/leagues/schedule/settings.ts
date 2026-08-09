import type {
  PlayEachOtherTimes,
  ScheduleSettings,
} from "@/db/schema/league-seasons";

export const PLAY_EACH_OTHER_OPTIONS = [1, 2, 3] as const satisfies readonly PlayEachOtherTimes[];

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  playEachOtherTimes: 1,
  /** Off by default — enabling extends the fantasy season into NFL preseason. */
  includePreseason: false,
  preseasonStartWeek: 1,
};

export function resolveScheduleSettings(
  stored?: ScheduleSettings | null,
): ScheduleSettings {
  const times = stored?.playEachOtherTimes;
  const playEachOtherTimes: PlayEachOtherTimes =
    times === 1 || times === 2 || times === 3
      ? times
      : DEFAULT_SCHEDULE_SETTINGS.playEachOtherTimes;

  const startWeek = stored?.preseasonStartWeek;
  const preseasonStartWeek =
    typeof startWeek === "number" &&
    Number.isInteger(startWeek) &&
    startWeek >= 1 &&
    startWeek <= 3
      ? startWeek
      : DEFAULT_SCHEDULE_SETTINGS.preseasonStartWeek!;

  return {
    playEachOtherTimes,
    includePreseason:
      stored?.includePreseason ?? DEFAULT_SCHEDULE_SETTINGS.includePreseason!,
    preseasonStartWeek,
  };
}

/** Single-division leagues may only play each other once. */
export function maxPlayEachOtherTimes(divisionCount: number): PlayEachOtherTimes {
  return divisionCount <= 1 ? 1 : 3;
}

export function clampPlayEachOtherTimes(
  times: number,
  divisionCount: number,
): PlayEachOtherTimes {
  const max = maxPlayEachOtherTimes(divisionCount);
  if (times >= 3 && max >= 3) return 3;
  if (times >= 2 && max >= 2) return 2;
  return 1;
}
