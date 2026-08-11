export type PowerRankingTone = "success" | "warning" | "destructive";

export type PowerRankingMode = "draft" | "week" | "rest-of-season";

export type PowerRankingTeamRow = {
  rank: number;
  /** Positive = moved up; negative = moved down; null when no prior snapshot. */
  rankDelta: number | null;
  teamId: string;
  teamPublicId: string | null;
  teamName: string;
  ownerName: string;
  ownerUserId: string | null;
  logoUrl: string | null;
  /** Display score 0–100; league leader is always 100 (raw strength / max). */
  powerScore: number;
  tone: PowerRankingTone;
};

/** Progress / score color bands for the power meter. */
export function powerScoreTone(score: number): PowerRankingTone {
  if (score >= 65) return "success";
  if (score >= 40) return "warning";
  return "destructive";
}

export function clampPowerScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Scale raw strength so the league leader is always 100 (barometer to beat).
 * Others are `round(100 * raw / max)`. All-zero / empty → 0.
 */
export function scalePowerScoresToBarometer(
  rawByTeamId: Map<string, number>,
): Map<string, number> {
  const result = new Map<string, number>();
  if (rawByTeamId.size === 0) return result;

  let max = 0;
  for (const value of rawByTeamId.values()) {
    if (Number.isFinite(value) && value > max) max = value;
  }

  for (const [teamId, raw] of rawByTeamId) {
    if (!Number.isFinite(raw) || max <= 0) {
      result.set(teamId, 0);
      continue;
    }
    result.set(teamId, clampPowerScore((100 * raw) / max));
  }
  return result;
}
