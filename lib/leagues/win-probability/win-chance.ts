import { summarizeLineup } from "@/lib/leagues/win-probability/expected-points";
import type { GameProgress } from "@/lib/leagues/win-probability/game-progress";
import type { WinProbPlayer } from "@/lib/leagues/win-probability/expected-points";

/**
 * Standard normal CDF (Abramowitz & Stegun 26.2.17 approximation).
 */
export function normalCdf(x: number): number {
  if (!Number.isFinite(x)) {
    return x > 0 ? 1 : 0;
  }
  const abs = Math.abs(x);
  const t = 1 / (1 + 0.2316419 * abs);
  const d = Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
  const p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

export type MatchupWinChance = {
  /** Probability the focus team beats the opponent (0–1). */
  winProbability: number;
  focusMean: number;
  opponentMean: number;
};

/**
 * P(focus > opponent) assuming independent Normal lineup totals.
 * Ties are split 50/50 into the continuous CDF (P(diff > 0)).
 */
export function matchupWinChance(input: {
  focusStarters: WinProbPlayer[];
  opponentStarters: WinProbPlayer[];
  progressByNflTeam: Map<string, GameProgress>;
}): MatchupWinChance {
  const focus = summarizeLineup(
    input.focusStarters,
    input.progressByNflTeam,
  );
  const opponent = summarizeLineup(
    input.opponentStarters,
    input.progressByNflTeam,
  );

  const margin = focus.mean - opponent.mean;
  const variance = focus.variance + opponent.variance;

  if (variance <= 1e-9) {
    if (margin > 0.05) {
      return {
        winProbability: 1,
        focusMean: focus.mean,
        opponentMean: opponent.mean,
      };
    }
    if (margin < -0.05) {
      return {
        winProbability: 0,
        focusMean: focus.mean,
        opponentMean: opponent.mean,
      };
    }
    return {
      winProbability: 0.5,
      focusMean: focus.mean,
      opponentMean: opponent.mean,
    };
  }

  const z = margin / Math.sqrt(variance);
  return {
    winProbability: normalCdf(z),
    focusMean: focus.mean,
    opponentMean: opponent.mean,
  };
}

export function formatWinChancePct(probability: number | null | undefined) {
  if (probability == null || !Number.isFinite(probability)) {
    return "—";
  }
  return `${Math.round(probability * 100)}%`;
}
