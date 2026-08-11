import {
  findBlockedAcquisitionAdd,
  findBlockedAcquisitionCut,
  isStarterSlot,
} from "@/lib/leagues/lineup-lock-enforce";
import { parseLineupLockMode } from "@/lib/leagues/lineup-lock";
import { loadStartedNflTeamsForLineupLock } from "@/lib/leagues/lineup-lock-started";
import { resolveIrEligibleStatuses } from "@/lib/leagues/ir-eligibility";
import {
  countActivePositionPlayers,
  countActiveRosterPlayers,
  getMaxRosterSize,
  getPositionRosterMax,
} from "@/lib/leagues/roster-capacity";
import {
  getSlotCapacity,
  occupiedBySlot,
  pickDefaultSlotPosition,
  slotAcceptsPlayer,
} from "@/lib/leagues/roster-slots";
import {
  canMovePlayerToTaxi,
  resolveTaxiMaxYearsExp,
  resolveTaxiPreventReaddAfterActivation,
} from "@/lib/leagues/taxi-eligibility";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";

export function assertActiveRosterCapacity(input: {
  rosteredOnTeam: Array<{
    primaryPositionId: string;
    slotPositionId: string | null;
  }>;
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  playerPrimaryPositionId: string;
  /** Waiver award path uses claim-oriented copy. */
  fullRosterMessage?: string;
  positionFullMessage?: string;
}): string | null {
  const maxRoster = getMaxRosterSize(input.rosterSlots, input.benchSlots);
  if (countActiveRosterPlayers(input.rosteredOnTeam) >= maxRoster) {
    return (
      input.fullRosterMessage ??
      "Roster is full after processing this claim."
    );
  }

  const positionMax = getPositionRosterMax(
    input.rosterSlots,
    input.playerPrimaryPositionId,
  );
  const positionCount = countActivePositionPlayers(
    input.rosteredOnTeam,
    input.playerPrimaryPositionId,
  );
  if (
    positionMax !== Number.POSITIVE_INFINITY &&
    positionCount >= positionMax
  ) {
    return (
      input.positionFullMessage ??
      `At max ${input.playerPrimaryPositionId}s — choose a different drop.`
    );
  }

  return null;
}

/**
 * When the active roster is full, place an eligible player on open IR (preferred)
 * or Taxi instead of requiring a drop/cut.
 */
export function pickOpenReserveAcquisitionSlot(input: {
  player: {
    primaryPositionId: string;
    injuryStatus: string | null;
    yearsExp?: number | null;
    taxiActivated?: boolean;
  };
  rosteredOnTeam: Array<{
    primaryPositionId: string;
    slotPositionId: string | null;
  }>;
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  taxiEnabled: boolean;
  irEligibleStatuses: readonly string[] | null | undefined;
  taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
  taxiPreventReaddAfterActivation?: boolean;
}): "IR" | "TAXI" | null {
  const occupied = occupiedBySlot(input.rosteredOnTeam);
  const irEligibleStatuses = resolveIrEligibleStatuses(input.irEligibleStatuses);
  const taxiMaxYearsExp = resolveTaxiMaxYearsExp(input.taxiMaxYearsExp);
  const preventReadd = resolveTaxiPreventReaddAfterActivation(
    input.taxiPreventReaddAfterActivation,
  );

  const trySlot = (slotPositionId: "IR" | "TAXI") => {
    if (slotPositionId === "IR" && !input.irEnabled) return false;
    if (slotPositionId === "TAXI" && !input.taxiEnabled) return false;
    if (
      slotPositionId === "TAXI" &&
      !canMovePlayerToTaxi({
        preventReaddAfterActivation: preventReadd,
        taxiActivated: input.player.taxiActivated === true,
      })
    ) {
      return false;
    }
    if (
      !slotAcceptsPlayer(slotPositionId, input.player.primaryPositionId, {
        injuryStatus: input.player.injuryStatus,
        irEligibleStatuses,
        yearsExp: input.player.yearsExp,
        taxiMaxYearsExp,
      })
    ) {
      return false;
    }
    const capacity = getSlotCapacity(
      input.rosterSlots,
      slotPositionId,
      input.benchSlots,
    );
    const used = occupied.get(slotPositionId) ?? 0;
    return capacity > 0 && used < capacity;
  };

  if (trySlot("IR")) return "IR";
  if (trySlot("TAXI")) return "TAXI";
  return null;
}

export async function assertCutAllowedUnderLineupLock(input: {
  lineupLockMode: string | null | undefined;
  fullName: string;
  nflTeam: string | null;
  previousSlot: string;
}): Promise<string | null> {
  if (!isStarterSlot(input.previousSlot)) {
    return null;
  }
  const startedTeams = await loadStartedNflTeamsForLineupLock();
  if (!startedTeams) {
    return null;
  }
  return findBlockedAcquisitionCut({
    mode: parseLineupLockMode(input.lineupLockMode),
    startedTeams,
    fullName: input.fullName,
    nflTeam: input.nflTeam,
    previousSlot: input.previousSlot,
  });
}

/**
 * Pick the add slot, falling back to reserve when starters are lineup-locked.
 * Returns an error when even the reserve slot is blocked (FA path).
 */
export async function resolveAcquisitionSlotPosition(input: {
  player: {
    fullName: string;
    primaryPositionId: string;
    injuryStatus: string | null;
    nflTeam: string | null;
    yearsExp?: number | null;
    taxiActivated?: boolean;
  };
  rosteredOnTeam: Array<{
    primaryPositionId: string;
    slotPositionId: string | null;
  }>;
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  taxiEnabled: boolean;
  irEligibleStatuses: readonly string[] | null | undefined;
  lineupLockMode: string | null | undefined;
  taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
  taxiPreventReaddAfterActivation?: boolean;
  /** Force IR/Taxi placement (active roster full path). */
  forceReserveSlot?: "IR" | "TAXI";
  /** When true, blocked reserve returns an error instead of the blocked slot. */
  failIfReserveBlocked?: boolean;
}): Promise<{ ok: true; slotPositionId: string } | { ok: false; error: string }> {
  const occupied = occupiedBySlot(input.rosteredOnTeam);
  const slotArgs = {
    playerPositionId: input.player.primaryPositionId,
    injuryStatus: input.player.injuryStatus,
    irEligibleStatuses: resolveIrEligibleStatuses(input.irEligibleStatuses),
    yearsExp: input.player.yearsExp,
    taxiMaxYearsExp: input.taxiMaxYearsExp,
    rosterSlots: input.rosterSlots,
    benchSlots: input.benchSlots,
    irEnabled: input.irEnabled,
    taxiEnabled: input.taxiEnabled,
    occupiedBySlot: occupied,
  };
  let slotPositionId =
    input.forceReserveSlot ?? pickDefaultSlotPosition(slotArgs);

  const startedTeams = await loadStartedNflTeamsForLineupLock();
  if (!startedTeams) {
    return { ok: true, slotPositionId };
  }

  const mode = parseLineupLockMode(input.lineupLockMode);
  if (isStarterSlot(slotPositionId)) {
    const starterBlocked = findBlockedAcquisitionAdd({
      mode,
      startedTeams,
      fullName: input.player.fullName,
      nflTeam: input.player.nflTeam,
      nextSlot: slotPositionId,
    });
    if (starterBlocked) {
      slotPositionId = pickDefaultSlotPosition({
        ...slotArgs,
        reserveOnly: true,
      });
      if (input.failIfReserveBlocked) {
        const reserveBlocked = findBlockedAcquisitionAdd({
          mode,
          startedTeams,
          fullName: input.player.fullName,
          nflTeam: input.player.nflTeam,
          nextSlot: slotPositionId,
        });
        if (reserveBlocked) {
          return { ok: false, error: reserveBlocked };
        }
      }
    }
  } else if (input.failIfReserveBlocked || input.forceReserveSlot) {
    const reserveBlocked = findBlockedAcquisitionAdd({
      mode,
      startedTeams,
      fullName: input.player.fullName,
      nflTeam: input.player.nflTeam,
      nextSlot: slotPositionId,
    });
    if (reserveBlocked) {
      return { ok: false, error: reserveBlocked };
    }
  }

  return { ok: true, slotPositionId };
}
