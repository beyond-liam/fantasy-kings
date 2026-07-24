import type { GameProgress } from "@/lib/leagues/win-probability/game-progress";
import {
  LIVE_SIGMA_FLOOR_FRAC,
  PACE_BLEND_MAX,
  PACE_BLEND_START_FRAC,
  SOFT_DNP_FRACTION,
  positionSigma,
} from "@/lib/leagues/win-probability/calibration";
import { getInjuryIndicator } from "@/lib/players/injury";

export type WinProbPlayer = {
  id: string;
  primaryPositionId: string;
  nflTeam: string | null;
  projectedPts: number | null;
  actualPts: number | null;
  injuryStatus?: string | null;
};

/**
 * Expected final fantasy points for one starter.
 * Pre → projection; live → actual + pace-blended remaining; post → actual.
 * Out/DNP/IR (injury) and soft late-zero actuals → remaining forced to 0.
 */
export function expectedPlayerPoints(
  player: WinProbPlayer,
  progress: GameProgress | null,
): { mean: number; variance: number } {
  const out =
    getInjuryIndicator(player.injuryStatus)?.tone === "out";
  const projection = out ? 0 : Math.max(0, player.projectedPts ?? 0);
  const actual = Math.max(0, player.actualPts ?? 0);
  const sigma = positionSigma(player.primaryPositionId);

  if (!progress || progress.status === "pre") {
    if (out) {
      return { mean: 0, variance: 0 };
    }
    return { mean: projection, variance: sigma * sigma };
  }

  if (progress.status === "post" || progress.fractionPlayed >= 1) {
    return { mean: actual, variance: 0 };
  }

  const remainingFrac = 1 - progress.fractionPlayed;
  const softDnp =
    !out &&
    actual === 0 &&
    projection > 0 &&
    progress.fractionPlayed >= SOFT_DNP_FRACTION;

  if (out || softDnp) {
    return { mean: actual, variance: 0 };
  }

  // Pace = actual / time played; blend toward pace as the game progresses.
  const played = Math.max(progress.fractionPlayed, 0.01);
  const paceFullGame = actual / played;
  const paceWeight =
    progress.fractionPlayed < PACE_BLEND_START_FRAC
      ? 0
      : Math.min(
          PACE_BLEND_MAX,
          ((progress.fractionPlayed - PACE_BLEND_START_FRAC) /
            (1 - PACE_BLEND_START_FRAC)) *
            PACE_BLEND_MAX,
        );
  const blendedFullGame =
    projection * (1 - paceWeight) + paceFullGame * paceWeight;
  const remaining = Math.max(0, blendedFullGame * remainingFrac);

  // Live residual σ: scale with remaining time, keep a floor so mid-game WP
  // isn't overconfident (calibrated priors in calibration.ts).
  const liveSigma = Math.max(
    sigma * remainingFrac,
    sigma * LIVE_SIGMA_FLOOR_FRAC * Math.sqrt(Math.max(remainingFrac, 0.05)),
  );
  return {
    mean: actual + remaining,
    variance: liveSigma * liveSigma,
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
