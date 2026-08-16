/**
 * NFL game-week close: slate complete vs league-rollup finalized.
 *
 * Slate complete = every game on this week's board is `post`.
 * League week finalized = 2 hours after the last game's estimated end
 * (last kickoff + typical game length). Matchups may still finalize
 * per-lineup before this; standings / HoF / Stats wait for this clock.
 */

export const NFL_GAME_DURATION_MS = 3.25 * 60 * 60 * 1000;
export const GAME_WEEK_FINALIZE_DELAY_MS = 2 * 60 * 60 * 1000;

export type NflWeekGame = {
  status: string;
  kickoff: string;
};

/** True when the week's NFL board has games and every one is final. */
export function isNflSlateComplete(games: Array<Pick<NflWeekGame, "status">>): boolean {
  if (games.length === 0) return false;
  if (games.some((game) => game.status === "in" || game.status === "pre")) {
    return false;
  }
  return games.every((game) => game.status === "post");
}

export function lastKickoffAt(games: Array<Pick<NflWeekGame, "kickoff">>): Date | null {
  let latest: Date | null = null;
  for (const game of games) {
    const kickoff = new Date(game.kickoff);
    if (!Number.isFinite(kickoff.getTime())) continue;
    if (!latest || kickoff > latest) latest = kickoff;
  }
  return latest;
}

/**
 * Instant league rollups may include this week: last kickoff + typical
 * game length + 2 hours. Null when the slate is not complete.
 */
export function gameWeekFinalizedAt(
  games: NflWeekGame[],
): Date | null {
  if (!isNflSlateComplete(games)) return null;
  const lastKickoff = lastKickoffAt(games);
  if (!lastKickoff) return null;
  return new Date(
    lastKickoff.getTime() + NFL_GAME_DURATION_MS + GAME_WEEK_FINALIZE_DELAY_MS,
  );
}

export function isGameWeekFinalized(
  games: NflWeekGame[],
  now: Date = new Date(),
): boolean {
  const at = gameWeekFinalizedAt(games);
  return at != null && now >= at;
}

/** Drop the in-progress fantasy week from standings-style rollups. */
export function excludeUnfinalizedGameWeek<T extends { week: number }>(
  rows: T[],
  currentFantasyWeek: number | null,
  weekFinalized: boolean,
): T[] {
  if (currentFantasyWeek == null || currentFantasyWeek < 1 || weekFinalized) {
    return rows;
  }
  return rows.filter((row) => row.week < currentFantasyWeek);
}
