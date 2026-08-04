import { WIZARD_DEFAULTS } from "@/lib/leagues/defaults";

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
 * True once the NFL year for this league season is underway (regular season
 * or later). Offseason / preseason stay unlocked so commissioners can still
 * tweak the calendar before Week 1.
 */
export function isNflSeasonUnderway(
  seasonYear: number,
  nfl: { season: string; season_type: string; week: number },
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

  if (nfl.season_type === "off" || nfl.season_type === "pre") {
    return false;
  }

  if (nfl.season_type === "regular") {
    return nfl.week >= 1;
  }

  // post / playoffs / unknown in-season phases
  return true;
}

/** Schedule / playoff calendar edits until NFL Week 1 of the season year. */
export function isScheduleEditable(
  seasonYear: number,
  nfl: { season: string; season_type: string; week: number },
): boolean {
  return !isNflSeasonUnderway(seasonYear, nfl);
}
