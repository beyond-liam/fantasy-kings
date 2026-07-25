import "server-only";

import { getNflScoreboard } from "@/lib/espn/scoreboard";
import { getStartedNflTeamAbbreviations } from "@/lib/leagues/waivers/game-lock";
import { getNflState } from "@/lib/sleeper/api";

/**
 * NFL teams whose games have started this week.
 * Returns null when the scoreboard is unavailable (callers fail open).
 */
export async function loadStartedNflTeamsForLineupLock(): Promise<Set<string> | null> {
  try {
    const nflState = await getNflState();
    const week = Math.max(1, Number(nflState.week) || 1);
    const seasonYear = Number(nflState.season) || new Date().getUTCFullYear();
    const scoreboard = await getNflScoreboard({ season: seasonYear, week });
    return getStartedNflTeamAbbreviations(scoreboard.games);
  } catch {
    return null;
  }
}
