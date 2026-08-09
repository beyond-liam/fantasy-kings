import { MAX_FANTASY_WEEK } from "@/lib/leagues/schedule/fantasy-week-map";

/**
 * Determine the maximum week to finalize after a score sync.
 *
 * Caps at playoffEndWeek (or regularSeasonEndWeek if no playoffs) to include
 * playoff weeks through championship when input.week allows.
 *
 * All week arguments are **fantasy** weeks (may include leading preseason).
 */
export function finalizeMaxWeek(input: {
  inputWeek: number;
  regularSeasonEndWeek: number;
  playoffEndWeek?: number;
}): number {
  const seasonCap = input.playoffEndWeek ?? input.regularSeasonEndWeek;
  return Math.min(input.inputWeek, seasonCap, MAX_FANTASY_WEEK);
}

/**
 * Gate for whether finalize should run after sync-scores.
 *
 * Current behavior:
 * - Sleeper skipped → no finalize
 * - Otherwise → finalize (regardless of upsert count)
 *
 * @param sleeperSkipped - Sleeper sync returned skipped=true
 * @returns true if finalize should run
 */
export function shouldFinalizeAfterSync(input: {
  sleeperSkipped: boolean;
}): boolean {
  return !input.sleeperSkipped;
}
