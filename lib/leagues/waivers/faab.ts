/**
 * Team `faabRemaining` is the source of truth for spendable FAAB.
 * Season `faabBudget` is only the starting allotment used to seed teams.
 */
export function resolveFaabRemaining(
  teamFaabRemaining: number | null | undefined,
  seasonFaabBudget: number | null | undefined,
): number | null {
  if (teamFaabRemaining != null) {
    return teamFaabRemaining;
  }
  if (seasonFaabBudget != null) {
    return seasonFaabBudget;
  }
  return null;
}

/** True when this season uses FAAB and should track remaining balances. */
export function seasonUsesFaab(season: {
  waiversEnabled: boolean;
  waiverType: "priority" | "faab";
  faabBudget: number | null;
}): boolean {
  return (
    season.waiversEnabled &&
    season.waiverType === "faab" &&
    season.faabBudget != null &&
    season.faabBudget > 0
  );
}
