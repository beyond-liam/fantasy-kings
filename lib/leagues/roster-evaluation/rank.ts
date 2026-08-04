import { clampPowerScore } from "@/lib/leagues/power-rankings/types";
import type { RankTone } from "@/lib/leagues/roster-evaluation/types";

/**
 * Map league rank (1 = best) onto success → neutral → warning → destructive.
 * 4-team example: 1 success, 2 slate, 3 warning, 4 destructive.
 */
export function rankTone(rank: number, teamCount: number): RankTone {
  const n = Math.max(1, teamCount);
  const r = Math.min(n, Math.max(1, Math.round(rank)));
  const bucket = Math.min(3, Math.floor(((r - 1) / n) * 4));
  switch (bucket) {
    case 0:
      return "success";
    case 1:
      return "neutral";
    case 2:
      return "warning";
    default:
      return "destructive";
  }
}

/** Bar height 0–100; league-best rank (1) is always 100. */
export function rankPowerScore(rank: number, teamCount: number): number {
  const n = Math.max(1, teamCount);
  const r = Math.min(n, Math.max(1, Math.round(rank)));
  return clampPowerScore((100 * (n - r + 1)) / n);
}

/**
 * Remap overall position rank into a starter-slot rank (always 1..teamCount).
 *
 * Depth 0 (RB1) uses overall ranks 1..N.
 * Depth 1 (RB2) uses overall ranks 1..(2N) remapped: overall 4 in a 4-team
 * league → slot rank 1.
 */
export function slotRankFromOverall(
  overallRank: number,
  depthIndex: number,
  teamCount: number,
): number {
  const n = Math.max(1, teamCount);
  const adjusted = overallRank - depthIndex * n;
  return Math.min(n, Math.max(1, adjusted));
}

export function formatOrdinalRank(rank: number): string {
  const v = rank % 100;
  if (v >= 11 && v <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}
