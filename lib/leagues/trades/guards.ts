import type { TransactionRulesSettings } from "@/db/schema/league-seasons";
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

/** Season statuses where trades are allowed when `tradesEnabled` (includes draft). */
const TRADE_OPEN_SEASON_STATUSES = new Set([
  "setup",
  "recruiting",
  "draft",
  "active",
]);

export function canProposeTrades(season: {
  status: string;
  tradesEnabled: boolean;
  settings: {
    transactionRules?: Partial<TransactionRulesSettings> | null;
  };
}) {
  if (!season.tradesEnabled) {
    return { ok: false as const, error: "Trades are disabled in this league." };
  }

  if (TRADE_OPEN_SEASON_STATUSES.has(season.status)) {
    return { ok: true as const };
  }

  const rules = resolveTransactionRules(season.settings.transactionRules);
  if (!rules.permitTradesAfterSeason) {
    return {
      ok: false as const,
      error: "Trades are closed for this season.",
    };
  }

  return { ok: true as const };
}

/**
 * Trade deadline lockout: after the deadline week ends, through the last
 * fantasy game week (inclusive). Open before the deadline and again after
 * the season's last game week (subject to `permitTradesAfterSeason`).
 */
export function isTradeDeadlineLockout(input: {
  currentWeek: number;
  deadlineWeek: number | null | undefined;
  lastGameWeek: number;
}): boolean {
  if (input.deadlineWeek == null) {
    return false;
  }
  return (
    input.currentWeek > input.deadlineWeek &&
    input.currentWeek <= input.lastGameWeek
  );
}

/** @deprecated Prefer `isTradeDeadlineLockout` with a last-game-week bound. */
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
