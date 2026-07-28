import type { GameTiebreakerId } from "@/db/schema/league-seasons";
import {
  nextRoundPairings,
  winnerOfFinalMatchup,
  type PlayoffPairing,
} from "@/lib/leagues/playoffs/advance";
import type { TeamGameTieMetrics } from "@/lib/leagues/tiebreakers/game-compare";

export type PlayoffWeekMatchupRow = {
  homeTeamId: string;
  awayTeamId: string;
  homePts: number | null;
  awayPts: number | null;
  status: string;
};

/**
 * Decide whether to insert the next playoff week and which pairings to write.
 * Pure: callers load seeds, metrics, and existing rows.
 */
export function decideNextPlayoffRound(input: {
  weekRows: PlayoffWeekMatchupRow[];
  nextWeekAlreadyExists: boolean;
  /** Championship Game 1 → Game 2 is a rematch, not an advance. */
  isChampionshipRematchAdvance: boolean;
  seedByTeamId: Map<string, number>;
  gameTiebreakers: GameTiebreakerId[];
  metricsByTeam: Map<string, TeamGameTieMetrics>;
  nextWeek: number;
  byeTeamIds: string[];
  reSeedAfterEachRound: boolean;
}):
  | { action: "skip"; reason: string }
  | { action: "insert"; pairings: PlayoffPairing[] } {
  if (input.weekRows.length === 0 || input.nextWeekAlreadyExists) {
    return { action: "skip", reason: "missing_week_or_next_exists" };
  }
  if (input.isChampionshipRematchAdvance) {
    return { action: "skip", reason: "championship_rematch" };
  }
  if (!input.weekRows.every((row) => row.status === "final")) {
    return { action: "skip", reason: "week_not_final" };
  }

  const sortedWeekRows = input.weekRows.toSorted((a, b) => {
    const aSeeds = [
      input.seedByTeamId.get(a.homeTeamId) ?? Number.MAX_SAFE_INTEGER,
      input.seedByTeamId.get(a.awayTeamId) ?? Number.MAX_SAFE_INTEGER,
    ];
    const bSeeds = [
      input.seedByTeamId.get(b.homeTeamId) ?? Number.MAX_SAFE_INTEGER,
      input.seedByTeamId.get(b.awayTeamId) ?? Number.MAX_SAFE_INTEGER,
    ];
    const aMin = Math.min(...aSeeds);
    const bMin = Math.min(...bSeeds);
    if (aMin !== bMin) return aMin - bMin;
    return aSeeds[0]! - bSeeds[0]!;
  });

  const winners = sortedWeekRows
    .map((row) =>
      winnerOfFinalMatchup({
        homeTeamId: row.homeTeamId,
        awayTeamId: row.awayTeamId,
        homePts: row.homePts,
        awayPts: row.awayPts,
        status: row.status,
        gameTiebreakers: input.gameTiebreakers,
        homeMetrics: input.metricsByTeam.get(row.homeTeamId) ?? null,
        awayMetrics: input.metricsByTeam.get(row.awayTeamId) ?? null,
      }),
    )
    .filter((id): id is string => id != null);

  if (winners.length === 0 || winners.length !== input.weekRows.length) {
    return { action: "skip", reason: "incomplete_winners" };
  }

  const pairings = nextRoundPairings({
    nextWeek: input.nextWeek,
    winnersInBracketOrder: winners,
    byeTeamIds: input.byeTeamIds,
    reSeedAfterEachRound: input.reSeedAfterEachRound,
    seedByTeamId: input.seedByTeamId,
  });

  return { action: "insert", pairings };
}
