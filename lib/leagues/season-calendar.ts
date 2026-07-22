export const CHAMPIONSHIP_WEEKS = [13, 14, 15, 16, 17, 18] as const;
export const PLAYOFF_TEAM_COUNTS = [4, 6, 8] as const;
export const TEAM_COUNT_MIN = 8;
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
