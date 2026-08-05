/** Draft statuses that freeze add/cut/claim/trade (draft picks still allowed). */
export function isDraftBlockingRosterActions(
  draftStatus: string | null | undefined,
) {
  return draftStatus === "live" || draftStatus === "paused";
}

/**
 * Whether managers may add/cut free agents (roster transactions).
 * Pass draft status when known — live/paused drafts always lock transactions.
 */
export function isRosterTransactionsEnabled(
  season: {
    status: string;
    freeAgencyOpen: boolean;
  },
  draftStatus?: string | null,
) {
  if (isDraftBlockingRosterActions(draftStatus)) {
    return false;
  }
  return season.status === "active" || season.freeAgencyOpen;
}
