import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { resolveIrEligibleStatuses } from "@/lib/leagues/ir-eligibility";
import {
  getSlotCapacity,
  occupiedBySlot,
  slotAcceptsPlayer,
} from "@/lib/leagues/roster-slots";
import {
  canMovePlayerToTaxi,
  resolveTaxiMaxYearsExp,
  resolveTaxiPreventReaddAfterActivation,
} from "@/lib/leagues/taxi-eligibility";

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
