/** Whether managers may add/cut free agents (roster transactions). */
export function isRosterTransactionsEnabled(season: {
  status: string;
  freeAgencyOpen: boolean;
}) {
  return season.status === "active" || season.freeAgencyOpen;
}
