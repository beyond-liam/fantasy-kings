/**
 * Determine the maximum week to finalize after a score sync.
 *
 * Caps at playoffEndWeek (or regularSeasonEndWeek if no playoffs) to include
 * playoff weeks through championship when input.week allows.
 * Also caps at week 18 (NFL max).
 *
 * @param inputWeek - Week just synced
 * @param regularSeasonEndWeek - Last regular season week for this league
 * @param playoffEndWeek - Last playoff week (championship week) if playoffs enabled
 * @returns Maximum week to finalize (1..18, ≤ seasonCap)
 */
export function finalizeMaxWeek(input: {
  inputWeek: number;
  regularSeasonEndWeek: number;
  playoffEndWeek?: number;
}): number {
  const seasonCap = input.playoffEndWeek ?? input.regularSeasonEndWeek;
  return Math.min(input.inputWeek, seasonCap, 18);
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
