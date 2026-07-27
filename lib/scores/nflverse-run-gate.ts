import type { ScheduleGame } from "@/lib/espn/scoreboard";

/**
 * Determine if nflverse official stats should run after Sleeper sync.
 *
 * @param force - User explicitly requested nflverse=1
 * @param scoreboardOk - Whether scoreboard fetch succeeded (false if catch → null)
 * @param games - Games from scoreboard (empty array if fetch failed)
 * @returns true if nflverse should replace Sleeper stats
 *
 * Current behavior (including bug):
 * - force=true → always run
 * - scoreboardOk=false (fetch failed) → games=[] → runs (treats outage as "week done")
 * - hasLive → skip (games still in progress)
 * - hasPost or empty → run (slate complete or past week)
 *
 * Plan 005 will fix scoreboardOk=false → skip instead of run.
 */
export function shouldAutoRunNflverse(input: {
  force: boolean;
  scoreboardOk: boolean;
  games: ScheduleGame[];
}): boolean {
  if (input.force) return true;

  const hasLive = input.games.some((game) => game.status === "in");
  const hasPost = input.games.some((game) => game.status === "post");

  // Current bug: scoreboardOk false is treated same as empty games array.
  // Plan 005: return false when !scoreboardOk.
  return !hasLive && (hasPost || input.games.length === 0);
}
