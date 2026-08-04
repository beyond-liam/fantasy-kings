/**
 * Team QB1 for Overview "Without X".
 *
 * Identity is season-scoped: QBs who shared the viewed player's offense that
 * season (matched via weekly `tm_off_snp`), not whoever is currently tagged
 * with the same `players.nfl_team` (Sleeper team tags drift / are wrong).
 */

export const WITHOUT_QB1_POSITIONS = ["RB", "WR", "TE", "K"] as const;

export type WithoutQb1Position =
  (typeof WITHOUT_QB1_POSITIONS)[number];

export function isWithoutQb1Position(
  positionId: string,
): positionId is WithoutQb1Position {
  return (WITHOUT_QB1_POSITIONS as readonly string[]).includes(positionId);
}

export type TeamQbCandidate = {
  playerId: string;
  fullName: string;
  depthChartOrder: number | null;
  /** Weeks this QB threw while on the viewed player's offense. */
  playedWeeks: number[];
  /** Pass attempts across those matched weeks. */
  passAtt: number;
};

export type TeamQb1Selection = {
  playerId: string;
  fullName: string;
  lastName: string;
  /** Weeks the QB1 participated on this offense. */
  playedWeeks: number[];
  source: "depth_chart" | "pass_att";
};

export type QbWeekStatRow = {
  playerId: string;
  fullName: string;
  depthChartOrder: number | null;
  week: number;
  stats: Record<string, number | null> | null | undefined;
};

/** True when a weekly QB stat bag looks like they played. */
export function qbPlayedFromStats(
  stats: Record<string, number | null> | null | undefined,
): boolean {
  if (!stats) return false;
  const passAtt = stats.pass_att;
  if (typeof passAtt === "number" && Number.isFinite(passAtt) && passAtt > 0) {
    return true;
  }
  return false;
}

export function tmOffSnap(
  stats: Record<string, number | null> | null | undefined,
): number | null {
  const value = stats?.tm_off_snp;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function qbLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || fullName;
}

/**
 * Build QB candidates from weeks where a passer shared the offense's
 * `tm_off_snp` with the viewed player (or a teammate proxy).
 */
export function buildTeammateQbCandidates(input: {
  /** week → team offensive snap count for the viewed player's offense. */
  offenseSnapByWeek: Map<number, number>;
  qbWeeks: QbWeekStatRow[];
}): TeamQbCandidate[] {
  const byId = new Map<string, TeamQbCandidate>();

  for (const row of input.qbWeeks) {
    if (row.week < 1 || row.week > 18) continue;
    const snap = input.offenseSnapByWeek.get(row.week);
    if (snap == null) continue;
    const stats = row.stats;
    if (!qbPlayedFromStats(stats)) continue;
    if (tmOffSnap(stats) !== snap) continue;

    const passAtt = stats?.pass_att;
    const att =
      typeof passAtt === "number" && Number.isFinite(passAtt) ? passAtt : 0;

    const existing = byId.get(row.playerId);
    if (existing) {
      if (!existing.playedWeeks.includes(row.week)) {
        existing.playedWeeks.push(row.week);
      }
      existing.passAtt += att;
      continue;
    }

    byId.set(row.playerId, {
      playerId: row.playerId,
      fullName: row.fullName,
      depthChartOrder: row.depthChartOrder,
      playedWeeks: [row.week],
      passAtt: att,
    });
  }

  return [...byId.values()].map((c) => ({
    ...c,
    playedWeeks: c.playedWeeks.toSorted((a, b) => a - b),
  }));
}

/**
 * Pick team QB1 for the viewed season.
 * Live season: prefer depth_chart_order === 1 among teammate-matched QBs.
 * Otherwise: most pass attempts on that offense (then most weeks).
 */
export function selectTeamQb1(
  candidates: TeamQbCandidate[],
  options?: { preferDepthChart?: boolean },
): TeamQb1Selection | null {
  const withPlay = candidates.filter((c) => c.playedWeeks.length > 0);
  const pool = withPlay.length > 0 ? withPlay : candidates;
  if (pool.length === 0) return null;

  const preferDepth = options?.preferDepthChart === true;

  const byVolume = (a: TeamQbCandidate, b: TeamQbCandidate) =>
    b.passAtt - a.passAtt ||
    b.playedWeeks.length - a.playedWeeks.length ||
    a.fullName.localeCompare(b.fullName);

  if (preferDepth) {
    const starters = pool.filter((c) => c.depthChartOrder === 1);
    if (starters.length === 1) {
      const qb = starters[0]!;
      return {
        playerId: qb.playerId,
        fullName: qb.fullName,
        lastName: qbLastName(qb.fullName),
        playedWeeks: qb.playedWeeks.toSorted((a, b) => a - b),
        source: "depth_chart",
      };
    }
    if (starters.length > 1) {
      const qb = starters.toSorted(byVolume)[0]!;
      return {
        playerId: qb.playerId,
        fullName: qb.fullName,
        lastName: qbLastName(qb.fullName),
        playedWeeks: qb.playedWeeks.toSorted((a, b) => a - b),
        source: "depth_chart",
      };
    }

    const withOrder = pool
      .filter((c) => c.depthChartOrder != null)
      .toSorted(
        (a, b) =>
          (a.depthChartOrder ?? 99) - (b.depthChartOrder ?? 99) ||
          byVolume(a, b),
      );
    if (withOrder[0] && withOrder[0].depthChartOrder != null) {
      const qb = withOrder[0];
      return {
        playerId: qb.playerId,
        fullName: qb.fullName,
        lastName: qbLastName(qb.fullName),
        playedWeeks: qb.playedWeeks.toSorted((a, b) => a - b),
        source: "depth_chart",
      };
    }
  }

  const qb = pool.toSorted(byVolume)[0]!;
  return {
    playerId: qb.playerId,
    fullName: qb.fullName,
    lastName: qbLastName(qb.fullName),
    playedWeeks: qb.playedWeeks.toSorted((a, b) => a - b),
    source: "pass_att",
  };
}

/** Weeks the viewed player scored without the team QB1. */
export function withoutQb1ScoredWeeks(
  playerScoredWeeks: number[],
  qbPlayedWeeks: number[],
): number[] {
  const qbSet = new Set(qbPlayedWeeks);
  return playerScoredWeeks
    .filter((w) => !qbSet.has(w))
    .toSorted((a, b) => a - b);
}

/** Build week → tm_off_snp from a player's weekly bags. */
export function offenseSnapByWeekFromLogs(
  rows: Array<{
    week: number;
    stats?: Record<string, number | null> | null;
  }>,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const row of rows) {
    if (row.week < 1 || row.week > 18) continue;
    const snap = tmOffSnap(row.stats);
    if (snap == null) continue;
    out.set(row.week, snap);
  }
  return out;
}

/** Sum weekly stat bags (skip non-counting rank-like keys that shouldn't accumulate). */
export function sumWeeklyStatBags(
  bags: Array<Record<string, number | null> | undefined>,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const bag of bags) {
    if (!bag) continue;
    for (const [key, value] of Object.entries(bag)) {
      if (value == null || !Number.isFinite(value)) continue;
      if (
        key.startsWith("pos_rank") ||
        key.startsWith("pos_adp") ||
        key === "rank" ||
        key.includes("adp")
      ) {
        continue;
      }
      out[key] = (out[key] ?? 0) + value;
    }
  }
  return out;
}
