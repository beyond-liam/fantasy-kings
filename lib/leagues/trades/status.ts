import { formatDistanceToNowStrict } from "date-fns";

import type { TradeProcessing } from "@/lib/leagues/transaction-rules";

export function formatTradeStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Awaiting response";
    case "review":
      return "Under review";
    case "awaiting_commissioner":
      return "Awaiting approval";
    case "completed":
      return "Completed";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    case "commissioner_rejected":
      return "Commissioner rejected";
    case "vetoed":
      return "Vetoed";
    case "invalidated":
      return "Invalidated";
    default:
      return status;
  }
}

export function formatTradeProcessCountdown(reviewEndsAt: Date | null) {
  if (!reviewEndsAt) {
    return null;
  }
  const now = Date.now();
  if (reviewEndsAt.getTime() <= now) {
    return "Processing soon";
  }
  return `Processes in ${formatDistanceToNowStrict(reviewEndsAt)}`;
}

export function resolveNextStatusOnAccept(
  tradeProcessing: TradeProcessing,
): "review" | "awaiting_commissioner" | "completed" {
  if (tradeProcessing === "instant") {
    return "completed";
  }
  if (tradeProcessing === "commissioner") {
    return "awaiting_commissioner";
  }
  return "review";
}

export function reviewEndsAtFromNow(hours = 24) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
