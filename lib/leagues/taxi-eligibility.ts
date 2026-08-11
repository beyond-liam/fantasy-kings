/** Max NFL years of experience allowed on Taxi. */

export const TAXI_MAX_YEARS_OPTIONS = [
  { value: 0, label: "Rookies only" },
  { value: 1, label: "Max 1 year experience" },
  { value: 2, label: "Max 2 years experience" },
  { value: 3, label: "Max 3 years experience" },
  { value: 4, label: "Max 4 years experience" },
  { value: 5, label: "All players" },
] as const;

export type TaxiMaxYearsExp = (typeof TAXI_MAX_YEARS_OPTIONS)[number]["value"];

export const DEFAULT_TAXI_MAX_YEARS_EXP: TaxiMaxYearsExp = 0;

/** Default: players may return to Taxi after activation. */
export const DEFAULT_TAXI_PREVENT_READD_AFTER_ACTIVATION = false;

const ALLOWED = new Set<number>(
  TAXI_MAX_YEARS_OPTIONS.map((option) => option.value),
);

export function isTaxiMaxYearsExp(value: unknown): value is TaxiMaxYearsExp {
  return typeof value === "number" && ALLOWED.has(value);
}

export function resolveTaxiMaxYearsExp(
  value: unknown,
): TaxiMaxYearsExp {
  if (isTaxiMaxYearsExp(value)) {
    return value;
  }
  return DEFAULT_TAXI_MAX_YEARS_EXP;
}

export function resolveTaxiPreventReaddAfterActivation(
  value: unknown,
): boolean {
  return value === true;
}

/**
 * Whether a player may sit in Taxi given the league max.
 * `yearsExp` null/unknown → not eligible (fail closed).
 * Option `5` ("All players") allows any finite yearsExp ≤ 99.
 */
export function isPlayerTaxiEligible(
  yearsExp: number | null | undefined,
  maxYearsExp: TaxiMaxYearsExp | null | undefined,
): boolean {
  if (yearsExp == null || !Number.isFinite(yearsExp) || yearsExp < 0) {
    return false;
  }
  const max = resolveTaxiMaxYearsExp(maxYearsExp);
  const ceiling = max === 5 ? 99 : max;
  return Math.trunc(yearsExp) <= ceiling;
}

/**
 * Whether a player may be moved onto Taxi under the one-activation rule.
 * Already on Taxi can stay; activated players are blocked when the setting is on.
 */
export function canMovePlayerToTaxi(input: {
  preventReaddAfterActivation: boolean;
  taxiActivated: boolean;
  currentSlotPositionId?: string | null;
}): boolean {
  if (!input.preventReaddAfterActivation) {
    return true;
  }
  if (input.currentSlotPositionId === "TAXI") {
    return true;
  }
  return !input.taxiActivated;
}

export function taxiMaxYearsLabel(maxYearsExp: TaxiMaxYearsExp): string {
  return (
    TAXI_MAX_YEARS_OPTIONS.find((option) => option.value === maxYearsExp)
      ?.label ?? "Rookies only"
  );
}

export const TAXI_ACTIVATED_BLOCK_MESSAGE =
  "This player already left Taxi and cannot return.";
