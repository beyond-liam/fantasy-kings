import type { ScheduleSettings } from "@/db/schema/league-seasons";
import type { EspnSeasonType } from "@/lib/espn/scoreboard";
import { resolveScheduleSettings } from "@/lib/leagues/schedule/settings";

/** NFL calendar point used for scoreboards / player_scores. */
export type NflCalendarPoint = {
  seasonType: "pre" | "regular" | "post";
  /**
   * Week within that NFL season type.
   * Pre: ESPN week 1 = Hall of Fame (not fantasy); 2–4 = Preseason Weeks 1–3.
   */
  week: number;
};

/** ESPN/Sleeper pre week 1 is Hall of Fame Weekend — never a fantasy week. */
export const NFL_PRESEASON_HOF_WEEK = 1;
/** ESPN week for labeled "Preseason Week 1". */
export const NFL_PRESEASON_FIRST_WEEK = 2;
/** ESPN week for labeled "Preseason Week 3". */
export const NFL_PRESEASON_LAST_WEEK = 4;
/**
 * Fantasy-eligible preseason weeks (excludes Hall of Fame).
 * User-facing start week is 1–3 → ESPN weeks 2–4.
 */
export const NFL_PRESEASON_WEEK_COUNT = 3;

/** Max fantasy week when championship is NFL 18 and all 3 pre weeks count. */
export const MAX_FANTASY_WEEK = NFL_PRESEASON_WEEK_COUNT + 18;

/** User Preseason Week N (1–3) → ESPN/Sleeper pre week number. */
export function userPreseasonWeekToEspn(userWeek: number): number {
  return NFL_PRESEASON_HOF_WEEK + Math.trunc(userWeek);
}

/** ESPN/Sleeper pre week → user Preseason Week (1–3), or null for HOF / invalid. */
export function espnPreseasonWeekToUser(espnWeek: number): number | null {
  if (
    !Number.isFinite(espnWeek) ||
    espnWeek <= NFL_PRESEASON_HOF_WEEK ||
    espnWeek > NFL_PRESEASON_LAST_WEEK
  ) {
    return null;
  }
  return Math.trunc(espnWeek) - NFL_PRESEASON_HOF_WEEK;
}

/**
 * How many fantasy weeks fall in NFL preseason.
 * Example: include + start week 2 → Pre 2–3 → 2 weeks (ESPN 3–4).
 */
export function preseasonFantasyWeekCount(
  stored?: ScheduleSettings | null,
): number {
  const settings = resolveScheduleSettings(stored);
  if (!settings.includePreseason) {
    return 0;
  }
  const start = settings.preseasonStartWeek ?? 1;
  return Math.max(0, NFL_PRESEASON_WEEK_COUNT - start + 1);
}

/** Fantasy week of the last regular-season H2H (NFL RS end + pre offset). */
export function fantasyRegularSeasonEndWeek(
  nflRegularSeasonEndWeek: number,
  stored?: ScheduleSettings | null,
): number {
  return preseasonFantasyWeekCount(stored) + nflRegularSeasonEndWeek;
}

/** Fantasy week of the championship (NFL champ week + pre offset). */
export function fantasyChampionshipWeek(
  nflChampionshipWeek: number,
  stored?: ScheduleSettings | null,
): number {
  return preseasonFantasyWeekCount(stored) + nflChampionshipWeek;
}

export function espnSeasonTypeForNfl(
  seasonType: NflCalendarPoint["seasonType"],
): EspnSeasonType {
  if (seasonType === "pre") return 1;
  if (seasonType === "post") return 3;
  return 2;
}

/** Map fantasy week → NFL calendar. Null if out of range. */
export function fantasyWeekToNfl(
  fantasyWeek: number,
  stored?: ScheduleSettings | null,
): NflCalendarPoint | null {
  if (!Number.isFinite(fantasyWeek) || fantasyWeek < 1) {
    return null;
  }
  const week = Math.trunc(fantasyWeek);
  const settings = resolveScheduleSettings(stored);
  const preCount = preseasonFantasyWeekCount(settings);

  if (week <= preCount) {
    const start = settings.preseasonStartWeek ?? 1;
    return {
      seasonType: "pre",
      week: userPreseasonWeekToEspn(start + week - 1),
    };
  }

  return {
    seasonType: "regular",
    week: week - preCount,
  };
}

/** Map NFL calendar → fantasy week. Null if outside this league's season. */
export function nflToFantasyWeek(
  point: NflCalendarPoint,
  stored?: ScheduleSettings | null,
): number | null {
  if (!Number.isFinite(point.week) || point.week < 1) {
    return null;
  }
  const settings = resolveScheduleSettings(stored);
  const preCount = preseasonFantasyWeekCount(settings);
  const nflWeek = Math.trunc(point.week);

  if (point.seasonType === "pre") {
    if (!settings.includePreseason) {
      return null;
    }
    const userWeek = espnPreseasonWeekToUser(nflWeek);
    if (userWeek == null) {
      return null;
    }
    const start = settings.preseasonStartWeek ?? 1;
    if (userWeek < start) {
      return null;
    }
    return userWeek - start + 1;
  }

  if (point.seasonType === "regular" || point.seasonType === "post") {
    return preCount + nflWeek;
  }

  return null;
}

export function nflSeasonTypeFromSleeper(
  seasonType: string,
): NflCalendarPoint["seasonType"] | null {
  if (seasonType === "pre") return "pre";
  if (seasonType === "post") return "post";
  if (seasonType === "regular") return "regular";
  return null;
}

/** Current fantasy week from Sleeper NFL state, if the league is in season. */
export function fantasyWeekFromNflState(
  nfl: { season_type: string; week: number; display_week?: number },
  stored?: ScheduleSettings | null,
): number | null {
  const seasonType = nflSeasonTypeFromSleeper(nfl.season_type);
  if (!seasonType) {
    return null;
  }
  const week = nfl.display_week ?? nfl.week;
  return nflToFantasyWeek({ seasonType, week }, stored);
}
