type PositionRankable = {
  id: string;
  primaryPositionId: string;
  fantasyPts: number | null;
  stats: Record<string, number | null>;
  positionRank: number | null;
};

export function buildFantasyPositionRankById(
  rows: Pick<PositionRankable, "id" | "primaryPositionId" | "fantasyPts">[],
): Map<string, number> {
  const grouped = new Map<
    string,
    Pick<PositionRankable, "id" | "primaryPositionId" | "fantasyPts">[]
  >();

  for (const row of rows) {
    const group = grouped.get(row.primaryPositionId) ?? [];
    group.push(row);
    grouped.set(row.primaryPositionId, group);
  }

  const rankByPlayerId = new Map<string, number>();

  for (const [, group] of grouped) {
    const sorted = [...group].sort(
      (a, b) => (b.fantasyPts ?? 0) - (a.fantasyPts ?? 0),
    );

    sorted.forEach((row, index) => {
      rankByPlayerId.set(row.id, index + 1);
    });
  }

  return rankByPlayerId;
}

/**
 * Prefer provider position ranks when present; otherwise fantasy-pts ranks.
 * Pass `fantasyRankByPlayerId` from the full league pool when `rows` is a
 * filtered subset (e.g. one roster) so ranks stay league-wide.
 */
export function attachPositionRanks<T extends PositionRankable>(
  rows: T[],
  fantasyRankByPlayerId?: Map<string, number>,
): T[] {
  const fallbackRanks =
    fantasyRankByPlayerId ?? buildFantasyPositionRankById(rows);

  return rows.map((row) => {
    const sleeperRank =
      row.stats.pos_rank_ppr ??
      row.stats.pos_rank_std ??
      row.stats.pos_adp_dd_ppr ??
      row.stats.pos_rank_half_ppr;

    const positionRank =
      sleeperRank && sleeperRank > 0 && sleeperRank < 999
        ? Math.round(sleeperRank)
        : (fallbackRanks.get(row.id) ?? null);

    return { ...row, positionRank };
  });
}
