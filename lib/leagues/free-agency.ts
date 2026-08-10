/** Draft statuses that freeze add/cut/claim (draft picks still allowed). Trades stay open. */
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

/**
 * Whether managers may rearrange lineup / bench / IR / taxi slots.
 * Allowed during a live/paused draft (and season `draft`) even though FA is locked.
 */
export function isLineupEditingEnabled(
  season: {
    status: string;
    freeAgencyOpen: boolean;
  },
  draftStatus?: string | null,
) {
  if (
    season.status === "draft" ||
    isDraftBlockingRosterActions(draftStatus)
  ) {
    return true;
  }
  return isRosterTransactionsEnabled(season, draftStatus);
}
