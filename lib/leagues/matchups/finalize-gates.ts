/**
 * Determine the maximum week to finalize after a score sync.
 *
 * Caps at regularSeasonEndWeek to avoid finalizing playoff weeks
 * (which need bracket logic, not simple score comparison).
 * Also caps at week 18 (NFL max).
 *
 * @param inputWeek - Week just synced
 * @param regularSeasonEndWeek - Last regular season week for this league
 * @returns Maximum week to finalize (1..18, ≤ regularSeasonEndWeek)
 */
export function finalizeMaxWeek(input: {
  inputWeek: number;
  regularSeasonEndWeek: number;
}): number {
  return Math.min(input.inputWeek, input.regularSeasonEndWeek, 18);
}

/**
 * Gate for whether finalize should run after sync-scores.
 *
 * Current behavior:
 * - Sleeper skipped → no finalize
 * - No records upserted → no finalize
 * - Otherwise → finalize
 *
 * @param sleeperSkipped - Sleeper sync returned skipped=true
 * @param upserted - Total player_scores upserted (Sleeper + ESPN + nflverse)
 * @returns true if finalize should run
 */
export function shouldFinalizeAfterSync(input: {
  sleeperSkipped: boolean;
  upserted: number;
}): boolean {
  return !input.sleeperSkipped && input.upserted > 0;
}
