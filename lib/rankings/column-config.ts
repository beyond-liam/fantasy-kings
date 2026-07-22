export type PositionFilter = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

export const POSITION_FILTERS: PositionFilter[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
];

export const DEFAULT_POSITION_FILTER: PositionFilter = "QB";

export function parsePositionFilter(
  value: string | null | undefined,
): PositionFilter {
  if (value && POSITION_FILTERS.includes(value as PositionFilter)) {
    return value as PositionFilter;
  }

  return DEFAULT_POSITION_FILTER;
}

export type StatColumn = {
  key: string;
  header: string;
  tooltip: string;
  group?: string;
  decimals?: number;
};

const FANTASY_COLUMNS: StatColumn[] = [
  {
    key: "fantasy_pts",
    header: "PTS",
    tooltip: "Fantasy points",
    group: "Fantasy",
    decimals: 2,
  },
  {
    key: "adp",
    header: "ADP",
    tooltip: "Average draft position",
    group: "Fantasy",
    decimals: 1,
  },
];

const RUSHING_COLUMNS: StatColumn[] = [
  {
    key: "rush_att",
    header: "ATT",
    tooltip: "Rushing attempts",
    group: "Rushing",
    decimals: 1,
  },
  {
    key: "rush_yd",
    header: "YD",
    tooltip: "Rushing yards",
    group: "Rushing",
    decimals: 1,
  },
  {
    key: "rush_td",
    header: "TD",
    tooltip: "Rushing touchdowns",
    group: "Rushing",
    decimals: 1,
  },
];

const RECEIVING_COLUMNS: StatColumn[] = [
  {
    key: "rec",
    header: "REC",
    tooltip: "Receptions",
    group: "Receiving",
    decimals: 1,
  },
  {
    key: "rec_tgt",
    header: "TAR",
    tooltip: "Targets",
    group: "Receiving",
    decimals: 1,
  },
  {
    key: "rec_yd",
    header: "YD",
    tooltip: "Receiving yards",
    group: "Receiving",
    decimals: 1,
  },
  {
    key: "rec_td",
    header: "TD",
    tooltip: "Receiving touchdowns",
    group: "Receiving",
    decimals: 1,
  },
];

const PASSING_COLUMNS: StatColumn[] = [
  {
    key: "pass_cmp",
    header: "CMP",
    tooltip: "Completions",
    group: "Passing",
    decimals: 1,
  },
  {
    key: "pass_att",
    header: "ATT",
    tooltip: "Pass attempts",
    group: "Passing",
    decimals: 1,
  },
  {
    key: "pass_yd",
    header: "YD",
    tooltip: "Passing yards",
    group: "Passing",
    decimals: 1,
  },
  {
    key: "pass_td",
    header: "TD",
    tooltip: "Passing touchdowns",
    group: "Passing",
    decimals: 1,
  },
];

const KICKING_COLUMNS: StatColumn[] = [
  {
    key: "fgm",
    header: "FGM",
    tooltip: "Field goals made",
    group: "Kicking",
    decimals: 1,
  },
  {
    key: "fga",
    header: "FGA",
    tooltip: "Field goal attempts",
    group: "Kicking",
    decimals: 1,
  },
  {
    key: "xpm",
    header: "XPM",
    tooltip: "Extra points made",
    group: "Kicking",
    decimals: 1,
  },
];

const DEFENSE_COLUMNS: StatColumn[] = [
  {
    key: "fantasy_pts",
    header: "PTS",
    tooltip: "Fantasy points",
    group: "Fantasy",
    decimals: 2,
  },
  {
    key: "adp",
    header: "ADP",
    tooltip: "Average draft position",
    group: "Fantasy",
    decimals: 1,
  },
  {
    key: "def_td",
    header: "DEF TD",
    tooltip: "Defensive touchdowns",
    group: "Defense",
    decimals: 1,
  },
  {
    key: "def_kr_td",
    header: "KR TD",
    tooltip: "Kick return touchdowns",
    group: "Defense",
    decimals: 1,
  },
  {
    key: "st_td",
    header: "ST TD",
    tooltip: "Special teams touchdowns",
    group: "Defense",
    decimals: 1,
  },
  {
    key: "ff",
    header: "FF",
    tooltip: "Forced fumbles",
    group: "Defense",
    decimals: 1,
  },
  {
    key: "int",
    header: "INT",
    tooltip: "Interceptions",
    group: "Defense",
    decimals: 1,
  },
  {
    key: "pts_allow",
    header: "PT ALLOW",
    tooltip: "Points allowed",
    group: "Defense",
    decimals: 1,
  },
  {
    key: "sack",
    header: "SACK",
    tooltip: "Sacks",
    group: "Defense",
    decimals: 1,
  },
  {
    key: "tkl_loss",
    header: "TKL",
    tooltip: "Tackles for loss",
    group: "Defense",
    decimals: 1,
  },
  {
    key: "fum_rec",
    header: "FUM REC",
    tooltip: "Fumble recoveries",
    group: "Defense",
    decimals: 1,
  },
];

export function getStatColumns(position: PositionFilter): StatColumn[] {
  switch (position) {
    case "QB":
      return [...FANTASY_COLUMNS, ...RUSHING_COLUMNS, ...PASSING_COLUMNS];
    case "RB":
      return [...FANTASY_COLUMNS, ...RUSHING_COLUMNS, ...RECEIVING_COLUMNS];
    case "WR":
    case "TE":
      return [...FANTASY_COLUMNS, ...RECEIVING_COLUMNS, ...RUSHING_COLUMNS];
    case "K":
      return [...FANTASY_COLUMNS, ...KICKING_COLUMNS];
    case "DEF":
      return DEFENSE_COLUMNS;
    default:
      return [...FANTASY_COLUMNS, ...RUSHING_COLUMNS, ...PASSING_COLUMNS];
  }
}

export function formatStatValue(
  value: number | null | undefined,
  decimals = 1,
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(decimals);
}
