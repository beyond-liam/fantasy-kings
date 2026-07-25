import { matchupHomeWinProbability } from "@/lib/leagues/playoff-odds";
import { formatWinPct } from "@/lib/leagues/standings";

/** One side of a regular-season H2H pairing. */
export type SosMatchupSide = {
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  /** True when the game has a final result. */
  played: boolean;
};

export type TeamSos = {
  /** All regular-season opponents (played + remaining), game-weighted. */
  overall: number | null;
  played: number | null;
  remaining: number | null;
};

function averageValues(
  opponentIds: string[],
  valueByTeamId: Map<string, number>,
): number | null {
  if (opponentIds.length === 0) return null;
  let total = 0;
  for (const opponentId of opponentIds) {
    total += valueByTeamId.get(opponentId) ?? 0.5;
  }
  return Math.round((total / opponentIds.length) * 10000) / 10000;
}

/**
 * Convert weekly projected PF (or PF/G) into an expected win% vs the field.
 * Uses the same logistic as playoff-odds matchup probs.
 */
export function projectedWinPctFromStrength(
  strengthByTeamId: Map<string, number>,
): Map<string, number> {
  const teamIds = [...strengthByTeamId.keys()];
  const result = new Map<string, number>();
  if (teamIds.length === 0) return result;

  if (teamIds.length === 1) {
    result.set(teamIds[0]!, 0.5);
    return result;
  }

  for (const teamId of teamIds) {
    const self = strengthByTeamId.get(teamId) ?? 0;
    let total = 0;
    let count = 0;
    for (const otherId of teamIds) {
      if (otherId === teamId) continue;
      const other = strengthByTeamId.get(otherId) ?? 0;
      total += matchupHomeWinProbability(self, other);
      count += 1;
    }
    result.set(
      teamId,
      count === 0 ? 0.5 : Math.round((total / count) * 10000) / 10000,
    );
  }
  return result;
}

/** Build played/remaining opponent lists per team from regular-season matchups. */
export function collectSosOpponents(
  matchups: SosMatchupSide[],
): Map<string, { played: string[]; remaining: string[] }> {
  const byTeam = new Map<string, { played: string[]; remaining: string[] }>();

  function ensure(teamId: string) {
    let entry = byTeam.get(teamId);
    if (!entry) {
      entry = { played: [], remaining: [] };
      byTeam.set(teamId, entry);
    }
    return entry;
  }

  for (const matchup of matchups) {
    const home = ensure(matchup.homeTeamId);
    const away = ensure(matchup.awayTeamId);
    if (matchup.played) {
      home.played.push(matchup.awayTeamId);
      away.played.push(matchup.homeTeamId);
    } else {
      home.remaining.push(matchup.awayTeamId);
      away.remaining.push(matchup.homeTeamId);
    }
  }

  return byTeam;
}

/**
 * Strength of schedule = average opponent projected win% (higher = harder).
 * Pre-season (no games played): overall === remaining.
 */
export function computeTeamSos(input: {
  playedOpponentIds: string[];
  remainingOpponentIds: string[];
  /** Projected (or blended) win% by team, 0–1. */
  projectedWinPctByTeamId: Map<string, number>;
}): TeamSos {
  const played = averageValues(
    input.playedOpponentIds,
    input.projectedWinPctByTeamId,
  );
  const remaining = averageValues(
    input.remainingOpponentIds,
    input.projectedWinPctByTeamId,
  );
  const overall = averageValues(
    [...input.playedOpponentIds, ...input.remainingOpponentIds],
    input.projectedWinPctByTeamId,
  );
  return { overall, played, remaining };
}

export function computeSosByTeam(input: {
  matchups: SosMatchupSide[];
  /** Weekly projected PF (or PF/G) by team. */
  strengthByTeamId: Map<string, number>;
}): Map<string, TeamSos> {
  const projectedWinPctByTeamId = projectedWinPctFromStrength(
    input.strengthByTeamId,
  );
  const opponents = collectSosOpponents(input.matchups);
  const result = new Map<string, TeamSos>();
  for (const [teamId, lists] of opponents) {
    result.set(
      teamId,
      computeTeamSos({
        playedOpponentIds: lists.played,
        remainingOpponentIds: lists.remaining,
        projectedWinPctByTeamId,
      }),
    );
  }
  return result;
}

/**
 * Prefer actual PF/G once games exist; otherwise use projected weekly PF.
 * Ensures pre-season SOS is non-zero when projections exist (or .500 if flat).
 */
export function resolveTeamStrengthForSos(input: {
  teamIds: string[];
  pointsForAvgByTeamId: Map<string, number>;
  projectedWeeklyPfByTeamId: Map<string, number>;
}): Map<string, number> {
  const result = new Map<string, number>();
  for (const teamId of input.teamIds) {
    const actual = input.pointsForAvgByTeamId.get(teamId) ?? 0;
    const projected = input.projectedWeeklyPfByTeamId.get(teamId) ?? 0;
    result.set(teamId, actual > 0 ? actual : projected);
  }
  return result;
}

export function formatSos(value: number | null | undefined) {
  if (value == null) return null;
  return formatWinPct(value);
}
