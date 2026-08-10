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
 * RANK always follows fantasy points for the loaded season/kind (league scoring),
 * not Sleeper `pos_rank_*`. Pass `fantasyRankByPlayerId` when `rows` is a subset
 * so ranks stay pool-wide (e.g. projection ranks for empty preseason stats).
 */
export function attachPositionRanks<T extends PositionRankable>(
  rows: T[],
  fantasyRankByPlayerId?: Map<string, number>,
): T[] {
  const ranks =
    fantasyRankByPlayerId ?? buildFantasyPositionRankById(rows);

  return rows.map((row) => ({
    ...row,
    positionRank: ranks.get(row.id) ?? null,
  }));
}
