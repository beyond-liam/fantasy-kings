import {
  isPlayerTaxiEligible,
  resolveTaxiMaxYearsExp,
  type TaxiMaxYearsExp,
} from "@/lib/leagues/taxi-eligibility";

export type TaxiLockPlayer = {
  id: string;
  fullName: string;
  yearsExp?: number | null;
  slotPositionId: string | null;
};

export type TaxiLockViolation = {
  id: string;
  fullName: string;
  yearsExp?: number | null;
};

/** Players sitting in Taxi who exceed the league’s max years of experience. */
export function getTaxiLockViolations(
  players: TaxiLockPlayer[],
  taxiMaxYearsExp: TaxiMaxYearsExp | null | undefined,
): TaxiLockViolation[] {
  const max = resolveTaxiMaxYearsExp(taxiMaxYearsExp);

  return players
    .filter((player) => {
      if (player.slotPositionId !== "TAXI") {
        return false;
      }
      return !isPlayerTaxiEligible(player.yearsExp, max);
    })
    .map((player) => ({
      id: player.id,
      fullName: player.fullName,
      yearsExp: player.yearsExp,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function hasTaxiAcquisitionLock(
  players: TaxiLockPlayer[],
  taxiMaxYearsExp: TaxiMaxYearsExp | null | undefined,
) {
  return getTaxiLockViolations(players, taxiMaxYearsExp).length > 0;
}

export function formatTaxiLockMessage(violations: TaxiLockViolation[]) {
  if (violations.length === 0) {
    return "A player on Taxi is no longer eligible.";
  }

  const names = violations.map((player) => player.fullName);
  if (names.length === 1) {
    return `${names[0]} is no longer Taxi-eligible. Move them off Taxi before adding free agents, claiming waivers, or trading.`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are no longer Taxi-eligible. Move them off Taxi before adding free agents, claiming waivers, or trading.`;
  }

  const rest = names.slice(0, -1).join(", ");
  const last = names[names.length - 1];
  return `${rest}, and ${last} are no longer Taxi-eligible. Move them off Taxi before adding free agents, claiming waivers, or trading.`;
}

export const TAXI_ACQUISITION_LOCK_REASON =
  "Move ineligible Taxi players off Taxi before free agent adds, claims, or trades.";
