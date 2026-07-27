/**
 * Determine if nflverse official stats should run after Sleeper sync.
 *
 * @param force - User explicitly requested nflverse=1
 * @param scoreboardOk - Whether scoreboard fetch succeeded (false if catch → null)
 * @param games - Games from scoreboard (empty array if fetch failed)
 * @returns true if nflverse should replace Sleeper stats
 *
 * Fail-closed behavior (plan 005):
 * - force=true → always run
 * - scoreboardOk=false → skip (no visibility into game state)
 * - any game status="in" → skip (games still in progress)
 * - games.length=0 even with scoreboardOk=true → skip (no games to finalize)
 * - all games status="post" → run (slate complete)
 */
export function shouldAutoRunNflverse(input: {
  force: boolean;
  scoreboardOk: boolean;
  games: Array<{ status: string }>;
}): boolean {
  if (input.force) return true;
  if (!input.scoreboardOk) return false;

  const hasLive = input.games.some((game) => game.status === "in");
  if (hasLive) return false;

  // Only run if we have games AND all are post
  return input.games.length > 0 && input.games.every((game) => game.status === "post");
}
