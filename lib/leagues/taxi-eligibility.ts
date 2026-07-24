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

export function taxiMaxYearsLabel(maxYearsExp: TaxiMaxYearsExp): string {
  return (
    TAXI_MAX_YEARS_OPTIONS.find((option) => option.value === maxYearsExp)
      ?.label ?? "Rookies only"
  );
}
