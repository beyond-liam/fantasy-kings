import type { LeagueStandingsRow } from "@/lib/leagues/standings";
import type { PlayoffPictureStatus } from "@/lib/leagues/playoff-picture";

export type RemainingMatchup = {
  homeTeamId: string;
  awayTeamId: string;
};

type SimTeam = {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
};

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Home win probability from PF/G edge (logistic). */
export function matchupHomeWinProbability(
  homePfAvg: number,
  awayPfAvg: number,
): number {
  if (homePfAvg === 0 && awayPfAvg === 0) return 0.5;
  const diff = homePfAvg - awayPfAvg;
  return 1 / (1 + Math.exp(-diff / 8));
}

function rankSimTeams(teams: SimTeam[]): string[] {
  return teams
    .toSorted((a, b) => {
      const aGames = a.wins + a.losses + a.ties;
      const bGames = b.wins + b.losses + b.ties;
      const aPct = aGames === 0 ? 0 : (a.wins + 0.5 * a.ties) / aGames;
      const bPct = bGames === 0 ? 0 : (b.wins + 0.5 * b.ties) / bGames;
      if (bPct !== aPct) return bPct - aPct;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      return a.teamId.localeCompare(b.teamId);
    })
    .map((row) => row.teamId);
}

/**
 * Monte Carlo playoff-make odds from remaining regular-season matchups.
 * Returns 0–1 by teamId. Clinched/eliminated picture overrides when provided.
 */
export function simulatePlayoffOdds(input: {
  rows: LeagueStandingsRow[];
  remainingMatchups: RemainingMatchup[];
  playoffSpots: number;
  simulations?: number;
  seed?: number;
  pictureByTeamId?: Map<string, PlayoffPictureStatus>;
  /** Override PF/G for matchup probs (projected weekly PF pre-season). */
  strengthByTeamId?: Map<string, number>;
}): Map<string, number> {
  const {
    rows,
    remainingMatchups,
    playoffSpots,
    simulations = 2500,
    seed = 42,
    pictureByTeamId,
  } = input;

  const claimed = rows.filter(
    (row): row is LeagueStandingsRow & { teamId: string } =>
      Boolean(row.claimed && row.teamId),
  );
  const odds = new Map<string, number>();
  if (playoffSpots <= 0 || claimed.length === 0) {
    return odds;
  }

  if (remainingMatchups.length === 0) {
    for (const [index, row] of claimed.entries()) {
      const picture = pictureByTeamId?.get(row.teamId);
      if (picture === "clinched") odds.set(row.teamId, 1);
      else if (picture === "eliminated") odds.set(row.teamId, 0);
      else odds.set(row.teamId, index < playoffSpots ? 1 : 0);
    }
    return odds;
  }

  const pfAvgByTeam = new Map(
    claimed.map((row) => [
      row.teamId,
      input.strengthByTeamId?.get(row.teamId) ?? row.pointsForAvg,
    ] as const),
  );
  const makeCounts = new Map<string, number>(
    claimed.map((row) => [row.teamId, 0]),
  );  const random = mulberry32(seed);

  for (let sim = 0; sim < simulations; sim++) {
    const state = new Map<string, SimTeam>(
      claimed.map((row) => [
        row.teamId,
        {
          teamId: row.teamId,
          wins: row.wins,
          losses: row.losses,
          ties: row.ties,
          pointsFor: row.pointsFor,
        },
      ]),
    );

    for (const matchup of remainingMatchups) {
      const home = state.get(matchup.homeTeamId);
      const away = state.get(matchup.awayTeamId);
      if (!home || !away) continue;

      const pHome = matchupHomeWinProbability(
        pfAvgByTeam.get(matchup.homeTeamId) ?? 0,
        pfAvgByTeam.get(matchup.awayTeamId) ?? 0,
      );
      if (random() < pHome) {
        home.wins += 1;
        away.losses += 1;
      } else {
        away.wins += 1;
        home.losses += 1;
      }
    }

    const ranked = rankSimTeams([...state.values()]);
    for (let i = 0; i < Math.min(playoffSpots, ranked.length); i++) {
      const teamId = ranked[i]!;
      makeCounts.set(teamId, (makeCounts.get(teamId) ?? 0) + 1);
    }
  }

  for (const row of claimed) {
    const picture = pictureByTeamId?.get(row.teamId);
    if (picture === "clinched") {
      odds.set(row.teamId, 1);
      continue;
    }
    if (picture === "eliminated") {
      odds.set(row.teamId, 0);
      continue;
    }
    odds.set(row.teamId, (makeCounts.get(row.teamId) ?? 0) / simulations);
  }

  return odds;
}

export function formatPlayoffOdds(value: number | null | undefined) {
  if (value == null) return null;
  return `${Math.round(value * 100)}%`;
}
