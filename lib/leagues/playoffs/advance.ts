import type { GameTiebreakerId } from "@/db/schema/league-seasons";
import { getPlayoffWeekRange } from "@/lib/leagues/season-calendar";
import {
  resolveGameTiebreakerWinner,
  type TeamGameTieMetrics,
} from "@/lib/leagues/tiebreakers/game-compare";

export type PlayoffSeedTeam = {
  seed: number;
  teamId: string;
};

export type PlayoffPairing = {
  week: number;
  homeTeamId: string;
  awayTeamId: string;
};

const PTS_EPS = 0.05;

/** Higher seed is home. Winner by points; ties use game tiebreakers then home. */
export function winnerOfFinalMatchup(input: {
  homeTeamId: string;
  awayTeamId: string;
  homePts: number | null;
  awayPts: number | null;
  status: string;
  gameTiebreakers?: GameTiebreakerId[];
  homeMetrics?: TeamGameTieMetrics | null;
  awayMetrics?: TeamGameTieMetrics | null;
}): string | null {
  if (input.status !== "final") return null;
  if (input.homePts == null || input.awayPts == null) return null;
  const diff = input.homePts - input.awayPts;
  if (Math.abs(diff) > PTS_EPS) {
    return diff > 0 ? input.homeTeamId : input.awayTeamId;
  }

  if (
    input.gameTiebreakers?.length &&
    input.homeMetrics &&
    input.awayMetrics
  ) {
    const fromMetrics = resolveGameTiebreakerWinner({
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      home: input.homeMetrics,
      away: input.awayMetrics,
      order: input.gameTiebreakers,
    });
    if (fromMetrics) return fromMetrics;
  }

  // Still tied → higher seed (home in our pairings) advances.
  return input.homeTeamId;
}

/**
 * First playoff week pairings from standings seeds (1=best).
 * 4: 1v4, 2v3. 6: 3v6, 4v5 (1–2 bye). 8: 1v8, 4v5, 2v7, 3v6.
 */
export function firstRoundPairings(input: {
  seeds: PlayoffSeedTeam[];
  playoffTeamCount: number;
  championshipWeek: number;
  twoWeekChampionship?: boolean;
}): PlayoffPairing[] {
  const range = getPlayoffWeekRange(
    input.championshipWeek,
    input.playoffTeamCount,
    {
      enabled: true,
      twoWeekChampionship: Boolean(input.twoWeekChampionship),
    },
  );
  if (!range) return [];
  const week = range.startWeek;
  const bySeed = new Map(input.seeds.map((s) => [s.seed, s.teamId]));
  const team = (seed: number) => bySeed.get(seed);
  const pair = (high: number, low: number): PlayoffPairing | null => {
    const home = team(high);
    const away = team(low);
    if (!home || !away) return null;
    return { week, homeTeamId: home, awayTeamId: away };
  };

  if (input.playoffTeamCount === 4) {
    return [pair(1, 4), pair(2, 3)].filter(
      (row): row is PlayoffPairing => row != null,
    );
  }
  if (input.playoffTeamCount === 6) {
    return [pair(3, 6), pair(4, 5)].filter(
      (row): row is PlayoffPairing => row != null,
    );
  }
  if (input.playoffTeamCount === 8) {
    return [pair(1, 8), pair(4, 5), pair(2, 7), pair(3, 6)].filter(
      (row): row is PlayoffPairing => row != null,
    );
  }
  return [];
}

/**
 * Advance winners into the next playoff week.
 * `byeTeamIds` are higher seeds that sit out the completed week (6-team format).
 * With byes (no re-seed): bye[i] hosts winners[i].
 * With `reSeedAfterEachRound`: remaining teams sorted by original seed, paired
 * highest vs lowest (1vN, 2vN-1, …) with higher seed home.
 */
export function nextRoundPairings(input: {
  nextWeek: number;
  winnersInBracketOrder: string[];
  byeTeamIds?: string[];
  reSeedAfterEachRound?: boolean;
  /** Original playoff seeds (1=best) for re-seeding remaining teams. */
  seedByTeamId?: Map<string, number>;
}): PlayoffPairing[] {
  const byes = input.byeTeamIds ?? [];
  const winners = input.winnersInBracketOrder;
  const remaining = [...byes, ...winners];

  if (
    input.reSeedAfterEachRound &&
    input.seedByTeamId &&
    remaining.length >= 2
  ) {
    const seeded = remaining
      .map((teamId) => ({
        teamId,
        seed: input.seedByTeamId!.get(teamId) ?? Number.MAX_SAFE_INTEGER,
      }))
      .toSorted((a, b) => a.seed - b.seed);

    const pairings: PlayoffPairing[] = [];
    let lo = 0;
    let hi = seeded.length - 1;
    while (lo < hi) {
      pairings.push({
        week: input.nextWeek,
        homeTeamId: seeded[lo]!.teamId,
        awayTeamId: seeded[hi]!.teamId,
      });
      lo += 1;
      hi -= 1;
    }
    return pairings;
  }

  const pairings: PlayoffPairing[] = [];

  if (byes.length > 0) {
    const count = Math.min(byes.length, winners.length);
    for (let i = 0; i < count; i++) {
      pairings.push({
        week: input.nextWeek,
        homeTeamId: byes[i]!,
        awayTeamId: winners[i]!,
      });
    }
    return pairings;
  }

  for (let i = 0; i + 1 < winners.length; i += 2) {
    pairings.push({
      week: input.nextWeek,
      homeTeamId: winners[i]!,
      awayTeamId: winners[i + 1]!,
    });
  }
  return pairings;
}
