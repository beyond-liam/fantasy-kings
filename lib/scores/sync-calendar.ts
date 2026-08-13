import { getNflScoreboard } from "@/lib/espn/scoreboard";
import {
  NFL_PRESEASON_FIRST_WEEK,
  NFL_PRESEASON_HOF_WEEK,
  nflSeasonTypeFromSleeper,
} from "@/lib/leagues/schedule/fantasy-week-map";
import { getDefaultScheduleWeekEntry } from "@/lib/nfl/schedule-week";
import type { SleeperNflState } from "@/lib/sleeper/api";

export type ScoreSyncSeasonType = "pre" | "regular" | "post";

export type ScoreSyncTarget = {
  season: string;
  /** Week aligned with ESPN / fantasy-week-map (pre: 1=HOF, 2–4=Pre 1–3). */
  week: number;
  seasonType: ScoreSyncSeasonType;
};

export type ScoreSyncSkip = {
  skipped: true;
  reason: string;
  season: string;
  week: number;
};

export function isScoreSyncSkip(
  value: ScoreSyncTarget | ScoreSyncSkip,
): value is ScoreSyncSkip {
  return "skipped" in value && value.skipped === true;
}

/**
 * Pick the NFL calendar week to sync.
 * During preseason, prefer ESPN's current preseason window (same as NFL Scores)
 * so we don't stay stuck on HOF (week 1) while Preseason Week 1 games are live.
 */
export async function resolveScoreSyncTarget(input: {
  state: SleeperNflState;
  weekOverride?: number;
  seasonOverride?: string;
  now?: Date;
  /** Test seam — returns ESPN-numbered preseason week windows. */
  loadPreseasonWeeks?: (
    seasonYear: number,
  ) => Promise<Array<{ number: number; startDate: Date; endDate: Date }>>;
}): Promise<ScoreSyncTarget | ScoreSyncSkip> {
  const state = input.state;
  const hasWeekOverride = input.weekOverride != null;
  const hasSeasonOverride =
    input.seasonOverride != null && input.seasonOverride.trim() !== "";

  let season = hasSeasonOverride
    ? input.seasonOverride!.trim()
    : state.season;

  if (!hasWeekOverride && state.season_type === "off") {
    return {
      skipped: true,
      reason:
        "Sleeper is in offseason (week 0). Pass ?season=YYYY&week=N to sync a prior week.",
      season: state.season,
      week: 0,
    };
  }

  if (
    hasWeekOverride &&
    !hasSeasonOverride &&
    (state.season_type === "off" ||
      state.display_week === 0 ||
      state.week === 0)
  ) {
    season = state.previous_season;
  }

  const seasonType: ScoreSyncSeasonType =
    nflSeasonTypeFromSleeper(state.season_type) ?? "regular";

  if (hasWeekOverride) {
    const week = input.weekOverride!;
    if (!Number.isFinite(week) || week < 1 || week > 18) {
      throw new Error(`Invalid fantasy week for score sync: ${week}`);
    }
    return { season, week, seasonType };
  }

  if (seasonType === "pre") {
    const seasonYear = Number.parseInt(season, 10);
    const loadWeeks =
      input.loadPreseasonWeeks ??
      (async (year: number) => {
        const board = await getNflScoreboard({
          season: year,
          week: NFL_PRESEASON_FIRST_WEEK,
          seasonType: 1,
          calendarSeasonTypes: [1],
        });
        return board.weeks
          .filter((entry) => entry.seasonType === 1)
          .map((entry) => ({
            number: entry.number,
            startDate: entry.startDate,
            endDate: entry.endDate,
          }));
      });

    if (Number.isFinite(seasonYear)) {
      try {
        const weeks = await loadWeeks(seasonYear);
        const current = getDefaultScheduleWeekEntry(
          weeks,
          input.now ?? new Date(),
        );
        if (current && current.number >= 1 && current.number <= 18) {
          return {
            season,
            week: current.number,
            seasonType: "pre",
          };
        }
      } catch {
        // Fall through to Sleeper week with HOF bump.
      }
    }

    const sleeperWeek = state.display_week ?? state.week;
    // Sleeper often stays on HOF (1) while Preseason Week 1 (ESPN 2) is live.
    const week =
      !Number.isFinite(sleeperWeek) || sleeperWeek <= NFL_PRESEASON_HOF_WEEK
        ? NFL_PRESEASON_FIRST_WEEK
        : sleeperWeek;

    return { season, week, seasonType: "pre" };
  }

  const week = state.display_week ?? state.week;
  if (!Number.isFinite(week) || week < 1 || week > 18) {
    return {
      skipped: true,
      reason:
        "Sleeper is in offseason (week 0). Pass ?season=YYYY&week=N to sync a prior week.",
      season: state.season,
      week: 0,
    };
  }

  return { season, week, seasonType };
}
