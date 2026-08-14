export type PositionFilter =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "K"
  | "DEF"
  | "CB"
  | "S"
  | "DT"
  | "DE"
  | "LB";

export const POSITION_FILTERS: PositionFilter[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
  "CB",
  "S",
  "DT",
  "DE",
  "LB",
];

export const DEFAULT_POSITION_FILTER: PositionFilter = "QB";

const POSITION_FILTER_SET = new Set<string>(POSITION_FILTERS);

/**
 * Position filter options present on the league roster (display order).
 * Falls back to the full list when roster slots are empty/unset.
 */
export function positionFiltersFromRosterSlots(
  rosterSlots: Array<{ positionId: string }>,
): PositionFilter[] {
  const present = new Set<PositionFilter>();
  for (const slot of rosterSlots) {
    if (POSITION_FILTER_SET.has(slot.positionId)) {
      present.add(slot.positionId as PositionFilter);
    }
  }
  const filtered = POSITION_FILTERS.filter((position) => present.has(position));
  return filtered.length > 0 ? filtered : POSITION_FILTERS;
}

export function parsePositionFilter(
  value: string | null | undefined,
  allowed: readonly PositionFilter[] = POSITION_FILTERS,
): PositionFilter {
  const options = allowed.length > 0 ? allowed : POSITION_FILTERS;
  if (value && options.includes(value as PositionFilter)) {
    return value as PositionFilter;
  }

  return options[0] ?? DEFAULT_POSITION_FILTER;
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

function statColumn(
  key: string,
  header: string,
  tooltip: string,
  group: string,
  decimals = 1,
): StatColumn {
  return { key, header, tooltip, group, decimals };
}

const RUSHING_COLUMNS: StatColumn[] = [
  statColumn("rush_att", "ATT", "Rushing attempts", "Rushing"),
  statColumn("rush_yd", "YD", "Rushing yards", "Rushing"),
  statColumn("rush_td", "TD", "Rushing touchdowns", "Rushing"),
];

const RECEIVING_COLUMNS: StatColumn[] = [
  statColumn("rec", "REC", "Receptions", "Receiving"),
  statColumn("rec_tgt", "TAR", "Targets", "Receiving"),
  statColumn("rec_yd", "YD", "Receiving yards", "Receiving"),
  statColumn("rec_td", "TD", "Receiving touchdowns", "Receiving"),
];

const PASSING_COLUMNS: StatColumn[] = [
  statColumn("pass_att", "ATT", "Pass attempts", "Passing"),
  statColumn("pass_cmp", "CMP", "Completions", "Passing"),
  statColumn("pass_yd", "YD", "Passing yards", "Passing"),
  statColumn("pass_td", "TD", "Passing touchdowns", "Passing"),
  statColumn("pass_int", "INT", "Interceptions thrown", "Passing"),
];

const FUMBLE_COLUMNS: StatColumn[] = [
  statColumn("fum", "FUM", "Fumbles lost", "Fumbles"),
];

/** Sleeper projections publish 40–49 and 50+; totals are derived. */
const KICKING_COLUMNS: StatColumn[] = [
  statColumn("fga", "FGA", "Field goal attempts", "Kicking"),
  statColumn("fgm", "FGM", "Field goals made", "Kicking"),
  statColumn("fgm_40_49", "40-49", "Field goals made from 40–49 yards", "Kicking"),
  statColumn("fgm_50p", "50+", "Field goals made from 50+ yards", "Kicking"),
  statColumn("xpa", "XPA", "Extra point attempts", "Kicking"),
  statColumn("xpm", "XPM", "Extra points made", "Kicking"),
];

const DEFENSE_COLUMNS: StatColumn[] = [
  ...FANTASY_COLUMNS,
  statColumn("sack", "SACK", "Sacks", "Defense"),
  statColumn("tkl_loss", "TFL", "Tackles for loss", "Defense"),
  statColumn("int", "INT", "Interceptions", "Defense"),
  statColumn("ff", "FF", "Forced fumbles", "Defense"),
  statColumn("fum_rec", "FR", "Fumble recoveries", "Defense"),
  statColumn("def_td", "DEF TD", "Defensive touchdowns", "Defense"),
  statColumn("st_td", "ST TD", "Special teams touchdowns", "Defense"),
  statColumn("def_kr_td", "KR TD", "Kick return touchdowns", "Defense"),
  statColumn("pts_allow", "PA", "Points allowed", "Defense"),
];

const IDP_DB_COLUMNS: StatColumn[] = [
  ...FANTASY_COLUMNS,
  statColumn("int", "INT", "Interceptions", "Defense"),
  statColumn("tkl", "TKL", "Total tackles (solo + assisted)", "Defense"),
  statColumn("tkl_solo", "SOLO", "Solo tackles", "Defense"),
  statColumn("tkl_ast", "AST", "Assisted tackles", "Defense"),
  statColumn("tkl_loss", "TFL", "Tackles for loss", "Defense"),
  statColumn("sack", "SACK", "Sacks", "Defense"),
  statColumn("ff", "FF", "Forced fumbles", "Defense"),
  statColumn("fum_rec", "FR", "Fumble recoveries", "Defense"),
  statColumn("def_td", "TD", "Defensive touchdowns", "Defense"),
];

const IDP_FRONT_COLUMNS: StatColumn[] = [
  ...FANTASY_COLUMNS,
  statColumn("tkl", "TKL", "Total tackles (solo + assisted)", "Defense"),
  statColumn("tkl_solo", "SOLO", "Solo tackles", "Defense"),
  statColumn("tkl_ast", "AST", "Assisted tackles", "Defense"),
  statColumn("tkl_loss", "TFL", "Tackles for loss", "Defense"),
  statColumn("sack", "SACK", "Sacks", "Defense"),
  statColumn("ff", "FF", "Forced fumbles", "Defense"),
  statColumn("fum_rec", "FR", "Fumble recoveries", "Defense"),
  statColumn("def_td", "TD", "Defensive touchdowns", "Defense"),
  statColumn("int", "INT", "Interceptions", "Defense"),
];

export function getStatColumns(position: PositionFilter): StatColumn[] {
  switch (position) {
    case "QB":
      return [...FANTASY_COLUMNS, ...PASSING_COLUMNS, ...RUSHING_COLUMNS];
    case "RB":
      return [
        ...FANTASY_COLUMNS,
        ...RUSHING_COLUMNS,
        ...FUMBLE_COLUMNS,
        ...RECEIVING_COLUMNS,
      ];
    case "WR":
    case "TE":
      return [...FANTASY_COLUMNS, ...RECEIVING_COLUMNS, ...RUSHING_COLUMNS];
    case "K":
      return [...FANTASY_COLUMNS, ...KICKING_COLUMNS];
    case "DEF":
      return DEFENSE_COLUMNS;
    case "CB":
    case "S":
      return IDP_DB_COLUMNS;
    case "DT":
    case "DE":
    case "LB":
      return IDP_FRONT_COLUMNS;
    default:
      return [...FANTASY_COLUMNS, ...PASSING_COLUMNS, ...RUSHING_COLUMNS];
  }
}

export function formatStatValue(
  value: number | null | undefined,
  decimals = 1,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(decimals);
}
