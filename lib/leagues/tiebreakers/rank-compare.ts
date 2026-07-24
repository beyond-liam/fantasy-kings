import type { RankTiebreakerId } from "@/db/schema/league-seasons";
import type { FinalMatchupRecord } from "@/lib/leagues/standings";
import type { LeagueStandingsRow } from "@/lib/leagues/standings";

const TIE_EPSILON = 0.05;

export type RankCompareContext = {
  finals: FinalMatchupRecord[];
  /** Precomputed win% by teamId from current standings rows. */
  winPctByTeamId: Map<string, number>;
  /** Precomputed PF by teamId. */
  pointsForByTeamId: Map<string, number>;
};

function gamesPlayed(row: LeagueStandingsRow) {
  return row.wins + row.losses + row.ties;
}

/** Head-to-head win% among the tied group only (pairwise finals). */
export function headToHeadWinPct(
  teamId: string,
  tiedTeamIds: Set<string>,
  finals: FinalMatchupRecord[],
): number {
  let wins = 0;
  let losses = 0;
  let ties = 0;

  for (const matchup of finals) {
    const homeIn = tiedTeamIds.has(matchup.homeTeamId);
    const awayIn = tiedTeamIds.has(matchup.awayTeamId);
    if (!homeIn || !awayIn) continue;
    if (matchup.homeTeamId !== teamId && matchup.awayTeamId !== teamId) {
      continue;
    }
    if (
      matchup.homePts == null ||
      matchup.awayPts == null ||
      !Number.isFinite(matchup.homePts) ||
      !Number.isFinite(matchup.awayPts)
    ) {
      continue;
    }

    const diff = matchup.homePts - matchup.awayPts;
    const isHome = matchup.homeTeamId === teamId;
    if (Math.abs(diff) <= TIE_EPSILON) {
      ties += 1;
    } else if ((diff > 0 && isHome) || (diff < 0 && !isHome)) {
      wins += 1;
    } else {
      losses += 1;
    }
  }

  const games = wins + losses + ties;
  return games === 0 ? 0 : (wins + 0.5 * ties) / games;
}

/** Opponent combined win% (harder schedule = higher). */
export function scheduleRecordStrength(
  teamId: string,
  finals: FinalMatchupRecord[],
  winPctByTeamId: Map<string, number>,
): number {
  let total = 0;
  let count = 0;
  for (const matchup of finals) {
    let opponentId: string | null = null;
    if (matchup.homeTeamId === teamId) opponentId = matchup.awayTeamId;
    else if (matchup.awayTeamId === teamId) opponentId = matchup.homeTeamId;
    if (!opponentId) continue;
    total += winPctByTeamId.get(opponentId) ?? 0;
    count += 1;
  }
  return count === 0 ? 0 : total / count;
}

/** Opponent average PF (harder schedule = higher). */
export function schedulePointsStrength(
  teamId: string,
  finals: FinalMatchupRecord[],
  pointsForByTeamId: Map<string, number>,
): number {
  let total = 0;
  let count = 0;
  for (const matchup of finals) {
    let opponentId: string | null = null;
    if (matchup.homeTeamId === teamId) opponentId = matchup.awayTeamId;
    else if (matchup.awayTeamId === teamId) opponentId = matchup.homeTeamId;
    if (!opponentId) continue;
    total += pointsForByTeamId.get(opponentId) ?? 0;
    count += 1;
  }
  return count === 0 ? 0 : total / count;
}

function compareByTiebreaker(
  a: LeagueStandingsRow,
  b: LeagueStandingsRow,
  id: RankTiebreakerId,
  tiedIds: Set<string>,
  ctx: RankCompareContext,
): number {
  const aId = a.teamId!;
  const bId = b.teamId!;

  switch (id) {
    case "head_to_head": {
      const aH2h = headToHeadWinPct(aId, tiedIds, ctx.finals);
      const bH2h = headToHeadWinPct(bId, tiedIds, ctx.finals);
      return bH2h - aH2h;
    }
    case "points_per_game": {
      const aGames = gamesPlayed(a);
      const bGames = gamesPlayed(b);
      const aPpg = aGames > 0 ? a.pointsFor / aGames : 0;
      const bPpg = bGames > 0 ? b.pointsFor / bGames : 0;
      return bPpg - aPpg;
    }
    case "schedule_record": {
      return (
        scheduleRecordStrength(bId, ctx.finals, ctx.winPctByTeamId) -
        scheduleRecordStrength(aId, ctx.finals, ctx.winPctByTeamId)
      );
    }
    case "schedule_points": {
      return (
        schedulePointsStrength(bId, ctx.finals, ctx.pointsForByTeamId) -
        schedulePointsStrength(aId, ctx.finals, ctx.pointsForByTeamId)
      );
    }
    default:
      return 0;
  }
}

/**
 * Compare two standings rows after win% is equal.
 * When `breakTies` is false, falls back to PF → PA → name.
 */
export function compareRankTiebreakers(
  a: LeagueStandingsRow,
  b: LeagueStandingsRow,
  tiedIds: Set<string>,
  order: RankTiebreakerId[],
  breakTies: boolean,
  ctx: RankCompareContext,
): number {
  if (breakTies) {
    for (const id of order) {
      const diff = compareByTiebreaker(a, b, id, tiedIds, ctx);
      if (Math.abs(diff) > 1e-9) return diff;
    }
  }

  if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
  if (b.pointsAgainst !== a.pointsAgainst) {
    return a.pointsAgainst - b.pointsAgainst;
  }
  return a.teamName.localeCompare(b.teamName);
}
