/**
 * Win-probability calibration priors.
 *
 * Pre-game position σ (fantasy pts / week) from published half-PPR weekly
 * variance for starters (Underdog Network positional SDs ≈ CV × PPG):
 *   QB ~0.36×20.6 ≈ 7.4 | RB ~0.54×14.1 ≈ 7.6 | WR ~0.58×12.4 ≈ 7.2 | TE ~0.63×10.1 ≈ 6.4
 *
 * Tuned slightly for full-PPR lineups and our Normal-margin model. Re-fit from
 * `player_scores` projection vs stats residuals via `rmseByPosition` when enough
 * completed weeks are in DB; mid-game σ still depends on near-live actuals
 * (Sleeper sync today; ESPN player box scores later).
 */

export const POSITION_SIGMA: Record<string, number> = {
  QB: 7.5,
  RB: 7.5,
  WR: 7,
  TE: 6.5,
  FLEX: 7,
  K: 3.5,
  DEF: 5,
  CB: 5,
  S: 5,
  DT: 4.5,
  DE: 5.5,
  LB: 5.5,
};

export const DEFAULT_SIGMA = 6.5;

/** Keep at least this fraction of pre-game σ while the game is live. */
export const LIVE_SIGMA_FLOOR_FRAC = 0.4;

/** How quickly pace overtakes projection as the game progresses (0–1). */
export const PACE_BLEND_MAX = 0.65;
export const PACE_BLEND_START_FRAC = 0.15;

/**
 * After this fraction of regulation with still-zero actuals, treat remaining
 * projection as a soft DNP (player likely inactive / not involved).
 */
export const SOFT_DNP_FRACTION = 0.35;

export function positionSigma(primaryPositionId: string): number {
  return (
    POSITION_SIGMA[primaryPositionId.trim().toUpperCase()] ?? DEFAULT_SIGMA
  );
}

export type ResidualSample = {
  primaryPositionId: string;
  projectedPts: number;
  actualPts: number;
};

/**
 * Root-mean-square residual (actual − projection) by position.
 * Use offline / scripts against completed `player_scores` weeks to refresh
 * POSITION_SIGMA — not wired into the hot path yet.
 */
export function rmseByPosition(
  samples: ResidualSample[],
): Record<string, { n: number; rmse: number }> {
  const buckets = new Map<string, { sumSq: number; n: number }>();

  for (const sample of samples) {
    if (
      !Number.isFinite(sample.projectedPts) ||
      !Number.isFinite(sample.actualPts)
    ) {
      continue;
    }
    const key = sample.primaryPositionId.trim().toUpperCase() || "UNK";
    const err = sample.actualPts - sample.projectedPts;
    const bucket = buckets.get(key) ?? { sumSq: 0, n: 0 };
    bucket.sumSq += err * err;
    bucket.n += 1;
    buckets.set(key, bucket);
  }

  const out: Record<string, { n: number; rmse: number }> = {};
  for (const [key, bucket] of buckets) {
    out[key] = {
      n: bucket.n,
      rmse: bucket.n > 0 ? Math.sqrt(bucket.sumSq / bucket.n) : 0,
    };
  }
  return out;
}
