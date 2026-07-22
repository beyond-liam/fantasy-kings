/** Canonical IR eligibility options shown in roster settings. */
export const IR_ELIGIBILITY_OPTIONS = [
  {
    id: "Questionable",
    label: "Questionable",
    /** Values Sleeper returns on `injury_status`. */
    apiValues: ["Questionable"],
  },
  {
    id: "IR",
    label: "IR",
    apiValues: ["IR"],
  },
  {
    id: "PUP",
    label: "PUP",
    apiValues: ["PUP"],
  },
  {
    id: "Out",
    label: "Out",
    apiValues: ["Out"],
  },
  {
    id: "Suspended",
    label: "Suspended",
    /** Sleeper commonly returns `Sus`. */
    apiValues: ["Sus", "Suspended"],
  },
] as const;

export type IrEligibleStatusId = (typeof IR_ELIGIBILITY_OPTIONS)[number]["id"];

export const DEFAULT_IR_ELIGIBLE_STATUSES: IrEligibleStatusId[] =
  IR_ELIGIBILITY_OPTIONS.map((option) => option.id);

const OPTION_BY_ID = new Map(
  IR_ELIGIBILITY_OPTIONS.map((option) => [option.id, option]),
);

export function isIrEligibleStatusId(
  value: string,
): value is IrEligibleStatusId {
  return OPTION_BY_ID.has(value as IrEligibleStatusId);
}

export function resolveIrEligibleStatuses(
  values: readonly string[] | null | undefined,
): IrEligibleStatusId[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [...DEFAULT_IR_ELIGIBLE_STATUSES];
  }

  const resolved = values.filter(isIrEligibleStatusId);
  return resolved.length > 0 ? resolved : [...DEFAULT_IR_ELIGIBLE_STATUSES];
}

export function isPlayerIrEligible(
  injuryStatus: string | null | undefined,
  eligibleStatuses: readonly string[],
) {
  if (!injuryStatus?.trim()) {
    return false;
  }

  const normalized = injuryStatus.trim().toLowerCase();
  const allowed = resolveIrEligibleStatuses(eligibleStatuses);

  return allowed.some((id) => {
    const option = OPTION_BY_ID.get(id);
    return (
      option?.apiValues.some(
        (value) => value.toLowerCase() === normalized,
      ) ?? false
    );
  });
}
