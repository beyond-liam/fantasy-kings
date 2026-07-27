import type { TeamSpotlightRow } from "@/components/leagues/team-spotlight";
import type { FinalMatchupRecord } from "@/lib/leagues/standings";
import { expandFinalMatchupRowsWithOpponent } from "@/lib/leagues/matchups/expand-finals";

export type HofTeamIdentity = {
  teamId: string;
  teamPublicId: string | null;
  teamName: string;
  ownerName: string;
  logoUrl: string | null;
  claimed: boolean;
  divisionId?: string | null;
};

export type HofDivision = {
  id: string;
  name: string;
  sortOrder: number;
};

export type HofDivisionWinnerRow = {
  seasonYear: number;
  divisionId: string;
  divisionName: string;
  teamId: string;
  teamPublicId: string | null;
  teamName: string;
  ownerName: string;
  logoUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
};

export type HofAllTimeRow = {
  teamId: string;
  teamPublicId: string | null;
  teamName: string;
  ownerName: string;
  logoUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
};

export type HofWinningScore = TeamSpotlightRow & {
  week: number;
  opponentName: string;
};

export type LeagueHallOfFameData = {
  mostTitles: TeamSpotlightRow | null;
  /** Division titles when multi-division; otherwise #1 seed / RS titles. */
  middleHonor: TeamSpotlightRow | null;
  middleHonorKind: "division_titles" | "regular_season_titles";
  mostRegularSeasonWins: TeamSpotlightRow | null;
  allTimeTable: HofAllTimeRow[];
  chokeArtist: TeamSpotlightRow | null;
  fergieTime: TeamSpotlightRow | null;
  luckiest: TeamSpotlightRow | null;
  highestWinningScore: HofWinningScore | null;
  lowestWinningScore: HofWinningScore | null;
};

function emptyStats() {
  return { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 };
}

export function buildAllTimeTable(
  teams: HofTeamIdentity[],
  finals: FinalMatchupRecord[],
): HofAllTimeRow[] {
  const byId = new Map(
    teams.filter((t) => t.claimed).map((t) => [t.teamId, { ...emptyStats() }]),
  );

  const expandedRows = expandFinalMatchupRowsWithOpponent(finals);
  for (const row of expandedRows) {
    const stats = byId.get(row.teamId);
    if (!stats) continue;

    stats.pointsFor += row.pts;
    stats.pointsAgainst += row.opponentPts;

    if (row.pts > row.opponentPts) {
      stats.wins += 1;
    } else if (row.pts < row.opponentPts) {
      stats.losses += 1;
    } else {
      stats.ties += 1;
    }
  }

  return teams
    .filter((t) => t.claimed && byId.has(t.teamId))
    .map((t) => {
      const s = byId.get(t.teamId)!;
      const games = s.wins + s.losses + s.ties;
      return {
        teamId: t.teamId,
        teamPublicId: t.teamPublicId,
        teamName: t.teamName,
        ownerName: t.ownerName,
        logoUrl: t.logoUrl,
        wins: s.wins,
        losses: s.losses,
        ties: s.ties,
        winPct: games === 0 ? 0 : (s.wins + s.ties * 0.5) / games,
        pointsFor: Math.round(s.pointsFor * 10) / 10,
        pointsAgainst: Math.round(s.pointsAgainst * 10) / 10,
      };
    })
    .toSorted(
      (a, b) =>
        b.winPct - a.winPct ||
        b.pointsFor - a.pointsFor ||
        a.teamName.localeCompare(b.teamName),
    );
}

export function pickMostRegularSeasonWins(
  rows: HofAllTimeRow[],
): TeamSpotlightRow | null {
  if (rows.length === 0) return null;
  const best = rows.toSorted(
    (a, b) =>
      b.wins - a.wins ||
      b.winPct - a.winPct ||
      a.teamName.localeCompare(b.teamName),
  )[0]!;
  if (best.wins <= 0) return null;
  return {
    teamId: best.teamId,
    teamPublicId: best.teamPublicId,
    teamName: best.teamName,
    ownerName: best.ownerName,
    logoUrl: best.logoUrl,
    value: best.wins,
  };
}

export function pickWinningScoreExtremes(
  teams: HofTeamIdentity[],
  finals: FinalMatchupRecord[],
): {
  highest: HofWinningScore | null;
  lowest: HofWinningScore | null;
} {
  const teamById = new Map(teams.map((t) => [t.teamId, t]));
  let highest: HofWinningScore | null = null;
  let lowest: HofWinningScore | null = null;

  for (const m of finals) {
    if (m.homePts == null || m.awayPts == null) continue;
    if (m.homePts === m.awayPts) continue;

    const homeWon = m.homePts > m.awayPts;
    const winnerId = homeWon ? m.homeTeamId : m.awayTeamId;
    const loserId = homeWon ? m.awayTeamId : m.homeTeamId;
    const winnerPts = homeWon ? m.homePts : m.awayPts;
    const winner = teamById.get(winnerId);
    const loser = teamById.get(loserId);
    if (!winner?.claimed) continue;

    const row: HofWinningScore = {
      teamId: winner.teamId,
      teamPublicId: winner.teamPublicId,
      teamName: winner.teamName,
      ownerName: winner.ownerName,
      logoUrl: winner.logoUrl,
      value: Math.round(winnerPts * 10) / 10,
      week: m.week,
      opponentName: loser?.teamName ?? "Opponent",
    };

    if (!highest || row.value > highest.value) highest = row;
    if (!lowest || row.value < lowest.value) lowest = row;
  }

  return { highest, lowest };
}

/** Lucky = won while the opponent’s optimum lineup would have beaten your score. */
export function countLuckyWinsByTeam(
  finals: Array<
    FinalMatchupRecord & {
      homeOptimum?: number | null;
      awayOptimum?: number | null;
    }
  >,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of finals) {
    if (m.homePts == null || m.awayPts == null) continue;
    if (m.homePts === m.awayPts) continue;
    const homeWon = m.homePts > m.awayPts;
    if (homeWon && m.awayOptimum != null && m.awayOptimum > m.homePts) {
      counts.set(m.homeTeamId, (counts.get(m.homeTeamId) ?? 0) + 1);
    }
    if (!homeWon && m.homeOptimum != null && m.homeOptimum > m.awayPts) {
      counts.set(m.awayTeamId, (counts.get(m.awayTeamId) ?? 0) + 1);
    }
  }
  return counts;
}

export function pickTopCount(
  teams: HofTeamIdentity[],
  counts: Map<string, number>,
): TeamSpotlightRow | null {
  let best: TeamSpotlightRow | null = null;
  for (const team of teams) {
    if (!team.claimed) continue;
    const value = counts.get(team.teamId) ?? 0;
    if (value <= 0) continue;
    if (
      !best ||
      value > best.value ||
      (value === best.value &&
        team.teamName.localeCompare(best.teamName) < 0)
    ) {
      best = {
        teamId: team.teamId,
        teamPublicId: team.teamPublicId,
        teamName: team.teamName,
        ownerName: team.ownerName,
        logoUrl: team.logoUrl,
        value,
      };
    }
  }
  return best;
}

/**
 * Regular-season division champions: best win% (then PF) within each division.
 * Requires at least one win so empty seasons stay uncrowned.
 */
export function pickDivisionWinnersForSeason(input: {
  seasonYear: number;
  divisions: HofDivision[];
  allTimeTable: HofAllTimeRow[];
  teams: HofTeamIdentity[];
}): HofDivisionWinnerRow[] {
  const divisionByTeam = new Map(
    input.teams.map((t) => [t.teamId, t.divisionId ?? null]),
  );
  const ownerByTeam = new Map(input.teams.map((t) => [t.teamId, t]));
  const winners: HofDivisionWinnerRow[] = [];

  for (const division of input.divisions.toSorted(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  )) {
    const top = input.allTimeTable.find(
      (row) =>
        divisionByTeam.get(row.teamId) === division.id && row.wins > 0,
    );
    if (!top) continue;
    const identity = ownerByTeam.get(top.teamId);
    winners.push({
      seasonYear: input.seasonYear,
      divisionId: division.id,
      divisionName: division.name,
      teamId: top.teamId,
      teamPublicId: top.teamPublicId,
      teamName: top.teamName,
      ownerName: identity?.ownerName ?? top.ownerName,
      logoUrl: top.logoUrl,
      wins: top.wins,
      losses: top.losses,
      ties: top.ties,
      winPct: top.winPct,
      pointsFor: top.pointsFor,
    });
  }

  return winners;
}

export function countDivisionTitlesByTeam(
  winners: Array<{ teamId: string }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of winners) {
    counts.set(row.teamId, (counts.get(row.teamId) ?? 0) + 1);
  }
  return counts;
}
