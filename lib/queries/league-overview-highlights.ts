import "server-only";

import { pickPlayersOfTheWeek } from "@/lib/leagues/overview-players-of-the-week";
import { NFL_PRESEASON_FIRST_WEEK } from "@/lib/leagues/schedule/fantasy-week-map";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { getRankedPlayers, type RankedPlayerRow } from "@/lib/queries/players";

export type { OverviewPlayerHighlight } from "@/lib/leagues/overview-players-of-the-week";

async function loadWeekPlayers(input: {
  seasonYear: number;
  week: number;
  seasonType?: string;
  scoringRules: ScoringRuleDefinition[];
}) {
  return getRankedPlayers({
    season: String(input.seasonYear),
    week: input.week,
    seasonType: input.seasonType,
    kind: "stats",
    scoringRules: input.scoringRules,
    preserveStats: false,
    limit: 400,
  }).catch(() => [] as RankedPlayerRow[]);
}

function hasScoredPlayers(players: RankedPlayerRow[]) {
  return players.some((player) => (player.fantasyPts ?? 0) > 0);
}

export async function loadOverviewWeekHighlights(input: {
  seasonYear: number;
  week: number;
  seasonType?: string;
  scoringRules: ScoringRuleDefinition[];
}): Promise<{
  playersOfTheWeek: ReturnType<typeof pickPlayersOfTheWeek>;
  week: number;
}> {
  let week = input.week;
  const seasonType = input.seasonType;
  let players = await loadWeekPlayers({
    seasonYear: input.seasonYear,
    week,
    seasonType,
    scoringRules: input.scoringRules,
  });

  const minWeek = seasonType === "pre" ? NFL_PRESEASON_FIRST_WEEK : 1;
  // Prefer the prior week when the current slate has no scored fantasy pts yet.
  if (!hasScoredPlayers(players) && week > minWeek) {
    week = week - 1;
    players = await loadWeekPlayers({
      seasonYear: input.seasonYear,
      week,
      seasonType,
      scoringRules: input.scoringRules,
    });
  }

  return {
    playersOfTheWeek: pickPlayersOfTheWeek(players),
    week,
  };
}
