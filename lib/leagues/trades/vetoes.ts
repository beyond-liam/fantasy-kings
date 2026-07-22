/** Majority of managers not involved in the trade must veto to block it. */
export function vetoThreshold(eligibleVoters: number) {
  if (eligibleVoters <= 0) {
    return 1;
  }
  return Math.floor(eligibleVoters / 2) + 1;
}

export function countEligibleVetoVoters(totalTeams: number) {
  return Math.max(0, totalTeams - 2);
}
