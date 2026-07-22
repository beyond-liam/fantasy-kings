import { normalizeNflTeamAbbrev } from "@/lib/nfl/matchups";

/**
 * Official NFL team colors from https://teamcolorcodes.com/nfl-team-color-codes/
 * `primary` / `secondary` = site Color 1 / Color 2.
 * `header` / `bar` = profile header backgrounds (may differ when Color 1 is gold/black).
 */
export type NflTeamColors = {
  abbrev: string;
  name: string;
  /** Short name for the info bar, e.g. "BRONCOS". */
  shortName: string;
  primary: string;
  secondary: string;
  header: string;
  bar: string;
};

const NFL_TEAM_COLORS: Record<
  string,
  Pick<NflTeamColors, "name" | "shortName" | "primary" | "secondary">
> = {
  ARI: {
    name: "Arizona Cardinals",
    shortName: "CARDINALS",
    primary: "#97233F",
    secondary: "#000000",
  },
  ATL: {
    name: "Atlanta Falcons",
    shortName: "FALCONS",
    primary: "#A71930",
    secondary: "#000000",
  },
  BAL: {
    name: "Baltimore Ravens",
    shortName: "RAVENS",
    primary: "#241773",
    secondary: "#000000",
  },
  BUF: {
    name: "Buffalo Bills",
    shortName: "BILLS",
    primary: "#00338D",
    secondary: "#C60C30",
  },
  CAR: {
    name: "Carolina Panthers",
    shortName: "PANTHERS",
    primary: "#0085CA",
    secondary: "#101820",
  },
  CHI: {
    name: "Chicago Bears",
    shortName: "BEARS",
    primary: "#0B162A",
    secondary: "#C83803",
  },
  CIN: {
    name: "Cincinnati Bengals",
    shortName: "BENGALS",
    primary: "#FB4F14",
    secondary: "#000000",
  },
  CLE: {
    name: "Cleveland Browns",
    shortName: "BROWNS",
    primary: "#311D00",
    secondary: "#FF3C00",
  },
  DAL: {
    name: "Dallas Cowboys",
    shortName: "COWBOYS",
    primary: "#003594",
    secondary: "#041E42",
  },
  DEN: {
    name: "Denver Broncos",
    shortName: "BRONCOS",
    primary: "#FB4F14",
    secondary: "#002244",
  },
  DET: {
    name: "Detroit Lions",
    shortName: "LIONS",
    primary: "#0076B6",
    secondary: "#B0B7BC",
  },
  GB: {
    name: "Green Bay Packers",
    shortName: "PACKERS",
    primary: "#203731",
    secondary: "#FFB612",
  },
  HOU: {
    name: "Houston Texans",
    shortName: "TEXANS",
    primary: "#03202F",
    secondary: "#A71930",
  },
  IND: {
    name: "Indianapolis Colts",
    shortName: "COLTS",
    primary: "#002C5F",
    secondary: "#A2AAAD",
  },
  JAX: {
    name: "Jacksonville Jaguars",
    shortName: "JAGUARS",
    primary: "#101820",
    secondary: "#D7A22A",
  },
  KC: {
    name: "Kansas City Chiefs",
    shortName: "CHIEFS",
    primary: "#E31837",
    secondary: "#FFB81C",
  },
  LAC: {
    name: "Los Angeles Chargers",
    shortName: "CHARGERS",
    primary: "#0080C6",
    secondary: "#FFC20E",
  },
  LAR: {
    name: "Los Angeles Rams",
    shortName: "RAMS",
    primary: "#003594",
    secondary: "#FFA300",
  },
  LV: {
    name: "Las Vegas Raiders",
    shortName: "RAIDERS",
    primary: "#000000",
    secondary: "#A5ACAF",
  },
  MIA: {
    name: "Miami Dolphins",
    shortName: "DOLPHINS",
    primary: "#008E97",
    secondary: "#FC4C02",
  },
  MIN: {
    name: "Minnesota Vikings",
    shortName: "VIKINGS",
    primary: "#4F2683",
    secondary: "#FFC62F",
  },
  NE: {
    name: "New England Patriots",
    shortName: "PATRIOTS",
    primary: "#002244",
    secondary: "#C60C30",
  },
  NO: {
    name: "New Orleans Saints",
    shortName: "SAINTS",
    primary: "#D3BC8D",
    secondary: "#101820",
  },
  NYG: {
    name: "New York Giants",
    shortName: "GIANTS",
    primary: "#0B2265",
    secondary: "#A71930",
  },
  NYJ: {
    name: "New York Jets",
    shortName: "JETS",
    primary: "#125740",
    secondary: "#000000",
  },
  PHI: {
    name: "Philadelphia Eagles",
    shortName: "EAGLES",
    primary: "#004C54",
    secondary: "#A5ACAF",
  },
  PIT: {
    name: "Pittsburgh Steelers",
    shortName: "STEELERS",
    primary: "#FFB612",
    secondary: "#101820",
  },
  SEA: {
    name: "Seattle Seahawks",
    shortName: "SEAHAWKS",
    primary: "#002244",
    secondary: "#69BE28",
  },
  SF: {
    name: "San Francisco 49ers",
    shortName: "49ERS",
    primary: "#AA0000",
    secondary: "#B3995D",
  },
  TB: {
    name: "Tampa Bay Buccaneers",
    shortName: "BUCCANEERS",
    primary: "#D50A0A",
    secondary: "#34302B",
  },
  TEN: {
    name: "Tennessee Titans",
    shortName: "TITANS",
    primary: "#0C2340",
    secondary: "#4B92DB",
  },
  WAS: {
    name: "Washington Commanders",
    shortName: "COMMANDERS",
    primary: "#5A1414",
    secondary: "#FFB612",
  },
};

/**
 * Header/bar when site Color 1 is gold/black and a jersey color reads better.
 * Official primary/secondary in the map stay untouched.
 */
const HEADER_SURFACE_OVERRIDES: Partial<
  Record<string, { header: string; bar: string }>
> = {
  JAX: { header: "#006778", bar: "#101820" },
  NO: { header: "#101820", bar: "#D3BC8D" },
  PIT: { header: "#101820", bar: "#FFB612" },
};

const NFL_TEAM_DIVISIONS: Record<string, string> = {
  BUF: "AFC East",
  MIA: "AFC East",
  NE: "AFC East",
  NYJ: "AFC East",
  BAL: "AFC North",
  CIN: "AFC North",
  CLE: "AFC North",
  PIT: "AFC North",
  HOU: "AFC South",
  IND: "AFC South",
  JAX: "AFC South",
  TEN: "AFC South",
  DEN: "AFC West",
  KC: "AFC West",
  LAC: "AFC West",
  LV: "AFC West",
  DAL: "NFC East",
  NYG: "NFC East",
  PHI: "NFC East",
  WAS: "NFC East",
  CHI: "NFC North",
  DET: "NFC North",
  GB: "NFC North",
  MIN: "NFC North",
  ATL: "NFC South",
  CAR: "NFC South",
  NO: "NFC South",
  TB: "NFC South",
  ARI: "NFC West",
  LAR: "NFC West",
  SF: "NFC West",
  SEA: "NFC West",
};

export function getNflTeamDivision(
  nflTeam: string | null | undefined,
): string | null {
  const abbrev = normalizeNflTeamAbbrev(nflTeam);
  if (!abbrev) {
    return null;
  }
  return NFL_TEAM_DIVISIONS[abbrev] ?? null;
}

/** Public stadium photos keyed by team abbrev (add assets under `/public`). */
const NFL_TEAM_STADIUMS: Partial<Record<string, string>> = {
  ARI: "/cardinals-stadium.jpg",
  ATL: "/falcons-stadium.jpg",
  BAL: "/ravens-stadium.jpg",
  BUF: "/bills-stadium.jpg",
  CAR: "/panthers-stadium.jpg",
  CHI: "/bears-stadium.jpg",
  CIN: "/bengals-stadium.jpg",
  CLE: "/browns-stadium.jpg",
  DAL: "/cowboys-stadium.jpg",
  DEN: "/broncos-stadium.jpg",
  DET: "/detroit-stadium.jpg",
  GB: "/packers-stadium.jpg",
  HOU: "/texans-stadium.jpg",
  IND: "/colts-stadium.jpg",
  JAX: "/jaguars-stadium.jpg",
  KC: "/chiefs-stadium.jpg",
  LAC: "/chargers-stadium.jpg",
  LAR: "/rams-stadium.jpg",
  LV: "/raiders-stadium.jpg",
  MIA: "/dolphins-stadium.jpg",
  MIN: "/vikings-stadium.jpg",
  NE: "/patriots-stadium.jpg",
  NO: "/saints-stadium.jpg",
  NYG: "/giants-stadium.jpg",
  NYJ: "/jets-stadium.jpg",
  PHI: "/eagles-stadium.jpg",
  PIT: "/steelers-stadium.jpg",
  SEA: "/seahawks-stadium.jpg",
  SF: "/49ers-stadium.jpg",
  TB: "/buccaneers-stadium.jpg",
  TEN: "/titans-stadium.jpg",
  WAS: "/commanders-stadium.jpg",
};

export function getNflTeamStadiumUrl(
  nflTeam: string | null | undefined,
): string | null {
  const abbrev = normalizeNflTeamAbbrev(nflTeam);
  if (!abbrev) {
    return null;
  }
  return NFL_TEAM_STADIUMS[abbrev] ?? null;
}

export function getNflTeamColors(
  nflTeam: string | null | undefined,
): NflTeamColors | null {
  const abbrev = normalizeNflTeamAbbrev(nflTeam);
  if (!abbrev) {
    return null;
  }
  const entry = NFL_TEAM_COLORS[abbrev];
  if (!entry) {
    return null;
  }
  const surfaces = HEADER_SURFACE_OVERRIDES[abbrev];
  return {
    abbrev,
    ...entry,
    header: surfaces?.header ?? entry.primary,
    bar: surfaces?.bar ?? entry.secondary,
  };
}

/** Relative luminance 0–1 for choosing light vs dark foreground. */
export function hexLuminance(hex: string): number {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) {
    return 0;
  }
  const r = Number.parseInt(raw.slice(0, 2), 16) / 255;
  const g = Number.parseInt(raw.slice(2, 4), 16) / 255;
  const b = Number.parseInt(raw.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastForeground(backgroundHex: string): "#ffffff" | "#0a0a0a" {
  return hexLuminance(backgroundHex) > 0.45 ? "#0a0a0a" : "#ffffff";
}
