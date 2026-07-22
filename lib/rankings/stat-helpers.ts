export function getFantasyPts(row: {
  fantasyPts: number | null;
}): number | null {
  return row.fantasyPts;
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
    stats.adp_std;

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

export function getPositionRankColorClass(
  rank: number | null | undefined,
): string {
  if (!rank) {
    return "text-muted-foreground";
  }

  if (rank <= 8) {
    return "text-success";
  }

  if (rank <= 25) {
    return "text-muted-foreground";
  }

  if (rank <= 31) {
    return "text-warning";
  }

  return "text-destructive";
}
