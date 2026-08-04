/**
 * Player SoS: defenses ranked by FPts allowed to a position / game,
 * then bucketed by percentile (~25% Easy / ~50% Average / ~25% Hard).
 *
 * Early-season rates may blend prior + current season (see sosBlendWeights).
 * Bye weeks are never part of the sample.
 */

export type SosMatchupBucketId = "easy" | "mid" | "hard";

export type SosBlendWeights = {
  prior: number;
  current: number;
};

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
 * Rank 1 = hardest matchup (fewest pts allowed).
 * ~top 25% Hard, ~bottom 25% Easy, middle Average.
 */
export function difficultyFromSosRank(
  rank: number | null | undefined,
  teamCount = 32,
): SosMatchupBucketId | null {
  if (rank == null || !Number.isFinite(rank) || rank < 1 || teamCount < 1) {
    return null;
  }
  const hardCount = Math.max(1, Math.round(teamCount * 0.25));
  const easyCount = Math.max(1, Math.round(teamCount * 0.25));
  const easyStart = teamCount - easyCount + 1;
  if (rank <= hardCount) return "hard";
  if (rank >= easyStart) return "easy";
  return "mid";
}
