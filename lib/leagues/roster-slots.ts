import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { isPlayerIrEligible } from "@/lib/leagues/ir-eligibility";
import {
  isFlexEligible,
  validateActiveRosterCaps,
} from "@/lib/leagues/roster-capacity";
import type { RosterAssignmentOption } from "@/lib/leagues/roster-display";
import {
  TAXI_ACTIVATED_BLOCK_MESSAGE,
  canMovePlayerToTaxi,
  isPlayerTaxiEligible,
} from "@/lib/leagues/taxi-eligibility";

/** Count rostered players by effective slot (explicit slot or primary position). */
export function occupiedBySlot(
  rows: Array<{ slotPositionId: string | null; primaryPositionId: string }>,
) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const slot = row.slotPositionId ?? row.primaryPositionId;
    map.set(slot, (map.get(slot) ?? 0) + 1);
  }
  return map;
}

/** Slot a player currently occupies — explicit assignment or their position. */
export function effectiveSlotPositionId(player: {
  slotPositionId: string | null;
  primaryPositionId: string;
}) {
  return player.slotPositionId ?? player.primaryPositionId;
}

export function isReserveSlot(slotPositionId: string) {
  return (
    slotPositionId === "BN" ||
    slotPositionId === "IR" ||
    slotPositionId === "TAXI"
  );
}

export function isActiveLineupSlot(slotPositionId: string) {
  return !isReserveSlot(slotPositionId);
}

export function slotAcceptsPlayer(
  slotPositionId: string,
  playerPositionId: string,
  options?: {
    injuryStatus?: string | null;
    irEligibleStatuses?: readonly string[];
    yearsExp?: number | null;
    taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
  },
) {
  if (slotPositionId === "BN") {
    return true;
  }
  if (slotPositionId === "TAXI") {
    return isPlayerTaxiEligible(
      options?.yearsExp,
      options?.taxiMaxYearsExp ?? 0,
    );
  }
  if (slotPositionId === "IR") {
    return isPlayerIrEligible(
      options?.injuryStatus,
      options?.irEligibleStatuses ?? [],
    );
  }
  if (slotPositionId === playerPositionId) {
    return true;
  }
  if (slotPositionId === "FLEX" && isFlexEligible(playerPositionId)) {
    return true;
  }
  return false;
}

export function getSlotCapacity(
  rosterSlots: RosterSlotConfig[],
  slotPositionId: string,
  fallbackBenchSlots = 0,
) {
  if (slotPositionId === "BN") {
    const fromSlots = rosterSlots
      .filter((slot) => slot.positionId === "BN")
      .reduce((sum, slot) => sum + Math.max(0, slot.slotCount), 0);
    return fromSlots > 0 ? fromSlots : Math.max(0, fallbackBenchSlots);
  }

  return rosterSlots
    .filter((slot) => slot.positionId === slotPositionId)
    .reduce((sum, slot) => sum + Math.max(0, slot.slotCount), 0);
}

export function countSlotOccupants(
  players: Array<{
    id: string;
    slotPositionId: string | null;
    primaryPositionId: string;
  }>,
  slotPositionId: string,
  excludePlayerId?: string,
) {
  return players.filter((player) => {
    if (excludePlayerId && player.id === excludePlayerId) {
      return false;
    }
    const slot = player.slotPositionId ?? player.primaryPositionId;
    return slot === slotPositionId;
  }).length;
}

/** Prefer natural starter slot, then FLEX, then bench. */
export function pickDefaultSlotPosition(input: {
  playerPositionId: string;
  injuryStatus?: string | null;
  irEligibleStatuses?: readonly string[];
  yearsExp?: number | null;
  taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  taxiEnabled: boolean;
  occupiedBySlot: Map<string, number>;
  /** When true (lineup locked), only consider BN / IR / TAXI. */
  reserveOnly?: boolean;
}) {
  const candidates = input.reserveOnly
    ? [
        "BN",
        ...(input.irEnabled ? ["IR"] : []),
        ...(input.taxiEnabled ? ["TAXI"] : []),
      ]
    : [
        input.playerPositionId,
        ...(isFlexEligible(input.playerPositionId) ? ["FLEX"] : []),
        "BN",
        ...(input.irEnabled ? ["IR"] : []),
        ...(input.taxiEnabled ? ["TAXI"] : []),
      ];

  for (const slotPositionId of candidates) {
    if (
      !slotAcceptsPlayer(slotPositionId, input.playerPositionId, {
        injuryStatus: input.injuryStatus,
        irEligibleStatuses: input.irEligibleStatuses,
        yearsExp: input.yearsExp,
        taxiMaxYearsExp: input.taxiMaxYearsExp,
      })
    ) {
      continue;
    }
    const capacity = getSlotCapacity(
      input.rosterSlots,
      slotPositionId,
      input.benchSlots,
    );
    const occupied = input.occupiedBySlot.get(slotPositionId) ?? 0;
    if (occupied < capacity) {
      return slotPositionId;
    }
  }

  return "BN";
}

export function filterAssignmentOptionsForPlayer(
  options: RosterAssignmentOption[],
  playerPositionId: string,
  eligibility?: {
    injuryStatus?: string | null;
    irEligibleStatuses?: readonly string[];
    yearsExp?: number | null;
    taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
    taxiActivated?: boolean;
    taxiPreventReaddAfterActivation?: boolean;
    /** Keep IR selectable when the player is already assigned there. */
    currentSlotPositionId?: string | null;
    rosterSlots?: RosterSlotConfig[];
    benchSlots?: number;
    rosterPlayers?: Array<{
      id: string;
      slotPositionId: string | null;
      primaryPositionId: string;
    }>;
    playerId?: string;
  },
) {
  const currentSlot =
    eligibility?.currentSlotPositionId ?? playerPositionId;
  const onReserve = isReserveSlot(currentSlot);

  return options.filter((option) => {
    if (
      option.value === "IR" &&
      eligibility?.currentSlotPositionId === "IR"
    ) {
      return true;
    }
    if (
      option.value === "TAXI" &&
      !canMovePlayerToTaxi({
        preventReaddAfterActivation:
          eligibility?.taxiPreventReaddAfterActivation === true,
        taxiActivated: eligibility?.taxiActivated === true,
        currentSlotPositionId: eligibility?.currentSlotPositionId,
      })
    ) {
      return false;
    }
    if (!slotAcceptsPlayer(option.value, playerPositionId, eligibility)) {
      return false;
    }

    // Reserve players can only move into open active lineup slots (no bumping).
    if (
      onReserve &&
      isActiveLineupSlot(option.value) &&
      eligibility?.rosterSlots &&
      eligibility.rosterPlayers
    ) {
      const capacity = getSlotCapacity(
        eligibility.rosterSlots,
        option.value,
        eligibility.benchSlots ?? 0,
      );
      const occupied = countSlotOccupants(
        eligibility.rosterPlayers,
        option.value,
        eligibility.playerId,
      );
      if (occupied >= capacity) {
        return false;
      }
    }

    return true;
  });
}

export type SlotAssignmentPlayer = {
  id: string;
  primaryPositionId: string;
  slotPositionId: string | null;
  injuryStatus?: string | null;
  yearsExp?: number | null;
  taxiActivated?: boolean;
};

/** Apply a slot change in memory. Full targets swap into the vacated slot when
 *  eligible; otherwise the occupant is bumped to bench. */
export function applyLocalSlotAssignment<T extends SlotAssignmentPlayer>(
  players: T[],
  playerId: string,
  slotPositionId: string,
  rosterSlots: RosterSlotConfig[],
  benchSlots: number,
  irEligibleStatuses: readonly string[] = [],
  taxiMaxYearsExp: 0 | 1 | 2 | 3 | 4 | 5 = 0,
  taxiPreventReaddAfterActivation = false,
): { players: T[] } | { error: string } {
  const player = players.find((row) => row.id === playerId);
  if (!player) {
    return { error: "Player is not on your roster." };
  }

  if (
    slotPositionId === "TAXI" &&
    !canMovePlayerToTaxi({
      preventReaddAfterActivation: taxiPreventReaddAfterActivation,
      taxiActivated: player.taxiActivated === true,
      currentSlotPositionId: player.slotPositionId,
    })
  ) {
    return { error: TAXI_ACTIVATED_BLOCK_MESSAGE };
  }

  if (
    !slotAcceptsPlayer(slotPositionId, player.primaryPositionId, {
      injuryStatus: player.injuryStatus,
      irEligibleStatuses,
      yearsExp: player.yearsExp,
      taxiMaxYearsExp,
    })
  ) {
    if (slotPositionId === "IR") {
      return { error: "Player is not eligible for IR." };
    }
    if (slotPositionId === "TAXI") {
      return { error: "Player is not eligible for Taxi." };
    }
    return {
      error: `${player.primaryPositionId} cannot play ${slotPositionId}.`,
    };
  }

  const capacity = getSlotCapacity(rosterSlots, slotPositionId, benchSlots);
  if (capacity <= 0) {
    return { error: "That slot is not available in this league." };
  }

  const currentSlot = player.slotPositionId ?? player.primaryPositionId;
  if (currentSlot === slotPositionId) {
    return { players };
  }

  const next = players.map((row) => ({ ...row }));
  const occupants = next.filter((row) => {
    if (row.id === playerId) return false;
    const slot = row.slotPositionId ?? row.primaryPositionId;
    return slot === slotPositionId;
  });

  if (occupants.length >= capacity) {
    // Bench / IR / Taxi cannot displace an active starter — need an open slot.
    if (isReserveSlot(currentSlot) && isActiveLineupSlot(slotPositionId)) {
      return {
        error: `No open ${slotPositionId} slots in the lineup.`,
      };
    }

    const displaced = occupants[0];
    if (displaced) {
      // Prefer filling the vacated slot (swap) so we don't empty a starter.
      const canTakeVacated =
        isActiveLineupSlot(currentSlot) &&
        slotAcceptsPlayer(currentSlot, displaced.primaryPositionId, {
          injuryStatus: displaced.injuryStatus,
          irEligibleStatuses,
          yearsExp: displaced.yearsExp,
          taxiMaxYearsExp,
        }) &&
        !(
          currentSlot === "TAXI" &&
          !canMovePlayerToTaxi({
            preventReaddAfterActivation: taxiPreventReaddAfterActivation,
            taxiActivated: displaced.taxiActivated === true,
            currentSlotPositionId: displaced.slotPositionId,
          })
        );

      if (canTakeVacated) {
        displaced.slotPositionId = currentSlot;
      } else {
        displaced.slotPositionId = "BN";
      }
    }
  }

  const target = next.find((row) => row.id === playerId);
  if (target) {
    target.slotPositionId = slotPositionId;
    if (currentSlot === "TAXI" && slotPositionId !== "TAXI") {
      target.taxiActivated = true;
    }
  }

  const caps = validateActiveRosterCaps(next, rosterSlots, benchSlots);
  if (!caps.ok) {
    return { error: caps.error };
  }

  return { players: next };
}

type SlotEligibility = {
  irEligibleStatuses?: readonly string[];
  taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
  taxiPreventReaddAfterActivation?: boolean;
};

function acceptsPlayer(
  slotPositionId: string,
  player: SlotAssignmentPlayer,
  eligibility: SlotEligibility,
) {
  if (
    slotPositionId === "TAXI" &&
    !canMovePlayerToTaxi({
      preventReaddAfterActivation:
        eligibility.taxiPreventReaddAfterActivation === true,
      taxiActivated: player.taxiActivated === true,
      currentSlotPositionId: player.slotPositionId,
    })
  ) {
    return false;
  }
  return slotAcceptsPlayer(slotPositionId, player.primaryPositionId, {
    injuryStatus: player.injuryStatus,
    irEligibleStatuses: eligibility.irEligibleStatuses ?? [],
    yearsExp: player.yearsExp,
    taxiMaxYearsExp: eligibility.taxiMaxYearsExp,
  });
}

/** Players who can trade places with the given slot, both directions eligible. */
export function findSwapCandidates<T extends SlotAssignmentPlayer>(
  players: T[],
  slotPositionId: string,
  playerId: string | null,
  eligibility: SlotEligibility = {},
): T[] {
  const player = playerId
    ? (players.find((row) => row.id === playerId) ?? null)
    : null;

  return players.filter((candidate) => {
    if (candidate.id === playerId) return false;
    const candidateSlot = effectiveSlotPositionId(candidate);
    if (candidateSlot === slotPositionId) return false;
    if (!acceptsPlayer(slotPositionId, candidate, eligibility)) return false;
    // The displaced player has to be able to take the candidate's slot back.
    return !player || acceptsPlayer(candidateSlot, player, eligibility);
  });
}

/** Trade two rostered players' slots in memory. */
export function applyLocalSlotSwap<T extends SlotAssignmentPlayer>(
  players: T[],
  playerId: string,
  otherPlayerId: string,
  rosterSlots: RosterSlotConfig[],
  benchSlots: number,
  irEligibleStatuses: readonly string[] = [],
  taxiMaxYearsExp: 0 | 1 | 2 | 3 | 4 | 5 = 0,
  taxiPreventReaddAfterActivation = false,
): { players: T[] } | { error: string } {
  const player = players.find((row) => row.id === playerId);
  const other = players.find((row) => row.id === otherPlayerId);
  if (!player || !other) {
    return { error: "Player is not on your roster." };
  }

  const eligibility = {
    irEligibleStatuses,
    taxiMaxYearsExp,
    taxiPreventReaddAfterActivation,
  };
  const playerSlot = effectiveSlotPositionId(player);
  const otherSlot = effectiveSlotPositionId(other);

  if (!acceptsPlayer(playerSlot, other, eligibility)) {
    if (playerSlot === "TAXI" && other.taxiActivated) {
      return { error: TAXI_ACTIVATED_BLOCK_MESSAGE };
    }
    return { error: `${other.primaryPositionId} cannot play ${playerSlot}.` };
  }
  if (!acceptsPlayer(otherSlot, player, eligibility)) {
    if (otherSlot === "TAXI" && player.taxiActivated) {
      return { error: TAXI_ACTIVATED_BLOCK_MESSAGE };
    }
    return { error: `${player.primaryPositionId} cannot play ${otherSlot}.` };
  }

  const next = players.map((row) => {
    if (row.id === playerId) {
      return {
        ...row,
        slotPositionId: otherSlot,
        taxiActivated:
          playerSlot === "TAXI" && otherSlot !== "TAXI"
            ? true
            : row.taxiActivated,
      };
    }
    if (row.id === otherPlayerId) {
      return {
        ...row,
        slotPositionId: playerSlot,
        taxiActivated:
          otherSlot === "TAXI" && playerSlot !== "TAXI"
            ? true
            : row.taxiActivated,
      };
    }
    return { ...row };
  });

  const caps = validateActiveRosterCaps(next, rosterSlots, benchSlots);
  if (!caps.ok) {
    return { error: caps.error };
  }

  return { players: next };
}
