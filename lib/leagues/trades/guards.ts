import { resolveTransactionRules } from "@/lib/leagues/transaction-rules";

export const OPEN_TRADE_STATUSES = [
  "pending",
  "review",
  "awaiting_commissioner",
] as const;

export type OpenTradeStatus = (typeof OPEN_TRADE_STATUSES)[number];

export function isOpenTradeStatus(
  status: string,
): status is OpenTradeStatus {
  return OPEN_TRADE_STATUSES.includes(status as OpenTradeStatus);
}

export function canProposeTrades(season: {
  status: string;
  tradesEnabled: boolean;
  settings: { transactionRules?: Parameters<typeof resolveTransactionRules>[0] };
}) {
  if (!season.tradesEnabled) {
    return { ok: false as const, error: "Trades are disabled in this league." };
  }

  const rules = resolveTransactionRules(season.settings.transactionRules);
  if (season.status !== "active" && !rules.permitTradesAfterSeason) {
    return {
      ok: false as const,
      error: "Trades are closed for this season.",
    };
  }

  return { ok: true as const };
}

export function isTradeDeadlinePassed(
  currentWeek: number,
  deadlineWeek: number | null | undefined,
) {
  if (deadlineWeek == null) {
    return false;
  }
  return currentWeek > deadlineWeek;
}

export function tradeDeadlineError(deadlineWeek: number) {
  return `Trade deadline has passed (no trades after week ${deadlineWeek}).`;
}
