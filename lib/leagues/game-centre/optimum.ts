import { slotAcceptsPlayer } from "@/lib/leagues/roster-slots";
import type { FilledRosterSlot, TeamRosterPlayer } from "@/lib/leagues/roster-fill";
import { hasNflTeamStarted } from "@/lib/leagues/waivers/game-lock";

export type OptimumSlotSuggestion = {
  slotPositionId: string;
  slotLabel: string;
  locked: boolean;
  currentPlayerId: string | null;
  currentPlayerName: string | null;
  currentProjectedPts: number | null;
  suggestedPlayerId: string | null;
  suggestedPlayerName: string | null;
  suggestedProjectedPts: number | null;
};

export type OptimumLineupResult = {
  slots: OptimumSlotSuggestion[];
  currentProjectedTotal: number;
  optimumProjectedTotal: number;
  canApply: boolean;
  /** Full roster assignments after applying optimum (unlocked moves only). */
  assignments: Array<{ playerId: string; slotPositionId: string }>;
};

function isStarted(
  player: TeamRosterPlayer | null | undefined,
  startedTeams: Set<string>,
): boolean {
  if (!player) return false;
  return hasNflTeamStarted(player.nflTeam, startedTeams);
}

function projectedPts(
  player: TeamRosterPlayer | null | undefined,
  projectedById: Map<string, number | null>,
): number {
  if (!player) return 0;
  return projectedById.get(player.id) ?? 0;
}

/**
 * Improve the current starting lineup using bench players with higher
 * weekly projections. Locked (in-game) starters stay put. Never benches a
 * starter unless a better eligible player takes their slot.
 */
export function computeOptimumLineup(input: {
  lineup: FilledRosterSlot[];
  rosterPlayers: TeamRosterPlayer[];
  projectedById: Map<string, number | null>;
  startedTeams: Set<string>;
  irEligibleStatuses?: readonly string[];
}): OptimumLineupResult {
  const {
    lineup,
    rosterPlayers,
    projectedById,
    startedTeams,
    irEligibleStatuses,
  } = input;

  const assignment: Array<TeamRosterPlayer | null> = lineup.map(
    (slot) => slot.player,
  );
  const lockedIndexes = new Set<number>();
  for (let index = 0; index < lineup.length; index++) {
    const player = assignment[index];
    if (player && isStarted(player, startedTeams)) {
      lockedIndexes.add(index);
    }
  }

  const accepts = (slotPositionId: string, player: TeamRosterPlayer) =>
    slotAcceptsPlayer(slotPositionId, player.primaryPositionId, {
      injuryStatus: player.injuryStatus,
      irEligibleStatuses,
    });

  const starterIds = () =>
    new Set(
      assignment
        .filter((player): player is TeamRosterPlayer => player != null)
        .map((player) => player.id),
    );

  /** Unlocked roster players not currently assigned to a lineup slot. */
  const benchPool = () => {
    const inLineup = starterIds();
    return rosterPlayers.filter((player) => {
      if (inLineup.has(player.id)) return false;
      // Already-started players stay where they are (can't enter as upgrades).
      if (isStarted(player, startedTeams)) return false;
      return true;
    });
  };

  // Repeatedly promote the best bench upgrade (incl. filling empties).
  for (;;) {
    let bestGain = 0;
    let bestSlot = -1;
    let bestPlayer: TeamRosterPlayer | null = null;

    const bench = benchPool();
    for (let index = 0; index < lineup.length; index++) {
      if (lockedIndexes.has(index)) continue;
      const slotPositionId = lineup[index]!.slotPositionId;
      const current = assignment[index] ?? null;
      const currentPts = projectedPts(current, projectedById);

      for (const candidate of bench) {
        if (!accepts(slotPositionId, candidate)) continue;
        const gain = projectedPts(candidate, projectedById) - currentPts;
        if (gain > bestGain) {
          bestGain = gain;
          bestSlot = index;
          bestPlayer = candidate;
        }
      }
    }

    if (bestPlayer == null || bestSlot < 0 || bestGain <= 0) break;
    assignment[bestSlot] = bestPlayer;
  }

  const slots: OptimumSlotSuggestion[] = lineup.map((slot, index) => {
    const current = slot.player;
    const suggested = assignment[index] ?? null;
    const locked = lockedIndexes.has(index);
    return {
      slotPositionId: slot.slotPositionId,
      slotLabel: slot.slotPositionId,
      locked,
      currentPlayerId: current?.id ?? null,
      currentPlayerName: current?.fullName ?? null,
      currentProjectedPts: current
        ? (projectedById.get(current.id) ?? null)
        : null,
      suggestedPlayerId: suggested?.id ?? null,
      suggestedPlayerName: suggested?.fullName ?? null,
      suggestedProjectedPts: suggested
        ? (projectedById.get(suggested.id) ?? null)
        : null,
    };
  });

  const currentProjectedTotal = lineup.reduce(
    (sum, slot) => sum + projectedPts(slot.player, projectedById),
    0,
  );
  const optimumProjectedTotal = assignment.reduce(
    (sum, player) => sum + projectedPts(player, projectedById),
    0,
  );

  let canApply = false;
  for (const slot of slots) {
    if (slot.locked) continue;
    if (slot.currentPlayerId !== slot.suggestedPlayerId) {
      canApply = true;
      break;
    }
  }

  const suggestedSlotByPlayerId = new Map<string, string>();
  for (let index = 0; index < lineup.length; index++) {
    const player = assignment[index];
    if (player) {
      suggestedSlotByPlayerId.set(player.id, lineup[index]!.slotPositionId);
    }
  }

  const assignments = rosterPlayers.map((player) => {
    const lockedStarter = lineup.some(
      (slot) =>
        slot.player?.id === player.id && isStarted(player, startedTeams),
    );
    if (lockedStarter) {
      return {
        playerId: player.id,
        slotPositionId: player.slotPositionId ?? player.primaryPositionId,
      };
    }
    return {
      playerId: player.id,
      slotPositionId: suggestedSlotByPlayerId.get(player.id) ?? "BN",
    };
  });

  return {
    slots,
    currentProjectedTotal: Math.round(currentProjectedTotal * 100) / 100,
    optimumProjectedTotal: Math.round(optimumProjectedTotal * 100) / 100,
    canApply,
    assignments,
  };
}
