export type ProjectionAccentTone =
  | "success"
  | "muted"
  | "warning"
  | "destructive";

export type ProjectionHighlightStat = {
  key: string;
  label: string;
  value: number | null;
  decimals?: number;
  /** Tier for text + surface accent on the identity card tile. */
  accentTone?: ProjectionAccentTone;
};

type SeasonStatBlock = {
  fantasyPts: number | null;
  stats: Record<string, number | null>;
} | null;

export type ProjectionProfileInput = {
  primaryPositionId: string;
  positionRank: number | null;
  seasonProjection: SeasonStatBlock;
  seasonStats: SeasonStatBlock;
};

type Thresholds = {
  elite: number;
  solid: number;
  borderline: number;
};

const WEEKS_IN_SEASON = 17;

/**
 * Season-total (or rate) thresholds by position + stat key.
 * Higher is better for all keys listed here.
 */
const STAT_THRESHOLDS: Record<string, Partial<Record<string, Thresholds>>> = {
  QB: {
    pass_yd: { elite: 4200, solid: 3600, borderline: 3000 },
    pass_td: { elite: 32, solid: 24, borderline: 18 },
    pass_cmp: { elite: 380, solid: 340, borderline: 300 },
    rush_yd: { elite: 500, solid: 300, borderline: 150 },
    rush_td: { elite: 5, solid: 3, borderline: 1 },
  },
  RB: {
    rush_att: { elite: 280, solid: 200, borderline: 140 },
    rush_yd: { elite: 1200, solid: 900, borderline: 600 },
    rush_td: { elite: 12, solid: 8, borderline: 5 },
    rec: { elite: 60, solid: 40, borderline: 25 },
    rec_tgt: { elite: 80, solid: 55, borderline: 35 },
  },
  WR: {
    rec: { elite: 100, solid: 75, borderline: 55 },
    rec_yd: { elite: 1200, solid: 900, borderline: 650 },
    rec_td: { elite: 10, solid: 7, borderline: 4 },
    rec_tgt: { elite: 140, solid: 110, borderline: 80 },
    ypr: { elite: 14, solid: 12, borderline: 10 },
  },
  TE: {
    rec: { elite: 75, solid: 55, borderline: 40 },
    rec_yd: { elite: 900, solid: 650, borderline: 450 },
    rec_td: { elite: 8, solid: 5, borderline: 3 },
    rec_tgt: { elite: 100, solid: 75, borderline: 55 },
    ypr: { elite: 12, solid: 10, borderline: 8 },
  },
  K: {
    fgm: { elite: 30, solid: 24, borderline: 18 },
    fga: { elite: 35, solid: 28, borderline: 22 },
    xpm: { elite: 45, solid: 35, borderline: 28 },
    xpa: { elite: 48, solid: 38, borderline: 30 },
  },
  DEF: {
    sack: { elite: 45, solid: 35, borderline: 25 },
    int: { elite: 16, solid: 12, borderline: 8 },
    def_td: { elite: 4, solid: 2, borderline: 1 },
    ff: { elite: 16, solid: 12, borderline: 8 },
    tkl_solo: { elite: 70, solid: 55, borderline: 40 },
  },
};

function num(stats: Record<string, number | null>, key: string): number | null {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ypr(stats: Record<string, number | null>): number | null {
  const yards = num(stats, "rec_yd");
  const receptions = num(stats, "rec");
  if (yards == null || receptions == null || receptions <= 0) return null;
  return yards / receptions;
}

function weeklyPts(seasonPts: number | null): number | null {
  if (seasonPts == null || !Number.isFinite(seasonPts)) return null;
  return seasonPts / WEEKS_IN_SEASON;
}

function toneFromThresholds(
  value: number | null | undefined,
  thresholds: Thresholds | undefined,
): ProjectionAccentTone {
  if (value == null || !Number.isFinite(value) || !thresholds) {
    return "muted";
  }
  if (value >= thresholds.elite) return "success";
  if (value >= thresholds.solid) return "muted";
  if (value >= thresholds.borderline) return "warning";
  return "destructive";
}

function weeklyPtsThresholds(position: string): Thresholds {
  switch (position) {
    case "QB":
      return { elite: 20, solid: 16, borderline: 13 };
    case "RB":
      return { elite: 16, solid: 12, borderline: 8 };
    case "WR":
      return { elite: 15, solid: 11, borderline: 8 };
    case "TE":
      return { elite: 12, solid: 8, borderline: 5 };
    case "K":
    case "DEF":
      return { elite: 9, solid: 7, borderline: 5 };
    default:
      return { elite: 15, solid: 11, borderline: 8 };
  }
}

/**
 * Prefer position rank for weekly FPts; otherwise tier by weekly PPG.
 * Counting/rate stats use season thresholds for that position.
 */
export function getProjectionStatAccentTone(input: {
  key: string;
  value: number | null | undefined;
  position: string;
  positionRank?: number | null;
}): ProjectionAccentTone {
  if (input.key === "fpts_weekly") {
    return getWeeklyProjectionAccentTone({
      weeklyPts: input.value,
      position: input.position,
      positionRank: input.positionRank,
    });
  }

  const thresholds = STAT_THRESHOLDS[input.position]?.[input.key];
  return toneFromThresholds(input.value, thresholds);
}

/**
 * Prefer position rank when available; otherwise tier by weekly PPG.
 * Tiers match `getPositionRankColorClass`.
 */
export function getWeeklyProjectionAccentTone(input: {
  weeklyPts: number | null | undefined;
  position: string;
  positionRank?: number | null;
}): ProjectionAccentTone {
  const rank = input.positionRank;
  if (rank != null && rank > 0) {
    if (rank <= 8) return "success";
    if (rank <= 25) return "muted";
    if (rank <= 31) return "warning";
    return "destructive";
  }

  return toneFromThresholds(
    input.weeklyPts,
    weeklyPtsThresholds(input.position),
  );
}

function tile(
  key: string,
  label: string,
  value: number | null,
  position: string,
  options: {
    decimals?: number;
    positionRank?: number | null;
  } = {},
): ProjectionHighlightStat {
  return {
    key,
    label,
    value,
    decimals: options.decimals ?? 0,
    accentTone: getProjectionStatAccentTone({
      key,
      value,
      position,
      positionRank: options.positionRank,
    }),
  };
}

/** Compact projection tiles for the player identity card (position-aware). */
export function getProjectionHighlightStats(
  profile: ProjectionProfileInput,
): ProjectionHighlightStat[] {
  const block = profile.seasonProjection ?? profile.seasonStats;
  const stats = block?.stats ?? {};
  const seasonPts = block?.fantasyPts ?? null;
  const weekly = weeklyPts(seasonPts);
  const position = profile.primaryPositionId;
  const rank = profile.positionRank;

  const fptsTile = tile("fpts_weekly", "FPTS/WK", weekly, position, {
    decimals: 1,
    positionRank: rank,
  });

  if (position === "WR" || position === "TE") {
    return [
      tile("rec", "REC", num(stats, "rec"), position),
      tile("rec_yd", "REC YD", num(stats, "rec_yd"), position),
      tile("rec_td", "REC TD", num(stats, "rec_td"), position),
      tile("rec_tgt", "TGT", num(stats, "rec_tgt"), position),
      tile("ypr", "YPR", ypr(stats), position, { decimals: 1 }),
      fptsTile,
    ];
  }

  if (position === "RB") {
    return [
      tile("rush_att", "ATT", num(stats, "rush_att"), position),
      tile("rush_yd", "RUSH YD", num(stats, "rush_yd"), position),
      tile("rush_td", "RUSH TD", num(stats, "rush_td"), position),
      tile("rec", "REC", num(stats, "rec"), position),
      tile("rec_tgt", "TGT", num(stats, "rec_tgt"), position),
      fptsTile,
    ];
  }

  if (position === "QB") {
    return [
      tile("pass_yd", "PASS YD", num(stats, "pass_yd"), position),
      tile("pass_td", "PASS TD", num(stats, "pass_td"), position),
      tile("pass_cmp", "CMP", num(stats, "pass_cmp"), position),
      tile("rush_yd", "RUSH YD", num(stats, "rush_yd"), position),
      tile("rush_td", "RUSH TD", num(stats, "rush_td"), position),
      fptsTile,
    ];
  }

  if (position === "K") {
    return [
      tile("fgm", "FGM", num(stats, "fgm"), position),
      tile("fga", "FGA", num(stats, "fga"), position),
      tile("xpm", "XPM", num(stats, "xpm"), position),
      tile("xpa", "XPA", num(stats, "xpa"), position),
      fptsTile,
    ];
  }

  if (position === "DEF") {
    return [
      tile("sack", "SACK", num(stats, "sack"), position),
      tile("tkl_solo", "TKL", num(stats, "tkl_solo"), position),
      tile("int", "INT", num(stats, "int"), position),
      tile("ff", "FF", num(stats, "ff"), position),
      tile("def_td", "TD", num(stats, "def_td"), position),
      fptsTile,
    ];
  }

  return [fptsTile];
}

export function formatProjectionStat(
  value: number | null | undefined,
  decimals = 0,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (decimals <= 0 && Number.isInteger(value)) {
    return value.toLocaleString("en-US");
  }
  if (decimals <= 0) {
    return Math.round(value).toLocaleString("en-US");
  }
  return value.toFixed(decimals);
}

export function projectionAccentTextClass(
  tone: ProjectionAccentTone | undefined,
): string | undefined {
  if (!tone) return undefined;
  switch (tone) {
    case "success":
      return "text-success";
    case "warning":
      return "text-warning";
    case "destructive":
      return "text-destructive";
    case "muted":
      return "text-muted-foreground";
  }
}

export function projectionAccentSurfaceClass(
  tone: ProjectionAccentTone | undefined,
): string | undefined {
  if (!tone) return undefined;
  switch (tone) {
    case "success":
      return "bg-success/10 ring-success/25";
    case "warning":
      return "bg-warning/10 ring-warning/25";
    case "destructive":
      return "bg-destructive/10 ring-destructive/25";
    case "muted":
      return "bg-muted/40 ring-foreground/8";
  }
}
