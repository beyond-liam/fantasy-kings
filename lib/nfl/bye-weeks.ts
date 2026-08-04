/** Official NFL bye weeks by team abbreviation, keyed by season year. */

const NFL_BYE_WEEKS_2025: Record<string, number> = {
  ARI: 8,
  ATL: 5,
  BAL: 7,
  BUF: 7,
  CAR: 14,
  CHI: 5,
  CIN: 10,
  CLE: 9,
  DAL: 10,
  DEN: 12,
  DET: 8,
  GB: 5,
  HOU: 6,
  IND: 11,
  JAX: 8,
  KC: 10,
  LAC: 12,
  LAR: 8,
  LV: 8,
  MIA: 12,
  MIN: 6,
  NE: 14,
  NO: 11,
  NYG: 14,
  NYJ: 9,
  PHI: 9,
  PIT: 5,
  SEA: 8,
  SF: 14,
  TB: 9,
  TEN: 10,
  WAS: 12,
};

/** 2026 NFL bye weeks by team abbreviation (official schedule). */
const NFL_BYE_WEEKS_2026: Record<string, number> = {
  ARI: 14,
  ATL: 11,
  BAL: 13,
  BUF: 7,
  CAR: 5,
  CHI: 10,
  CIN: 6,
  CLE: 11,
  DAL: 14,
  DEN: 10,
  DET: 6,
  GB: 11,
  HOU: 8,
  IND: 13,
  JAX: 7,
  KC: 5,
  LAC: 7,
  LAR: 11,
  LV: 13,
  MIA: 6,
  MIN: 6,
  NE: 11,
  NO: 8,
  NYG: 8,
  NYJ: 13,
  PHI: 10,
  PIT: 9,
  SEA: 11,
  SF: 8,
  TB: 10,
  TEN: 9,
  WAS: 7,
};

const BYE_WEEKS_BY_SEASON: Record<number, Record<string, number>> = {
  2025: NFL_BYE_WEEKS_2025,
  2026: NFL_BYE_WEEKS_2026,
};

export function getNflTeamByeWeek(
  nflTeam: string | null | undefined,
  seasonYear = 2026,
): number | null {
  if (!nflTeam) return null;
  const map = BYE_WEEKS_BY_SEASON[seasonYear];
  if (!map) return null;
  return map[nflTeam.toUpperCase()] ?? null;
}

/**
 * Prefer season-specific team bye map when available.
 * Fall back to the stored player bye only when we have no map for that season
 * (stored bye is usually the current NFL season and can be wrong historically).
 */
export function resolvePlayerByeWeek(input: {
  byeWeek?: number | null;
  nflTeam?: string | null;
  seasonYear?: number;
}): number | null {
  const seasonYear = input.seasonYear ?? 2026;
  const fromMap = getNflTeamByeWeek(input.nflTeam, seasonYear);
  if (fromMap != null) return fromMap;
  if (input.byeWeek != null) return input.byeWeek;
  return null;
}
