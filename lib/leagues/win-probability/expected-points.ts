import type { GameProgress } from "@/lib/leagues/win-probability/game-progress";

/**
 * Rough weekly fantasy-point σ by position (pre-game). Residual σ scales with
 * remaining game fraction. Recalibrate when live scoring history exists.
 *
 * TODO(live-win-prob): Fit these from completed weeks once live data exists.
 */
const POSITION_SIGMA: Record<string, number> = {
  QB: 7,
  RB: 6,
  WR: 6,
  TE: 5,
  FLEX: 6,
  K: 3.5,
  DEF: 4,
};

const DEFAULT_SIGMA = 6;

export type WinProbPlayer = {
  id: string;
  primaryPositionId: string;
  nflTeam: string | null;
  projectedPts: number | null;
  actualPts: number | null;
};

/**
 * Expected final fantasy points for one starter.
 * Pre → projection; live → actual + projection×timeLeft; post → actual.
 */
export function expectedPlayerPoints(
  player: WinProbPlayer,
  progress: GameProgress | null,
): { mean: number; variance: number } {
  const projection = Math.max(0, player.projectedPts ?? 0);
  const actual = Math.max(0, player.actualPts ?? 0);
  const sigma =
    POSITION_SIGMA[player.primaryPositionId.toUpperCase()] ?? DEFAULT_SIGMA;

  if (!progress || progress.status === "pre") {
    return { mean: projection, variance: sigma * sigma };
  }

  if (progress.status === "post" || progress.fractionPlayed >= 1) {
    return { mean: actual, variance: 0 };
  }

  const remainingFrac = 1 - progress.fractionPlayed;
  const remaining = projection * remainingFrac;
  const residualSigma = sigma * remainingFrac;
  return {
    mean: actual + remaining,
    variance: residualSigma * residualSigma,
  };
}

export function summarizeLineup(
  players: WinProbPlayer[],
  progressByNflTeam: Map<string, GameProgress>,
): { mean: number; variance: number } {
  let mean = 0;
  let variance = 0;

  for (const player of players) {
    const team = player.nflTeam?.trim().toUpperCase() ?? "";
    const progress = team ? (progressByNflTeam.get(team) ?? null) : null;
    const expected = expectedPlayerPoints(player, progress);
    mean += expected.mean;
    variance += expected.variance;
  }

  return { mean, variance };
}
