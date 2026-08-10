import { WIZARD_DEFAULTS } from "@/lib/leagues/defaults";
import { resolveScheduleSettings } from "@/lib/leagues/schedule/settings";
import type { ScheduleSettings } from "@/db/schema/league-seasons";

export const CHAMPIONSHIP_WEEKS = [13, 14, 15, 16, 17, 18] as const;
export const PLAYOFF_TEAM_COUNTS = [4, 6, 8] as const;
export const TEAM_COUNT_MIN = 4;
export const TEAM_COUNT_MAX = 16;

export type PlayoffCalendarOptions = {
  enabled?: boolean;
  twoWeekChampionship?: boolean;
};

export function getPlayoffWeekCount(
  playoffTeamCount: number,
  options: PlayoffCalendarOptions = {},
): number {
  if (options.enabled === false) {
    return 0;
  }

  let weeks = 2;
  if (playoffTeamCount === 6 || playoffTeamCount === 8) {
    weeks = 3;
  } else if (playoffTeamCount === 4) {
    weeks = 2;
  }

  if (options.twoWeekChampionship) {
    weeks += 1;
  }

  return weeks;
}

/** Byes so the first round pads to the next power-of-two bracket size. */
export function getFirstRoundByes(playoffTeamCount: number): number {
  if (playoffTeamCount <= 0) {
    return 0;
  }
  let bracketSize = 1;
  while (bracketSize < playoffTeamCount) {
    bracketSize *= 2;
  }
  return bracketSize - playoffTeamCount;
}

export function getPlayoffWeekRange(
  championshipWeek: number,
  playoffTeamCount: number,
  options: PlayoffCalendarOptions = {},
): { startWeek: number; endWeek: number } | null {
  const weeks = getPlayoffWeekCount(playoffTeamCount, options);
  if (weeks < 1) {
    return null;
  }
  return {
    startWeek: championshipWeek - weeks + 1,
    endWeek: championshipWeek,
  };
}

export function getRegularSeasonEndWeek(
  championshipWeek: number,
  playoffTeamCount: number,
  options: PlayoffCalendarOptions = {},
): number {
  if (options.enabled === false) {
    return championshipWeek;
  }
  return championshipWeek - getPlayoffWeekCount(playoffTeamCount, options);
}

/** Inclusive NFL weeks from `startWeek` through `endWeek` (empty if inverted). */
export function listWeeksInclusive(startWeek: number, endWeek: number): number[] {
  if (endWeek < startWeek) {
    return [];
  }
  return Array.from(
    { length: endWeek - startWeek + 1 },
    (_, index) => startWeek + index,
  );
}

/** Playoff weeks between regular-season end and championship (exclusive of RS end). */
export function listPlayoffWeeksFromCalendar(
  regularSeasonEndWeek: number,
  championshipWeek: number,
): number[] {
  return listWeeksInclusive(regularSeasonEndWeek + 1, championshipWeek);
}

/**
 * Last NFL week that counts for a fantasy league season (championship week).
 * Falls back to 18 only when calendar fields are missing.
 */
export function resolveLeagueSeasonMaxWeek(input: {
  regularSeasonEndWeek?: number | null;
  playoffWeeks?: number[] | null;
  championshipWeek?: number | null;
}): number {
  if (
    input.championshipWeek != null &&
    Number.isFinite(input.championshipWeek) &&
    input.championshipWeek > 0
  ) {
    return Math.trunc(input.championshipWeek);
  }
  const regular = input.regularSeasonEndWeek ?? 0;
  const playoffs = input.playoffWeeks ?? [];
  const playoffMax = playoffs.length > 0 ? Math.max(...playoffs) : 0;
  const cap = Math.max(regular, playoffMax);
  return cap > 0 ? cap : 18;
}

/** Default wizard calendar when no league context is attached. */
export function defaultLeagueSeasonCalendar(): {
  regularSeasonEndWeek: number;
  playoffWeeks: number[];
  championshipWeek: number;
} {
  const championshipWeek = WIZARD_DEFAULTS.championshipWeek;
  const regularSeasonEndWeek = getRegularSeasonEndWeek(
    championshipWeek,
    WIZARD_DEFAULTS.playoffTeamCount,
  );
  return {
    regularSeasonEndWeek,
    playoffWeeks: listPlayoffWeeksFromCalendar(
      regularSeasonEndWeek,
      championshipWeek,
    ),
    championshipWeek,
  };
}

export function isValidSeasonCalendar(
  championshipWeek: number,
  playoffTeamCount: number,
  options: PlayoffCalendarOptions = {},
): boolean {
  if (
    !CHAMPIONSHIP_WEEKS.includes(
      championshipWeek as (typeof CHAMPIONSHIP_WEEKS)[number],
    )
  ) {
    return false;
  }
  if (options.enabled === false) {
    return championshipWeek >= 1;
  }
  if (
    !PLAYOFF_TEAM_COUNTS.includes(
      playoffTeamCount as (typeof PLAYOFF_TEAM_COUNTS)[number],
    )
  ) {
    return false;
  }
  return getRegularSeasonEndWeek(championshipWeek, playoffTeamCount, options) >= 1;
}

/**
 * True once this league's fantasy season is underway for the NFL year.
 * Offseason stays unlocked. Preseason only locks when the league includes
 * those preseason weeks and we've reached the configured start week.
 */
export function isNflSeasonUnderway(
  seasonYear: number,
  nfl: { season: string; season_type: string; week: number },
  schedule?: ScheduleSettings | null,
): boolean {
  const nflSeason = Number(nfl.season);
  if (!Number.isFinite(nflSeason)) {
    return false;
  }
  if (nflSeason > seasonYear) {
    return true;
  }
  if (nflSeason < seasonYear) {
    return false;
  }

  if (nfl.season_type === "off") {
    return false;
  }

  if (nfl.season_type === "pre") {
    const settings = resolveScheduleSettings(schedule);
    if (!settings.includePreseason) {
      return false;
    }
    // ESPN/Sleeper week 1 = Hall of Fame; user Week 1 starts at ESPN week 2.
    const espnStart = (settings.preseasonStartWeek ?? 1) + 1;
    return nfl.week >= espnStart;
  }

  if (nfl.season_type === "regular") {
    return nfl.week >= 1;
  }

  // post / playoffs / unknown in-season phases
  return true;
}

/** Schedule / playoff calendar edits until the fantasy season begins. */
export function isScheduleEditable(
  seasonYear: number,
  nfl: { season: string; season_type: string; week: number },
  schedule?: ScheduleSettings | null,
): boolean {
  return !isNflSeasonUnderway(seasonYear, nfl, schedule);
}

/**
 * Fantasy-league preseason: after the draft / FA opens, until this league's
 * first counting fantasy week starts (`isNflSeasonUnderway`).
 * Not the same as NFL `season_type === "pre"` — if the league includes NFL
 * preseason weeks, fantasy preseason ends when those weeks begin.
 */
export function isFantasyLeaguePreseason(
  seasonYear: number,
  nfl: { season: string; season_type: string; week: number },
  schedule?: ScheduleSettings | null,
): boolean {
  return !isNflSeasonUnderway(seasonYear, nfl, schedule);
}
