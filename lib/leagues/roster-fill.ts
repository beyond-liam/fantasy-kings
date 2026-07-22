import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import {
  resolveIrEligibleStatuses,
  type IrEligibleStatusId,
} from "@/lib/leagues/ir-eligibility";
import {
  buildEmptyRosterSections,
  type EmptyRosterSlot,
  type EmptyRosterSections,
} from "@/lib/leagues/roster-display";
import { rosterPositionSortIndex } from "@/lib/leagues/roster-position-order";
import { slotAcceptsPlayer } from "@/lib/leagues/roster-slots";

import type { PlayerOpponent } from "@/lib/nfl/matchups";

export type TeamRosterPlayer = {
  id: string;
  fullName: string;
  nflTeam: string | null;
  primaryPositionId: string;
  byeWeek: number | null;
  injuryStatus: string | null;
  sleeperId: string | null;
  slotPositionId: string | null;
  ownedPct?: number | null;
  startPct?: number | null;
  opponent?: PlayerOpponent | null;
  /** This week's scored points (only show when game is live/final). */
  actualPts?: number | null;
  /** This week's projected points. */
  projectedPts?: number | null;
};

export type FilledRosterSlot = EmptyRosterSlot & {
  player: TeamRosterPlayer | null;
};

export type FilledRosterSections = {
  lineup: FilledRosterSlot[];
  bench: FilledRosterSlot[];
  ir: FilledRosterSlot[] | null;
  taxi: FilledRosterSlot[] | null;
};

function benchPositionRank(positionId: string) {
  return rosterPositionSortIndex(positionId);
}

function sortSlotsByActualPoints(slots: FilledRosterSlot[]): FilledRosterSlot[] {
  const withPlayers: FilledRosterSlot[] = [];
  const empty: FilledRosterSlot[] = [];

  for (const slot of slots) {
    if (slot.player) {
      withPlayers.push(slot);
    } else {
      empty.push(slot);
    }
  }

  withPlayers.sort((a, b) => {
    const aActual = a.player!.actualPts;
    const bActual = b.player!.actualPts;
    if (aActual != null || bActual != null) {
      if (aActual == null) return 1;
      if (bActual == null) return -1;
      if (bActual !== aActual) {
        return bActual - aActual;
      }
    }

    const aProj = a.player!.projectedPts;
    const bProj = b.player!.projectedPts;
    if (aProj != null || bProj != null) {
      if (aProj == null) return 1;
      if (bProj == null) return -1;
      if (bProj !== aProj) {
        return bProj - aProj;
      }
    }

    const positionDiff =
      benchPositionRank(a.player!.primaryPositionId) -
      benchPositionRank(b.player!.primaryPositionId);
    if (positionDiff !== 0) {
      return positionDiff;
    }
    return a.player!.fullName.localeCompare(b.player!.fullName);
  });

  return [...withPlayers, ...empty];
}

function takeMatchingPlayer(
  remaining: TeamRosterPlayer[],
  slotPositionId: string,
  preferAssigned: boolean,
  irEligibleStatuses: readonly string[],
) {
  const index = remaining.findIndex((player) => {
    if (preferAssigned) {
      return player.slotPositionId === slotPositionId;
    }
    if (
      !slotAcceptsPlayer(slotPositionId, player.primaryPositionId, {
        injuryStatus: player.injuryStatus,
        irEligibleStatuses,
      })
    ) {
      return false;
    }
    return player.slotPositionId == null;
  });

  if (index < 0) {
    return null;
  }

  const [player] = remaining.splice(index, 1);
  return player ?? null;
}

function fillSlots(
  slots: EmptyRosterSlot[],
  remaining: TeamRosterPlayer[],
  irEligibleStatuses: readonly string[],
): FilledRosterSlot[] {
  const filled = slots.map((slot) => ({
    ...slot,
    player: takeMatchingPlayer(
      remaining,
      slot.slotPositionId,
      true,
      irEligibleStatuses,
    ),
  }));

  return filled.map((slot) => {
    if (slot.player) {
      return slot;
    }
    return {
      ...slot,
      player: takeMatchingPlayer(
        remaining,
        slot.slotPositionId,
        false,
        irEligibleStatuses,
      ),
    };
  });
}

/** Place rostered players into lineup/bench/IR/taxi shells. */
export function fillRosterSections(
  sections: EmptyRosterSections,
  players: TeamRosterPlayer[],
  irEligibleStatuses: readonly string[] = resolveIrEligibleStatuses(undefined),
): FilledRosterSections {
  const remaining = [...players].sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );

  const lineup = fillSlots(sections.lineup, remaining, irEligibleStatuses);
  const bench = sortSlotsByActualPoints(
    fillSlots(sections.bench, remaining, irEligibleStatuses),
  );
  const ir = sections.ir
    ? sortSlotsByActualPoints(
        fillSlots(sections.ir, remaining, irEligibleStatuses),
      )
    : null;
  const taxi = sections.taxi
    ? sortSlotsByActualPoints(
        fillSlots(sections.taxi, remaining, irEligibleStatuses),
      )
    : null;

  if (remaining.length > 0) {
    for (const player of remaining) {
      bench.push({
        key: `overflow-${player.id}`,
        slotPositionId: player.slotPositionId ?? "BN",
        player,
      });
    }
  }

  return {
    lineup,
    bench: sortSlotsByActualPoints(bench),
    ir,
    taxi,
  };
}

export function buildFilledRosterSections(input: {
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  taxiEnabled: boolean;
  taxiSlots: number;
  players: TeamRosterPlayer[];
  irEligibleStatuses?: readonly IrEligibleStatusId[] | readonly string[];
}): FilledRosterSections {
  const empty = buildEmptyRosterSections(input);
  return fillRosterSections(
    empty,
    input.players,
    resolveIrEligibleStatuses(input.irEligibleStatuses as string[] | undefined),
  );
}
