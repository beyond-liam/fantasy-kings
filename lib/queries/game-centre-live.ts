import "server-only";

import { toGameCentreLivePatch } from "@/lib/leagues/game-centre/game-centre-live-patch";
import type { GameCentreLivePatch } from "@/lib/leagues/game-centre/game-centre-live-patch";
import { fantasyWeekToNfl } from "@/lib/leagues/schedule/fantasy-week-map";
import { getGameCentreData } from "@/lib/queries/game-centre";
import { getPlayerScoresFreshness } from "@/lib/queries/score-freshness";

/**
 * Slim Game Centre snapshot for soft client updates (no full RSC reload).
 * Skips FA tips / preview / optimum via `liveOnly`.
 */
export async function getGameCentreLivePatch(input: {
  matchupId: string;
  leagueSlug: string;
  userId: string;
}): Promise<GameCentreLivePatch | null> {
  const data = await getGameCentreData({
    ...input,
    liveOnly: true,
  });
  if (!data) {
    return null;
  }

  const nflPoint = fantasyWeekToNfl(data.week, data.scheduleSettings);
  const scoringWeek = nflPoint?.week ?? data.week;
  const scoringSeasonType = nflPoint?.seasonType ?? "regular";

  const freshness = await getPlayerScoresFreshness({
    season: String(data.seasonYear),
    week: scoringWeek,
    kind: "stats",
    seasonType: scoringSeasonType,
  }).catch(() => null);

  const hasLiveNflGames = [
    ...data.boxScore.away.starters,
    ...data.boxScore.home.starters,
  ].some((player) => player.gameStatus === "in");

  return toGameCentreLivePatch({
    data,
    updatedAt: freshness?.toISOString() ?? null,
    hasLiveNflGames,
  });
}
