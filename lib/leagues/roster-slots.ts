import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { isPlayerIrEligible } from "@/lib/leagues/ir-eligibility";
import {
  isFlexEligible,
  validateActiveRosterCaps,
} from "@/lib/leagues/roster-capacity";
import type { RosterAssignmentOption } from "@/lib/leagues/roster-display";

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
  },
) {
  if (slotPositionId === "BN" || slotPositionId === "TAXI") {
    return true;
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
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  taxiEnabled: boolean;
  occupiedBySlot: Map<string, number>;
}) {
  const candidates = [
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
};

/** Apply a slot change in memory, bumping an occupant to BN when the target is full. */
export function applyLocalSlotAssignment<T extends SlotAssignmentPlayer>(
  players: T[],
  playerId: string,
  slotPositionId: string,
  rosterSlots: RosterSlotConfig[],
  benchSlots: number,
  irEligibleStatuses: readonly string[] = [],
): { players: T[] } | { error: string } {
  const player = players.find((row) => row.id === playerId);
  if (!player) {
    return { error: "Player is not on your roster." };
  }

  if (
    !slotAcceptsPlayer(slotPositionId, player.primaryPositionId, {
      injuryStatus: player.injuryStatus,
      irEligibleStatuses,
    })
  ) {
    if (slotPositionId === "IR") {
      return { error: "Player is not eligible for IR." };
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
      displaced.slotPositionId = "BN";
    }
  }

  const target = next.find((row) => row.id === playerId);
  if (target) {
    target.slotPositionId = slotPositionId;
  }

  const caps = validateActiveRosterCaps(next, rosterSlots, benchSlots);
  if (!caps.ok) {
    return { error: caps.error };
  }

  return { players: next };
}
