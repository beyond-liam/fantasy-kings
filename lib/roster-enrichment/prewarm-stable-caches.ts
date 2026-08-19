import "server-only";

import { getCachedNflScoreboard } from "@/lib/espn/scoreboard-cache";
import { espnSeasonTypeForNfl } from "@/lib/leagues/schedule/fantasy-week-map";
import { clearScoreRowsCache } from "@/lib/queries/score-rows";

/** Refresh cross-request caches after live stats sync. */
export async function prewarmRosterCachesAfterScoreSync(input: {
  season: string;
  week: number;
  seasonType: "pre" | "regular" | "post";
}) {
  clearScoreRowsCache();

  const seasonYear = Number.parseInt(input.season, 10);
  if (!Number.isFinite(seasonYear)) {
    return;
  }

  await getCachedNflScoreboard({
    season: seasonYear,
    week: input.week,
    seasonType: espnSeasonTypeForNfl(input.seasonType),
    calendarSeasonTypes: [espnSeasonTypeForNfl(input.seasonType)],
  }).catch(() => null);
}
