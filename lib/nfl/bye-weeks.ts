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

export function getNflTeamByeWeek(
  nflTeam: string | null | undefined,
  seasonYear = 2026,
): number | null {
  if (!nflTeam) return null;
  if (seasonYear === 2026) {
    return NFL_BYE_WEEKS_2026[nflTeam.toUpperCase()] ?? null;
  }
  return null;
}

/** Prefer stored player bye; fall back to team bye map for the season. */
export function resolvePlayerByeWeek(input: {
  byeWeek?: number | null;
  nflTeam?: string | null;
  seasonYear?: number;
}): number | null {
  if (input.byeWeek != null) return input.byeWeek;
  return getNflTeamByeWeek(input.nflTeam, input.seasonYear);
}
