import { isFlexEligible } from "@/lib/leagues/roster-capacity";
import type { FilledRosterSlot, TeamRosterPlayer } from "@/lib/leagues/roster-fill";
import { computeOptimumLineup } from "@/lib/leagues/game-centre/optimum";
import {
  formatOrdinalRank,
  rankPowerScore,
  rankTone,
  slotRankFromOverall,
} from "@/lib/leagues/roster-evaluation/rank";
import type { StarterSlotSpec } from "@/lib/leagues/roster-evaluation/slot-specs";
import type {
  EvaluationRankRow,
  PositionStrengthPoint,
  StartingLineupSlot,
} from "@/lib/leagues/roster-evaluation/types";

export type RankablePlayer = {
  id: string;
  fullName: string;
  primaryPositionId: string;
  sleeperId: string | null;
  /** League-scored fantasy points used for ordering (higher = better). */
  fantasyPts: number;
};

export type TeamRosterForEvaluation = {
  teamId: string;
  players: RankablePlayer[];
  lineup: FilledRosterSlot[];
  bench: FilledRosterSlot[];
  /** Full roster rows for optimum (needs TeamRosterPlayer shape). */
  rosterPlayers: TeamRosterPlayer[];
};

/**
 * 1-based overall ranks among `players` sorted by fantasyPts desc.
 */
export function overallRanksByPlayerId(
  players: RankablePlayer[],
): Map<string, number> {
  const sorted = [...players].sort((a, b) => {
    if (b.fantasyPts !== a.fantasyPts) return b.fantasyPts - a.fantasyPts;
    return a.fullName.localeCompare(b.fullName);
  });
  const ranks = new Map<string, number>();
  sorted.forEach((player, index) => {
    ranks.set(player.id, index + 1);
  });
  return ranks;
}

export function poolPlayersForPosition(
  positionId: string,
  allPlayers: RankablePlayer[],
): RankablePlayer[] {
  if (positionId === "FLEX") {
    return allPlayers.filter((player) =>
      isFlexEligible(player.primaryPositionId),
    );
  }
  return allPlayers.filter(
    (player) => player.primaryPositionId === positionId,
  );
}

function playerInLineupSlot(
  lineup: FilledRosterSlot[],
  positionId: string,
  depthIndex: number,
): RankablePlayer | null {
  let seen = 0;
  for (const slot of lineup) {
    if (slot.slotPositionId !== positionId) continue;
    if (seen === depthIndex) {
      if (!slot.player) return null;
      return {
        id: slot.player.id,
        fullName: slot.player.fullName,
        primaryPositionId: slot.player.primaryPositionId,
        sleeperId: slot.player.sleeperId,
        fantasyPts: 0,
      };
    }
    seen += 1;
  }
  return null;
}

export type BuildSlotRanksInput = {
  teamCount: number;
  slotSpecs: StarterSlotSpec[];
  focusLineup: FilledRosterSlot[];
  leaguePlayers: RankablePlayer[];
};

/**
 * Slot ranks for a specific lineup (current or optimal) vs league pools.
 */
export function buildStartingLineupRanks(
  input: BuildSlotRanksInput,
): StartingLineupSlot[] {
  const { teamCount, slotSpecs, focusLineup, leaguePlayers } = input;
  const n = Math.max(1, teamCount);

  const poolRanksByPosition = new Map<string, Map<string, number>>();
  for (const spec of slotSpecs) {
    if (poolRanksByPosition.has(spec.positionId)) continue;
    poolRanksByPosition.set(
      spec.positionId,
      overallRanksByPlayerId(
        poolPlayersForPosition(spec.positionId, leaguePlayers),
      ),
    );
  }

  return slotSpecs.map((spec) => {
    const placed = playerInLineupSlot(
      focusLineup,
      spec.positionId,
      spec.depthIndex,
    );
    const poolRanks = poolRanksByPosition.get(spec.positionId) ?? new Map();

    let rank = n;
    let playerName = "Empty";
    let sleeperId: string | null = null;

    if (placed) {
      playerName = placed.fullName;
      sleeperId = placed.sleeperId;
      const overall = poolRanks.get(placed.id);
      if (overall != null) {
        rank = slotRankFromOverall(overall, spec.depthIndex, n);
      }
    }

    return {
      slotLabel: spec.slotLabel,
      playerName,
      sleeperId,
      rank,
      powerScore: rankPowerScore(rank, n),
      tone: rankTone(rank, n),
    };
  });
}

export function startingLineupToRankRows(
  slots: StartingLineupSlot[],
): EvaluationRankRow[] {
  return slots.map((slot) => ({
    label: slot.slotLabel,
    rank: slot.rank,
    rankLabel: formatOrdinalRank(slot.rank),
    powerScore: slot.powerScore,
    tone: slot.tone,
  }));
}

/**
 * Apply projection-optimal starters (no game locks) onto empty lineup shells.
 */
export function buildOptimalFilledLineup(input: {
  lineup: FilledRosterSlot[];
  rosterPlayers: TeamRosterPlayer[];
  projectedById: Map<string, number | null>;
  irEligibleStatuses?: readonly string[] | null;
}): FilledRosterSlot[] {
  const optimum = computeOptimumLineup({
    lineup: input.lineup,
    rosterPlayers: input.rosterPlayers,
    projectedById: input.projectedById,
    startedTeams: new Set(),
    irEligibleStatuses: input.irEligibleStatuses ?? undefined,
  });
  const byId = new Map(
    input.rosterPlayers.map((player) => [player.id, player] as const),
  );

  return input.lineup.map((slot, index) => {
    const suggestedId = optimum.slots[index]?.suggestedPlayerId ?? null;
    return {
      ...slot,
      player: suggestedId ? (byId.get(suggestedId) ?? null) : null,
    };
  });
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * All rostered players at a primary position (depth, not lineup shells).
 */
export function playersForPositionalAverage(
  positionId: string,
  team: Pick<TeamRosterForEvaluation, "players">,
): RankablePlayer[] {
  return team.players.filter(
    (player) => player.primaryPositionId === positionId,
  );
}

/** Starters currently in shells for a position (FLEX = FLEX slots only). */
export function playersForRadarStarters(
  positionId: string,
  team: Pick<TeamRosterForEvaluation, "lineup">,
): RankablePlayer[] {
  return team.lineup.flatMap((slot) => {
    if (slot.slotPositionId !== positionId || !slot.player) return [];
    return [
      {
        id: slot.player.id,
        fullName: slot.player.fullName,
        primaryPositionId: slot.player.primaryPositionId,
        sleeperId: slot.player.sleeperId,
        fantasyPts: 0,
      },
    ];
  });
}

/** Bench players at a position (FLEX = flex-eligible on bench). */
export function playersForRadarBench(
  positionId: string,
  team: Pick<TeamRosterForEvaluation, "bench">,
): RankablePlayer[] {
  return team.bench.flatMap((slot) => {
    if (!slot.player) return [];
    const matches =
      positionId === "FLEX"
        ? isFlexEligible(slot.player.primaryPositionId)
        : slot.player.primaryPositionId === positionId;
    if (!matches) return [];
    return [
      {
        id: slot.player.id,
        fullName: slot.player.fullName,
        primaryPositionId: slot.player.primaryPositionId,
        sleeperId: slot.player.sleeperId,
        fantasyPts: 0,
      },
    ];
  });
}

function overallRankForPositionalPlayer(
  positionId: string,
  player: RankablePlayer,
  poolRanksByKey: Map<string, Map<string, number>>,
): number | null {
  return poolRanksByKey.get(positionId)?.get(player.id) ?? null;
}

function teamRankFromAverages(
  focusTeamId: string,
  averages: Map<string, number>,
  teamCount: number,
): number {
  const n = Math.max(1, teamCount);
  const ordered = [...averages.entries()].sort((a, b) => {
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[0].localeCompare(b[0]);
  });
  for (let index = 0; index < ordered.length; index += 1) {
    if (ordered[index]![0] === focusTeamId) return index + 1;
  }
  return n;
}

function cohortAverageRank(
  members: RankablePlayer[],
  label: string,
  poolRanksByKey: Map<string, Map<string, number>>,
): number {
  const ranks = members
    .map((player) =>
      overallRankForPositionalPlayer(label, player, poolRanksByKey),
    )
    .filter((rank): rank is number => rank != null);
  return mean(ranks) ?? Number.POSITIVE_INFINITY;
}

/**
 * Radar: starters vs bench league ranks at each position (1 = outer / 100).
 */
export function buildPositionStrength(input: {
  teamCount: number;
  focusTeamId: string;
  positions: string[];
  teams: TeamRosterForEvaluation[];
  leaguePlayers: RankablePlayer[];
}): PositionStrengthPoint[] {
  const { teamCount, focusTeamId, positions, teams, leaguePlayers } = input;
  const n = Math.max(1, teamCount);

  const poolRanksByKey = new Map<string, Map<string, number>>();
  for (const position of positions) {
    poolRanksByKey.set(
      position,
      overallRanksByPlayerId(
        poolPlayersForPosition(position, leaguePlayers),
      ),
    );
  }

  return positions.map((position) => {
    const starterAvgs = new Map<string, number>();
    const benchAvgs = new Map<string, number>();

    for (const team of teams) {
      starterAvgs.set(
        team.teamId,
        cohortAverageRank(
          playersForRadarStarters(position, team),
          position,
          poolRanksByKey,
        ),
      );
      benchAvgs.set(
        team.teamId,
        cohortAverageRank(
          playersForRadarBench(position, team),
          position,
          poolRanksByKey,
        ),
      );
    }

    const focusTeam = teams.find((team) => team.teamId === focusTeamId);
    const hasStarters = focusTeam
      ? playersForRadarStarters(position, focusTeam).length > 0
      : false;
    const hasBench = focusTeam
      ? playersForRadarBench(position, focusTeam).length > 0
      : false;

    const startersRank = teamRankFromAverages(focusTeamId, starterAvgs, n);
    const benchRank = teamRankFromAverages(focusTeamId, benchAvgs, n);

    return {
      position,
      starters: hasStarters ? rankPowerScore(startersRank, n) : 0,
      bench: hasBench ? rankPowerScore(benchRank, n) : 0,
      startersRank,
      benchRank,
      hasStarters,
      hasBench,
    };
  });
}

/**
 * Rank teams by mean overall player rank at a position (lower average = better).
 * Uses all rostered players at that primary position (starters + bench).
 * Example: QB1 + QB8 → avg 4.5, then ordered vs other teams' QB averages.
 */
export function buildPositionalRankings(input: {
  teamCount: number;
  focusTeamId: string;
  /** Primary positions only: QB, RB, WR, TE, K, DEF, IDP… (no FLEX / STARTERS / BENCH). */
  positionLabels: string[];
  teams: TeamRosterForEvaluation[];
  leaguePlayers: RankablePlayer[];
}): EvaluationRankRow[] {
  const { teamCount, focusTeamId, positionLabels, teams, leaguePlayers } =
    input;
  const n = Math.max(1, teamCount);

  const poolRanksByKey = new Map<string, Map<string, number>>();
  for (const positionId of positionLabels) {
    poolRanksByKey.set(
      positionId,
      overallRanksByPlayerId(
        poolPlayersForPosition(positionId, leaguePlayers),
      ),
    );
  }

  return positionLabels.map((positionId) => {
    const averages = new Map<string, number>();
    for (const team of teams) {
      const members = playersForPositionalAverage(positionId, team);
      const ranks = members
        .map((player) =>
          overallRankForPositionalPlayer(positionId, player, poolRanksByKey),
        )
        .filter((rank): rank is number => rank != null);
      const avg = mean(ranks);
      // No players at position → worst possible average.
      averages.set(team.teamId, avg ?? Number.POSITIVE_INFINITY);
    }

    const ordered = [...averages.entries()].sort((a, b) => {
      if (a[1] !== b[1]) return a[1] - b[1];
      return a[0].localeCompare(b[0]);
    });

    let rank = n;
    for (let index = 0; index < ordered.length; index += 1) {
      if (ordered[index]![0] === focusTeamId) {
        rank = index + 1;
        break;
      }
    }

    return {
      label: positionId,
      rank,
      rankLabel: formatOrdinalRank(rank),
      powerScore: rankPowerScore(rank, n),
      tone: rankTone(rank, n),
    };
  });
}

/** Unique primary positions from starter settings (excludes FLEX). */
export function buildPositionalLabels(
  slotSpecs: StarterSlotSpec[],
): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const spec of slotSpecs) {
    if (spec.positionId === "FLEX") continue;
    if (seen.has(spec.positionId)) continue;
    seen.add(spec.positionId);
    labels.push(spec.positionId);
  }
  return labels;
}
