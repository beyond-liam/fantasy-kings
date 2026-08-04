import {
  isNflTeamAbbrev,
  type NflTeamAbbrev,
} from "@/lib/nfl/teams";

/**
 * Home stadium roof type. Retractable roofs are treated as indoor for
 * Overview splits unless per-game open/closed data is available later.
 *
 * Source: current NFL stadiums (open-air / enclosed / retractable / skylight).
 */
export type NflStadiumRoof = "outdoor" | "indoor";

const STADIUM_ROOF_BY_TEAM: Record<NflTeamAbbrev, NflStadiumRoof> = {
  ARI: "indoor", // State Farm — retractable
  ATL: "indoor", // Mercedes-Benz — retractable
  BAL: "outdoor",
  BUF: "outdoor",
  CAR: "outdoor",
  CHI: "outdoor",
  CIN: "outdoor",
  CLE: "outdoor",
  DAL: "indoor", // AT&T — retractable
  DEN: "outdoor",
  DET: "indoor", // Ford Field — dome
  GB: "outdoor",
  HOU: "indoor", // NRG — retractable
  IND: "indoor", // Lucas Oil — retractable
  JAX: "outdoor",
  KC: "outdoor",
  LAC: "indoor", // SoFi — fixed translucent roof
  LAR: "indoor", // SoFi
  LV: "indoor", // Allegiant — dome
  MIA: "outdoor",
  MIN: "indoor", // U.S. Bank — dome
  NE: "outdoor",
  NO: "indoor", // Caesars Superdome
  NYG: "outdoor",
  NYJ: "outdoor",
  PHI: "outdoor",
  PIT: "outdoor",
  SEA: "outdoor",
  SF: "outdoor",
  TB: "outdoor",
  TEN: "outdoor",
  WAS: "outdoor",
};

export function getNflStadiumRoof(
  teamAbbrev: string | null | undefined,
): NflStadiumRoof | null {
  if (!teamAbbrev || !isNflTeamAbbrev(teamAbbrev)) return null;
  return STADIUM_ROOF_BY_TEAM[teamAbbrev];
}

/**
 * Game-site team for a player's week (home stadium owner).
 * Home week → player's team; away week → opponent abbrev.
 */
export function getGameSiteTeam(input: {
  playerTeam: string | null | undefined;
  venue: "home" | "away" | null | undefined;
  opponentAbbrev: string | null | undefined;
}): string | null {
  if (input.venue === "home") {
    return input.playerTeam?.trim() || null;
  }
  if (input.venue === "away") {
    return input.opponentAbbrev?.trim() || null;
  }
  return null;
}

export function getGameSiteRoof(input: {
  playerTeam: string | null | undefined;
  venue: "home" | "away" | null | undefined;
  opponentAbbrev: string | null | undefined;
}): NflStadiumRoof | null {
  return getNflStadiumRoof(getGameSiteTeam(input));
}
