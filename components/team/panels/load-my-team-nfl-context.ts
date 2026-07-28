import { getNflScoreboard } from "@/lib/espn/scoreboard";
import {
  buildOpponentByTeam,
  resolvePlayerOpponent,
  type TeamMatchup,
} from "@/lib/nfl/matchups";
import { getNflState } from "@/lib/sleeper/api";

export async function loadMyTeamNflContext() {
  const nflState = await getNflState();
  const nflWeek = Math.max(1, Number(nflState.week) || 1);
  const nflSeason = nflState.season ?? String(new Date().getUTCFullYear());
  const seasonYear = Number(nflState.season) || new Date().getUTCFullYear();

  const scoreboard = await getNflScoreboard({
    season: seasonYear,
    week: nflWeek,
  }).catch(() => null);

  const opponentsByTeam = scoreboard
    ? buildOpponentByTeam(scoreboard.games)
    : new Map<string, TeamMatchup>();

  return { nflState, nflWeek, nflSeason, scoreboard, opponentsByTeam };
}

export function withPlayerOpponent<
  T extends { nflTeam: string | null; byeWeek: number | null },
>(
  player: T,
  nflWeek: number,
  opponentsByTeam: Map<string, TeamMatchup>,
): T & { opponent: ReturnType<typeof resolvePlayerOpponent> } {
  return {
    ...player,
    opponent: resolvePlayerOpponent({
      nflTeam: player.nflTeam,
      byeWeek: player.byeWeek,
      week: nflWeek,
      opponentsByTeam,
    }),
  };
}
