import {
  isPlayerIrEligible,
  resolveIrEligibleStatuses,
} from "@/lib/leagues/ir-eligibility";

export type IrLockPlayer = {
  id: string;
  fullName: string;
  injuryStatus: string | null;
  slotPositionId: string | null;
};

export type IrLockViolation = {
  id: string;
  fullName: string;
  injuryStatus: string | null;
};

/** Players sitting in IR who no longer match the league’s IR-eligible designations. */
export function getIrLockViolations(
  players: IrLockPlayer[],
  irEligibleStatuses: readonly string[] | null | undefined,
): IrLockViolation[] {
  const allowed = resolveIrEligibleStatuses(irEligibleStatuses);

  return players
    .filter((player) => {
      const slot = player.slotPositionId;
      if (slot !== "IR") {
        return false;
      }
      return !isPlayerIrEligible(player.injuryStatus, allowed);
    })
    .map((player) => ({
      id: player.id,
      fullName: player.fullName,
      injuryStatus: player.injuryStatus,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function hasIrAcquisitionLock(
  players: IrLockPlayer[],
  irEligibleStatuses: readonly string[] | null | undefined,
) {
  return getIrLockViolations(players, irEligibleStatuses).length > 0;
}

export function formatIrLockMessage(violations: IrLockViolation[]) {
  if (violations.length === 0) {
    return "A player on IR is no longer eligible.";
  }

  const names = violations.map((player) => player.fullName);
  if (names.length === 1) {
    return `${names[0]} is no longer IR-eligible. Move them off IR before adding free agents, claiming waivers, or trading.`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are no longer IR-eligible. Move them off IR before adding free agents, claiming waivers, or trading.`;
  }

  const rest = names.slice(0, -1).join(", ");
  const last = names[names.length - 1];
  return `${rest}, and ${last} are no longer IR-eligible. Move them off IR before adding free agents, claiming waivers, or trading.`;
}

export const IR_ACQUISITION_LOCK_REASON =
  "Move ineligible IR players off IR before free agent adds, claims, or trades.";
