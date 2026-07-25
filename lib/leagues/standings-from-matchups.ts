import type {
  RankTiebreakerId,
  TiebreakerSettings,
} from "@/db/schema/league-seasons";
import type {
  FinalMatchupRecord,
  StandingsFormGame,
} from "@/lib/leagues/standings";
import {
  buildPlaceholderStandings,
  type BuildStandingsOptions,
  type LeagueStandingsMember,
  type LeagueStandingsRow,
} from "@/lib/leagues/standings";
import { compareRankTiebreakers } from "@/lib/leagues/tiebreakers/rank-compare";
import { DEFAULT_TIEBREAKER_SETTINGS } from "@/lib/leagues/tiebreakers";

const TIE_EPSILON = 0.05;
const FORM_LENGTH = 5;

type TeamAccum = {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Chronological results for streak (oldest → newest). */
  results: Array<"W" | "L" | "T">;
  /** Chronological form games with opponent context. */
  formGames: StandingsFormGame[];
};

function emptyAccum(): TeamAccum {
  return {
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    results: [],
    formGames: [],
  };
}

function streakFromResults(results: Array<"W" | "L" | "T">): string | null {
  if (results.length === 0) {
    return null;
  }
  const last = results[results.length - 1]!;
  if (last === "T") {
    return "T1";
  }
  let length = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] !== last) {
      break;
    }
    length += 1;
  }
  return `${last}${length}`;
}

export type StandingsTiebreakerOptions = {
  breakRegularSeasonTies?: boolean;
  rankTiebreakers?: RankTiebreakerId[];
};

function resolveSortOptions(
  options?: StandingsTiebreakerOptions | TiebreakerSettings | null,
): {
  breakTies: boolean;
  order: RankTiebreakerId[];
} {
  return {
    breakTies:
      options?.breakRegularSeasonTies ??
      DEFAULT_TIEBREAKER_SETTINGS.breakRegularSeasonTies,
    order:
      options?.rankTiebreakers ?? DEFAULT_TIEBREAKER_SETTINGS.rankTiebreakers,
  };
}

/**
 * Overlay final H2H results onto placeholder standings (roster / FAAB / draft order).
 * Unclaimed slots stay at the bottom with empty records.
 */
export function applyFinalMatchupsToStandings(
  baseRows: LeagueStandingsRow[],
  finals: FinalMatchupRecord[],
  tiebreakers?: StandingsTiebreakerOptions | TiebreakerSettings | null,
): LeagueStandingsRow[] {
  const byTeam = new Map<string, TeamAccum>();
  const { breakTies, order } = resolveSortOptions(tiebreakers);
  const teamNameById = new Map(
    baseRows
      .filter((row) => row.teamId)
      .map((row) => [row.teamId!, row.teamName] as const),
  );

  const sortedFinals = finals.toSorted(
    (a, b) => a.week - b.week || a.id.localeCompare(b.id),
  );

  for (const matchup of sortedFinals) {
    if (
      matchup.homePts == null ||
      matchup.awayPts == null ||
      !Number.isFinite(matchup.homePts) ||
      !Number.isFinite(matchup.awayPts)
    ) {
      continue;
    }

    const home = byTeam.get(matchup.homeTeamId) ?? emptyAccum();
    const away = byTeam.get(matchup.awayTeamId) ?? emptyAccum();
    const homeName =
      teamNameById.get(matchup.homeTeamId) ?? "Unknown";
    const awayName =
      teamNameById.get(matchup.awayTeamId) ?? "Unknown";

    home.pointsFor += matchup.homePts;
    home.pointsAgainst += matchup.awayPts;
    away.pointsFor += matchup.awayPts;
    away.pointsAgainst += matchup.homePts;

    const diff = matchup.homePts - matchup.awayPts;
    let homeResult: "W" | "L" | "T";
    let awayResult: "W" | "L" | "T";
    if (Math.abs(diff) <= TIE_EPSILON) {
      home.ties += 1;
      away.ties += 1;
      homeResult = "T";
      awayResult = "T";
    } else if (diff > 0) {
      home.wins += 1;
      away.losses += 1;
      homeResult = "W";
      awayResult = "L";
    } else {
      away.wins += 1;
      home.losses += 1;
      awayResult = "W";
      homeResult = "L";
    }

    home.results.push(homeResult);
    away.results.push(awayResult);
    home.formGames.push({
      result: homeResult,
      week: matchup.week,
      opponentName: awayName,
      ownPts: matchup.homePts,
      oppPts: matchup.awayPts,
    });
    away.formGames.push({
      result: awayResult,
      week: matchup.week,
      opponentName: homeName,
      ownPts: matchup.awayPts,
      oppPts: matchup.homePts,
    });

    byTeam.set(matchup.homeTeamId, home);
    byTeam.set(matchup.awayTeamId, away);
  }

  const withRecords = baseRows.map((row) => {
    if (!row.teamId || !row.claimed) {
      return row;
    }
    const accum = byTeam.get(row.teamId);
    if (!accum) {
      return row;
    }
    const games = accum.wins + accum.losses + accum.ties;
    const winPct =
      games === 0 ? 0 : (accum.wins + 0.5 * accum.ties) / games;
    return {
      ...row,
      wins: accum.wins,
      losses: accum.losses,
      ties: accum.ties,
      winPct,
      pointsFor: Math.round(accum.pointsFor * 10) / 10,
      pointsForAvg:
        games > 0 ? Math.round((accum.pointsFor / games) * 10) / 10 : 0,
      pointsAgainst: Math.round(accum.pointsAgainst * 10) / 10,
      pointsAgainstAvg:
        games > 0 ? Math.round((accum.pointsAgainst / games) * 10) / 10 : 0,
      streak: streakFromResults(accum.results),
      form: accum.formGames.slice(-FORM_LENGTH),
    };
  });

  const winPctByTeamId = new Map<string, number>();
  const pointsForByTeamId = new Map<string, number>();
  for (const row of withRecords) {
    if (!row.teamId || !row.claimed) continue;
    winPctByTeamId.set(row.teamId, row.winPct);
    pointsForByTeamId.set(row.teamId, row.pointsFor);
  }

  const claimed = withRecords.filter((row) => row.claimed);
  const unclaimed = withRecords.filter((row) => !row.claimed);

  const sortedClaimed = claimed.toSorted((a, b) => {
    if (a.claimed !== b.claimed) {
      return a.claimed ? -1 : 1;
    }
    if (b.winPct !== a.winPct) {
      return b.winPct - a.winPct;
    }
    if (!a.teamId || !b.teamId) {
      return a.teamName.localeCompare(b.teamName);
    }
    // Same win% group — use configured rank tiebreakers among all teams
    // sharing this win% (H2H among the full tied set).
    const tiedIds = new Set(
      claimed
        .filter((row) => row.teamId && row.winPct === a.winPct)
        .map((row) => row.teamId!),
    );
    return compareRankTiebreakers(a, b, tiedIds, order, breakTies, {
      finals: sortedFinals,
      winPctByTeamId,
      pointsForByTeamId,
    });
  });

  const leader = sortedClaimed[0] ?? null;
  const ranked = sortedClaimed.map((row, index) => {
    let gamesBehind: number | null = null;
    if (leader && row.teamId !== leader.teamId) {
      const gb =
        leader.wins - row.wins + (row.losses - leader.losses) / 2;
      gamesBehind = Math.round(gb * 10) / 10;
    } else if (leader && row.teamId === leader.teamId) {
      gamesBehind = 0;
    }
    return {
      ...row,
      rank: index + 1,
      gamesBehind,
    };
  });

  return [...ranked, ...unclaimed];
}

/** Build standings from roster + final matchup rows. */
export function buildLeagueStandings(
  members: LeagueStandingsMember[],
  options: BuildStandingsOptions,
  finals: FinalMatchupRecord[] = [],
  tiebreakers?: StandingsTiebreakerOptions | TiebreakerSettings | null,
): LeagueStandingsRow[] {
  const base = buildPlaceholderStandings(members, options);
  if (finals.length === 0) {
    return base;
  }
  return applyFinalMatchupsToStandings(base, finals, tiebreakers);
}
