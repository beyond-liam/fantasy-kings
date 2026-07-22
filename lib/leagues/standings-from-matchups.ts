import type { FinalMatchupRecord } from "@/lib/leagues/standings";
import {
  buildPlaceholderStandings,
  type BuildStandingsOptions,
  type LeagueStandingsMember,
  type LeagueStandingsRow,
} from "@/lib/leagues/standings";

const TIE_EPSILON = 0.05;

type TeamAccum = {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Chronological results for streak (oldest → newest). */
  results: Array<"W" | "L" | "T">;
};

function emptyAccum(): TeamAccum {
  return {
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    results: [],
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

function compareStandingsRows(a: LeagueStandingsRow, b: LeagueStandingsRow) {
  if (a.claimed !== b.claimed) {
    return a.claimed ? -1 : 1;
  }
  if (b.winPct !== a.winPct) {
    return b.winPct - a.winPct;
  }
  if (b.pointsFor !== a.pointsFor) {
    return b.pointsFor - a.pointsFor;
  }
  if (b.pointsAgainst !== a.pointsAgainst) {
    return a.pointsAgainst - b.pointsAgainst;
  }
  return a.teamName.localeCompare(b.teamName);
}

/**
 * Overlay final H2H results onto placeholder standings (roster / FAAB / draft order).
 * Unclaimed slots stay at the bottom with empty records.
 */
export function applyFinalMatchupsToStandings(
  baseRows: LeagueStandingsRow[],
  finals: FinalMatchupRecord[],
): LeagueStandingsRow[] {
  const byTeam = new Map<string, TeamAccum>();

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

    home.pointsFor += matchup.homePts;
    home.pointsAgainst += matchup.awayPts;
    away.pointsFor += matchup.awayPts;
    away.pointsAgainst += matchup.homePts;

    const diff = matchup.homePts - matchup.awayPts;
    if (Math.abs(diff) <= TIE_EPSILON) {
      home.ties += 1;
      away.ties += 1;
      home.results.push("T");
      away.results.push("T");
    } else if (diff > 0) {
      home.wins += 1;
      away.losses += 1;
      home.results.push("W");
      away.results.push("L");
    } else {
      away.wins += 1;
      home.losses += 1;
      away.results.push("W");
      home.results.push("L");
    }

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
    };
  });

  const claimed = withRecords
    .filter((row) => row.claimed)
    .toSorted(compareStandingsRows);
  const unclaimed = withRecords.filter((row) => !row.claimed);

  const leader = claimed[0] ?? null;
  const ranked = claimed.map((row, index) => {
    let gamesBehind: number | null = null;
    if (leader && row.teamId !== leader.teamId) {
      const gb =
        leader.wins -
        row.wins +
        (row.losses - leader.losses) / 2;
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
): LeagueStandingsRow[] {
  const base = buildPlaceholderStandings(members, options);
  if (finals.length === 0) {
    return base;
  }
  return applyFinalMatchupsToStandings(base, finals);
}
