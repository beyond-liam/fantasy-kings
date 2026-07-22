export const OWNER_REMOVAL_REASONS = [
  {
    value: "doesnt_want_to_play",
    label: "This owner doesn't want to play anymore",
  },
  {
    value: "cheating",
    label: "This owner is cheating",
  },
  {
    value: "abandoned",
    label: "This owner appears to have abandoned the team",
  },
] as const;

export type OwnerRemovalReason =
  (typeof OWNER_REMOVAL_REASONS)[number]["value"];

export function isOwnerRemovalReason(
  value: string,
): value is OwnerRemovalReason {
  return OWNER_REMOVAL_REASONS.some((reason) => reason.value === value);
}

export function ownerRemovalReasonLabel(
  value: OwnerRemovalReason | null | undefined,
) {
  if (!value) return null;
  return (
    OWNER_REMOVAL_REASONS.find((reason) => reason.value === value)?.label ??
    null
  );
}

/** True when every division has the same team count and all teams are assigned. */
export function areDivisionsBalanced(
  divisionIds: string[],
  assignments: Record<string, string>,
) {
  if (divisionIds.length < 2) {
    return false;
  }

  const counts = new Map(divisionIds.map((id) => [id, 0]));
  const teamIds = Object.keys(assignments);

  for (const teamId of teamIds) {
    const divisionId = assignments[teamId];
    if (!divisionId || !counts.has(divisionId)) {
      return false;
    }
    counts.set(divisionId, (counts.get(divisionId) ?? 0) + 1);
  }

  const values = [...counts.values()];
  if (values.length === 0) {
    return false;
  }

  const target = values[0]!;
  return values.every((count) => count === target && count > 0);
}

export function hasCommissionerPowers(
  role: string | null | undefined,
): boolean {
  return role === "commissioner" || role === "co_commissioner";
}

export type MembershipOwnerOption = {
  userId: string;
  displayName: string;
  teamName: string;
  teamId: string | null;
  role: "commissioner" | "co_commissioner" | "member";
};
