export function getFantasyPts(row: {
  fantasyPts: number | null;
}): number | null {
  return row.fantasyPts;
}

/**
 * Numeric sort key for table cells. Missing values (shown as —) sort as 0
 * so they don't float to the top on descending sorts.
 */
export function sortableStatValue(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }
  return value;
}

/**
 * Sort key for position ranks. Lower is better (S1 first); missing (—) sorts
 * last as the worst rank.
 */
export function sortableRankValue(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return value;
}

/** Ascending compare; null/NaN treated as 0. */
export function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  return sortableStatValue(a) - sortableStatValue(b);
}

export function getPtsPpr(row: {
  stats: Record<string, number | null>;
  ptsPpr: number | null;
}): number | null {
  const raw = row.stats.pts_ppr ?? row.ptsPpr;
  if (raw == null) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function getAdp(stats: Record<string, number | null>): number | null {
  const value =
    stats.adp_ppr ??
    stats.adp_dd_ppr ??
    stats.adp_half_ppr ??
    stats.adp_std ??
    stats.adp_idp ??
    stats.adp_idp_1qb;

  if (value === null || value === undefined || value >= 999) {
    return null;
  }

  return value;
}

export function getSleeperPositionRank(
  stats: Record<string, number | null>,
): number | null {
  const value =
    stats.pos_rank_ppr ??
    stats.pos_rank_std ??
    stats.pos_adp_dd_ppr ??
    stats.pos_rank_half_ppr;

  if (value === null || value === undefined || value <= 0) {
    return null;
  }

  return Math.round(value);
}

export function formatPositionRank(
  position: string,
  rank: number | null | undefined,
): string {
  if (!rank) {
    return "—";
  }

  return `${position}${rank}`;
}

/** Shared bands for position rank coloring (season rank + weekly finish). */
export type PositionRankTone =
  | "success"
  | "muted"
  | "warning"
  | "destructive";

export function getPositionRankTone(
  rank: number | null | undefined,
): PositionRankTone | null {
  if (!rank) {
    return null;
  }

  if (rank <= 8) {
    return "success";
  }

  if (rank <= 25) {
    return "muted";
  }

  if (rank <= 31) {
    return "warning";
  }

  return "destructive";
}

export function getPositionRankColorClass(
  rank: number | null | undefined,
): string {
  const tone = getPositionRankTone(rank);
  if (!tone) {
    return "text-muted-foreground";
  }

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

/** Badge variant mapped from player-rank tones (muted → secondary). */
export function getPositionRankBadgeVariant(
  rank: number | null | undefined,
): "success" | "secondary" | "warning" | "destructive" | null {
  const tone = getPositionRankTone(rank);
  if (!tone) {
    return null;
  }

  if (tone === "muted") {
    return "secondary";
  }

  return tone;
}
