import type { LeagueStandingsRow } from "@/lib/leagues/standings";
import {
  simulatePlayoffOdds,
  type RemainingMatchup,
} from "@/lib/leagues/playoff-odds";
import {
  resolvePlayoffPictureByTeam,
  type PlayoffPictureStatus,
} from "@/lib/leagues/playoff-picture";
import { computeSosByTeam, resolveTeamStrengthForSos, type SosMatchupSide } from "@/lib/leagues/sos";

export type LeaguePlayoffStandingsRow = LeagueStandingsRow & {
  seed: number;
  /** Chance of making the playoffs (0–1). */
  playoffOdds: number | null;
  playoffStatus: PlayoffPictureStatus | null;
};

/** Seed number for the last playoff berth, or null when playoffs are off. */
export function resolvePlayoffCutoffSeed(input: {
  enabled: boolean;
  playoffTeamCount: number;
  teamCount: number;
}): number | null {
  if (!input.enabled) {
    return null;
  }
  const cutoff = Math.min(
    Math.max(0, input.playoffTeamCount),
    Math.max(0, input.teamCount),
  );
  return cutoff > 0 ? cutoff : null;
}

/** Attach SOS from projected opponent strength (PF → expected win%). */
export function attachSosToStandings(
  rows: LeagueStandingsRow[],
  matchups: SosMatchupSide[],
  projectedWeeklyPfByTeamId: Map<string, number> = new Map(),
): LeagueStandingsRow[] {
  const teamIds = rows
    .filter((row): row is LeagueStandingsRow & { teamId: string } =>
      Boolean(row.teamId && row.claimed),
    )
    .map((row) => row.teamId);

  const pointsForAvgByTeamId = new Map<string, number>();
  for (const row of rows) {
    if (row.teamId && row.claimed) {
      pointsForAvgByTeamId.set(row.teamId, row.pointsForAvg);
    }
  }

  // Ensure every claimed team has a strength entry (0 if unknown → .500 field).
  const projected = new Map(projectedWeeklyPfByTeamId);
  for (const teamId of teamIds) {
    if (!projected.has(teamId)) projected.set(teamId, 0);
  }

  const strengthByTeamId = resolveTeamStrengthForSos({
    teamIds,
    pointsForAvgByTeamId,
    projectedWeeklyPfByTeamId: projected,
  });

  const sosByTeam = computeSosByTeam({ matchups, strengthByTeamId });
  return rows.map((row) => {
    if (!row.teamId || !row.claimed) {
      return {
        ...row,
        sos: null,
        sosPlayed: null,
        sosRemaining: null,
      };
    }
    const sos = sosByTeam.get(row.teamId);
    return {
      ...row,
      sos: sos?.overall ?? null,
      sosPlayed: sos?.played ?? null,
      sosRemaining: sos?.remaining ?? null,
    };
  });
}

/** Attach 1-based seeds + playoff odds/status from current standings order. */
export function buildPlayoffStandingsRows(
  rows: LeagueStandingsRow[],
  options?: {
    playoffSpots?: number;
    remainingMatchups?: RemainingMatchup[];
    strengthByTeamId?: Map<string, number>;
  },
): LeaguePlayoffStandingsRow[] {
  const playoffSpots = options?.playoffSpots ?? 0;
  const remainingMatchups = options?.remainingMatchups ?? [];
  const strengthByTeamId = options?.strengthByTeamId;

  const remainingGamesByTeamId = new Map<string, number>();
  for (const matchup of remainingMatchups) {
    remainingGamesByTeamId.set(
      matchup.homeTeamId,
      (remainingGamesByTeamId.get(matchup.homeTeamId) ?? 0) + 1,
    );
    remainingGamesByTeamId.set(
      matchup.awayTeamId,
      (remainingGamesByTeamId.get(matchup.awayTeamId) ?? 0) + 1,
    );
  }

  const pictureByTeamId =
    playoffSpots > 0
      ? resolvePlayoffPictureByTeam({
          rows,
          remainingGamesByTeamId,
          playoffSpots,
        })
      : new Map<string, PlayoffPictureStatus>();

  const oddsByTeamId =
    playoffSpots > 0
      ? simulatePlayoffOdds({
          rows,
          remainingMatchups,
          playoffSpots,
          pictureByTeamId,
          strengthByTeamId,
        })
      : new Map<string, number>();

  return rows.map((row, index) => ({
    ...row,
    seed: index + 1,
    playoffOdds:
      row.teamId && row.claimed
        ? (oddsByTeamId.get(row.teamId) ?? null)
        : null,
    playoffStatus:
      row.teamId && row.claimed
        ? (pictureByTeamId.get(row.teamId) ?? null)
        : null,
  }));
}
