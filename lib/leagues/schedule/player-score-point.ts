import type { ScheduleSettings } from "@/db/schema/league-seasons";
import {
  NFL_PRESEASON_FIRST_WEEK,
  NFL_PRESEASON_HOF_WEEK,
  NFL_PRESEASON_LAST_WEEK,
  fantasyWeekFromNflState,
  fantasyWeekToNfl,
  nflSeasonTypeFromSleeper,
  nflToFantasyWeek,
  preseasonFantasyWeekCount,
  type NflCalendarPoint,
} from "@/lib/leagues/schedule/fantasy-week-map";
import { resolveScheduleSettings } from "@/lib/leagues/schedule/settings";
import { isNflSeasonUnderway } from "@/lib/leagues/season-calendar";
import {
  DEFAULT_PLAYER_WEEK_ITEMS,
  REGULAR_SEASON_WEEK_COUNT,
  type PlayerWeekSelectItem,
} from "@/lib/rankings/player-week-items";

export type { PlayerWeekSelectItem };
export { DEFAULT_PLAYER_WEEK_ITEMS };

export type PlayerScorePoint = NflCalendarPoint;

export type PlayerScoreNflState = {
  season: string;
  season_type: string;
  week: number;
  display_week?: number;
};

/**
 * Current NFL calendar for live player_scores (cron syncs this week, not week 0).
 * Hall of Fame (pre week 1) bumps to Preseason Week 1, matching score sync.
 */
export function currentNflScorePoint(
  nfl: PlayerScoreNflState,
): PlayerScorePoint | null {
  const seasonType = nflSeasonTypeFromSleeper(nfl.season_type);
  if (!seasonType) {
    return null;
  }
  const week = nfl.display_week ?? nfl.week;
  if (!Number.isFinite(week) || week < 1) {
    return null;
  }
  if (seasonType === "pre" && week <= NFL_PRESEASON_HOF_WEEK) {
    return { seasonType: "pre", week: NFL_PRESEASON_FIRST_WEEK };
  }
  return { seasonType, week: Math.trunc(week) };
}

/**
 * Map a Players-table week selection to `player_scores`.
 *
 * League `schedule` (when passed) gates preseason: redraft leagues stay on
 * regular-season rows until NFL week 1. Omitting `schedule` (global Rankings)
 * never uses preseason — wait for the NFL regular season.
 *
 * `selectedWeek === 0` (Season) + stats uses the current counting NFL week
 * because cron writes weekly rows, not season totals.
 */
export function resolvePlayerScorePoint(input: {
  selectedWeek: number;
  kind: "projection" | "stats";
  nfl: PlayerScoreNflState;
  schedule?: ScheduleSettings | null;
  seasonYear?: number;
}): PlayerScorePoint {
  const { selectedWeek, kind, nfl, schedule, seasonYear } = input;

  const nflSeasonYear = Number(nfl.season);
  const year = seasonYear ?? nflSeasonYear;
  const isCurrentSeason =
    Number.isFinite(year) && Number.isFinite(nflSeasonYear) && year === nflSeasonYear;

  if (!isCurrentSeason) {
    if (selectedWeek >= 1) {
      return { seasonType: "regular", week: Math.trunc(selectedWeek) };
    }
    return { seasonType: "regular", week: 0 };
  }

  if (selectedWeek >= 1) {
    if (schedule !== undefined) {
      return (
        fantasyWeekToNfl(selectedWeek, schedule) ?? {
          seasonType: "regular",
          week: Math.trunc(selectedWeek),
        }
      );
    }
    return { seasonType: "regular", week: Math.trunc(selectedWeek) };
  }

  if (kind === "projection") {
    return { seasonType: "regular", week: 0 };
  }

  if (schedule !== undefined) {
    const current = currentNflScorePoint(nfl);
    if (current && nflToFantasyWeek(current, schedule) != null) {
      return current;
    }
    if (!isNflSeasonUnderway(year, nfl, schedule)) {
      return { seasonType: "regular", week: 0 };
    }
    const fantasyWeek = fantasyWeekFromNflState(nfl, schedule);
    const mapped =
      fantasyWeek != null ? fantasyWeekToNfl(fantasyWeek, schedule) : null;
    if (mapped) {
      return mapped;
    }
  }

  // Global Rankings / search: regular season only — never NFL preseason.
  const current = currentNflScorePoint(nfl);
  if (current && current.seasonType !== "pre") {
    return current;
  }
  return { seasonType: "regular", week: 0 };
}

/** Last NFL week that can appear in a game log for this season type. */
export function playerScoreLogMaxWeek(
  seasonType: PlayerScorePoint["seasonType"],
): number {
  return seasonType === "pre" ? NFL_PRESEASON_LAST_WEEK : REGULAR_SEASON_WEEK_COUNT;
}

/** League Players week dropdown: preseason fantasy weeks, then NFL 1–18. */
export function playerTableWeekItems(
  schedule?: ScheduleSettings | null,
): PlayerWeekSelectItem[] {
  const preCount = preseasonFantasyWeekCount(schedule);
  if (preCount === 0) {
    return DEFAULT_PLAYER_WEEK_ITEMS;
  }

  const start = resolveScheduleSettings(schedule).preseasonStartWeek ?? 1;
  const items: PlayerWeekSelectItem[] = [{ label: "Season", value: "season" }];
  for (let index = 1; index <= preCount; index++) {
    items.push({
      label: `Preseason Week ${start + index - 1}`,
      value: String(index),
    });
  }
  for (let week = 1; week <= REGULAR_SEASON_WEEK_COUNT; week++) {
    items.push({
      label: `Week ${week}`,
      value: String(preCount + week),
    });
  }
  return items;
}
