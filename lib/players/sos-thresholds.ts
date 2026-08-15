/**
 * Player SoS: opponents ranked by FPts allowed to this position / game,
 * then bucketed by percentile (~25% Easy / ~50% Average / ~25% Hard).
 *
 * Rank 1 = easiest matchup (most FPts allowed), rank 32 = hardest.
 * Same for skill, K, and team DEF.
 *
 * Buckets by rank (32-team slate): 1–8 Easy · 9–23 Average · 24–32 Hard.
 *
 * Early-season rates may blend prior + current season (see sosBlendWeights).
 * Bye weeks are never part of the sample.
 */

export type SosMatchupBucketId = "easy" | "mid" | "hard";

export type SosBlendWeights = {
  prior: number;
  current: number;
};

/** Higher FPts allowed = easier matchup (#1) for every position. */
export function sosHigherRateIsEasier(positionId: string): boolean {
  void positionId;
  return true;
}

/**
 * Rank 1 = easiest matchup.
 * On a 32-team slate: 1–8 Easy · 9–23 Average · 24–32 Hard.
 */
export function difficultyFromSosRank(
  rank: number | null | undefined,
  teamCount = 32,
): SosMatchupBucketId | null {
  if (rank == null || !Number.isFinite(rank) || rank < 1 || teamCount < 1) {
    return null;
  }
  const easyMax = Math.max(1, Math.round((teamCount * 8) / 32));
  const hardStart = Math.max(easyMax + 1, Math.round((teamCount * 24) / 32));
  if (rank <= easyMax) return "easy";
  if (rank >= hardStart) return "hard";
  return "mid";
}

/** Team DEF SoS uses the same #1 = easiest bands as skill/K. */
export function difficultyFromDefOffenseRank(
  rank: number | null | undefined,
  teamCount = 32,
): SosMatchupBucketId | null {
  return difficultyFromSosRank(rank, teamCount);
}

/** Kicker SoS: 1 = most generous defense. Same bands as skill/DEF. */
export function difficultyFromKickerDefenseRank(
  rank: number | null | undefined,
  teamCount = 32,
): SosMatchupBucketId | null {
  return difficultyFromSosRank(rank, teamCount);
}

/** Resolve Easy/Mid/Hard for a position from SoS rank. */
export function difficultyFromPositionSosRank(
  positionId: string,
  rank: number | null | undefined,
  teamCount = 32,
): SosMatchupBucketId | null {
  void positionId;
  return difficultyFromSosRank(rank, teamCount);
}

export type SosScheduleSummary = {
  id: SosMatchupBucketId;
  /** Large headline, e.g. "Typically average". */
  headline: string;
  /** Trailing muted label, e.g. "schedule". */
  label: string;
};

/**
 * Overall slate read from mean matchup rank.
 * Low rank = easier (#1 = best matchup) for every position.
 */
export function summarizeSosSchedule(
  averageMatchupRank: number | null | undefined,
  positionId: string,
  teamCount = 32,
): SosScheduleSummary | null {
  void positionId;
  if (
    averageMatchupRank == null ||
    !Number.isFinite(averageMatchupRank) ||
    teamCount < 1
  ) {
    return null;
  }
  const id = difficultyFromSosRank(averageMatchupRank, teamCount);
  if (!id) {
    return null;
  }

  const adjective =
    id === "easy" ? "easy" : id === "hard" ? "difficult" : "average";
  return {
    id,
    headline: `Typically ${adjective}`,
    label: "schedule",
  };
}

/** Legend unit next to bucket rates. */
export function sosRateUnitLabel(positionId: string): string {
  void positionId;
  return "allowed/G";
}

/**
 * How many opposing scorers define the fantasy environment for a position.
 * Top-1 (best scorer) keeps allowed/G near starter FPTS/G for every position.
 */
export function sosTopNForPosition(positionId: string): number {
  void positionId;
  return 1;
}

/**
 * Mean of the top-N fantasy scores from one offense vs a defense in a week.
 * Empty input → null.
 */
export function sosWeeklyAllowedRate(
  scores: number[],
  topN: number,
): number | null {
  const valid = scores
    .filter((n) => typeof n === "number" && Number.isFinite(n))
    .toSorted((a, b) => b - a);
  if (valid.length === 0) return null;
  const take = valid.slice(0, Math.max(1, Math.trunc(topN)));
  return take.reduce((sum, n) => sum + n, 0) / take.length;
}

/**
 * Blend prior-season vs YTD rates by how many weeks have scored.
 * 0 = preseason (prior only); 1–4 = blend; 5+ = current only.
 */
export function sosBlendWeights(scoredThroughWeek: number): SosBlendWeights {
  if (!Number.isFinite(scoredThroughWeek) || scoredThroughWeek <= 0) {
    return { prior: 1, current: 0 };
  }
  if (scoredThroughWeek >= 5) {
    return { prior: 0, current: 1 };
  }
  const table: Record<number, SosBlendWeights> = {
    1: { prior: 3, current: 1 },
    2: { prior: 2, current: 2 },
    3: { prior: 1, current: 3 },
    4: { prior: 0.5, current: 3.5 },
  };
  return table[scoredThroughWeek]!;
}

/** Weighted average of prior + current season rates for one defense. */
export function blendSosRate(
  priorAvg: number | null | undefined,
  currentAvg: number | null | undefined,
  weights: SosBlendWeights,
): number | null {
  const hasPrior = priorAvg != null && Number.isFinite(priorAvg);
  const hasCurrent = currentAvg != null && Number.isFinite(currentAvg);

  if (weights.current <= 0) {
    return hasPrior ? priorAvg! : hasCurrent ? currentAvg! : null;
  }
  if (weights.prior <= 0) {
    return hasCurrent ? currentAvg! : hasPrior ? priorAvg! : null;
  }
  if (hasPrior && hasCurrent) {
    return (
      (weights.prior * priorAvg! + weights.current * currentAvg!) /
      (weights.prior + weights.current)
    );
  }
  if (hasCurrent) return currentAvg!;
  if (hasPrior) return priorAvg!;
  return null;
}

/**
 * Rank 1 = easiest matchup (highest FPts allowed first).
 */
export function rankTeamsBySosRate(
  avgByTeam: Map<string, number>,
  higherIsEasier: boolean,
): {
  rankByTeam: Map<string, number>;
  avgByTeam: Map<string, number>;
} {
  const rows = [...avgByTeam.entries()]
    .map(([team, avg]) => ({ team, avg }))
    .filter((row) => Number.isFinite(row.avg))
    .toSorted((a, b) => {
      const byRate = higherIsEasier ? b.avg - a.avg : a.avg - b.avg;
      return byRate || a.team.localeCompare(b.team);
    });

  const rankByTeam = new Map<string, number>();
  const rankedAvg = new Map<string, number>();
  rows.forEach((row, index) => {
    rankByTeam.set(row.team, index + 1);
    rankedAvg.set(row.team, row.avg);
  });
  return { rankByTeam, avgByTeam: rankedAvg };
}
