const PREGAME_WINDOW_MS = 30 * 60 * 1000;
const POST_KICKOFF_WINDOW_MS = 8 * 60 * 60 * 1000;

type ScoreboardGameWindow = {
  status: string;
  kickoff: string;
};

/**
 * Keep unattended cron calls away from the database outside NFL game windows.
 * The scoreboard is upstream-only, so a skipped call incurs no Supabase egress.
 */
export function shouldRunAutomatedScoreSync(input: {
  scoreboardOk: boolean;
  games: ScoreboardGameWindow[];
  now?: Date;
}): boolean {
  if (!input.scoreboardOk || input.games.length === 0) {
    return false;
  }

  const nowMs = (input.now ?? new Date()).getTime();

  return input.games.some((game) => {
    if (game.status === "in") {
      return true;
    }

    const kickoffMs = new Date(game.kickoff).getTime();
    if (!Number.isFinite(kickoffMs)) {
      return false;
    }

    if (game.status === "pre") {
      const untilKickoffMs = kickoffMs - nowMs;
      return untilKickoffMs >= 0 && untilKickoffMs <= PREGAME_WINDOW_MS;
    }

    if (game.status === "post") {
      const sinceKickoffMs = nowMs - kickoffMs;
      return sinceKickoffMs >= 0 && sinceKickoffMs <= POST_KICKOFF_WINDOW_MS;
    }

    return false;
  });
}

/** Explicit operational requests bypass the automatic game-window guard. */
export function isAutomatedScoreSyncRequest(input: {
  forceSync?: boolean;
  forceNflverse?: boolean;
}): boolean {
  return input.forceSync !== true && input.forceNflverse !== true;
}
