import "server-only";

import { pickPlayersOfTheWeek } from "@/lib/leagues/overview-players-of-the-week";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { getRankedPlayers, type RankedPlayerRow } from "@/lib/queries/players";

export type { OverviewPlayerHighlight } from "@/lib/leagues/overview-players-of-the-week";

async function loadWeekPlayers(input: {
  seasonYear: number;
  week: number;
  scoringRules: ScoringRuleDefinition[];
}) {
  return getRankedPlayers({
    season: String(input.seasonYear),
    week: input.week,
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
  scoringRules: ScoringRuleDefinition[];
}): Promise<{
  playersOfTheWeek: ReturnType<typeof pickPlayersOfTheWeek>;
  week: number;
}> {
  let week = input.week;
  let players = await loadWeekPlayers({
    seasonYear: input.seasonYear,
    week,
    scoringRules: input.scoringRules,
  });

  // Prefer the prior week when the current slate has no scored fantasy pts yet.
  if (!hasScoredPlayers(players) && week > 1) {
    week = week - 1;
    players = await loadWeekPlayers({
      seasonYear: input.seasonYear,
      week,
      scoringRules: input.scoringRules,
    });
  }

  return {
    playersOfTheWeek: pickPlayersOfTheWeek(players),
    week,
  };
}
