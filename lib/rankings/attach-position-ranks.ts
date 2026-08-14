type PositionRankable = {
  id: string;
  primaryPositionId: string;
  fantasyPts: number | null;
  stats: Record<string, number | null>;
  positionRank: number | null;
};

export type HybridPositionRankRow = {
  id: string;
  fullName: string;
  primaryPositionId: string;
  actualPts: number | null;
  projectedPts: number | null;
  /** True when the player has a counting-week appearance (not DNP / placeholder). */
  appeared: boolean;
};

export function hasFantasyProduction(
  rows: { fantasyPts: number | null }[],
): boolean {
  return rows.some((row) => (row.fantasyPts ?? 0) !== 0);
}

function comparePtsThenName(
  aPts: number,
  aName: string,
  bPts: number,
  bName: string,
): number {
  const diff = bPts - aPts;
  if (diff !== 0) {
    return diff;
  }
  return aName.localeCompare(bName);
}

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
 * Stats RANK:
 * 1. Appeared with points > 0, by actuals
 * 2. Zeros — played 0s, then unplayed in projection order
 * 3. Appeared with points < 0, by actuals (negatives never rank above a 0)
 */
export function buildHybridPositionRankById(
  rows: HybridPositionRankRow[],
): Map<string, number> {
  const grouped = new Map<string, HybridPositionRankRow[]>();

  for (const row of rows) {
    const group = grouped.get(row.primaryPositionId) ?? [];
    group.push(row);
    grouped.set(row.primaryPositionId, group);
  }

  const rankByPlayerId = new Map<string, number>();

  for (const [, group] of grouped) {
    const positive: HybridPositionRankRow[] = [];
    const zeroPlayed: HybridPositionRankRow[] = [];
    const unplayed: HybridPositionRankRow[] = [];
    const negative: HybridPositionRankRow[] = [];

    for (const row of group) {
      if (!row.appeared) {
        unplayed.push(row);
        continue;
      }
      const pts = row.actualPts ?? 0;
      if (pts > 0) {
        positive.push(row);
      } else if (pts < 0) {
        negative.push(row);
      } else {
        zeroPlayed.push(row);
      }
    }

    positive.sort((a, b) =>
      comparePtsThenName(
        a.actualPts ?? 0,
        a.fullName,
        b.actualPts ?? 0,
        b.fullName,
      ),
    );
    zeroPlayed.sort((a, b) => a.fullName.localeCompare(b.fullName));
    unplayed.sort((a, b) =>
      comparePtsThenName(
        a.projectedPts ?? 0,
        a.fullName,
        b.projectedPts ?? 0,
        b.fullName,
      ),
    );
    negative.sort((a, b) =>
      comparePtsThenName(
        a.actualPts ?? 0,
        a.fullName,
        b.actualPts ?? 0,
        b.fullName,
      ),
    );

    [...positive, ...zeroPlayed, ...unplayed, ...negative].forEach(
      (row, index) => {
        rankByPlayerId.set(row.id, index + 1);
      },
    );
  }

  return rankByPlayerId;
}

/**
 * RANK follows `fantasyRankByPlayerId` when provided (shared Projection/Stats
 * source). Otherwise ranks the loaded rows by fantasy points.
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
