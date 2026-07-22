const STORAGE_KEY = "fk:pending-trade-propose";

export type PendingTradePropose = {
  leagueSlug: string;
  receivingTeamId: string;
  proposingOfferIds: string[];
  receivingOfferIds: string[];
  proposingDropIds: string[];
  receivingDropIds: string[];
  comment: string;
  /** When set, reject this pending inbound trade after the counter is proposed. */
  counterOfTradeId?: string;
};

export function stashPendingTradePropose(payload: PendingTradePropose) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function takePendingTradePropose(): PendingTradePropose | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    return JSON.parse(raw) as PendingTradePropose;
  } catch {
    return null;
  }
}
