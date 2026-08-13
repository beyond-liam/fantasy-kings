"use client";

import { useEffect, useState } from "react";

import {
  formatTradeOfferExpiryCountdown,
  formatTradeProcessCountdown,
} from "@/lib/leagues/trades/status";

type TradeCountdownLabelProps = {
  at: Date | string | null | undefined;
  kind: "expires" | "processes";
  className?: string;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLabel(
  kind: TradeCountdownLabelProps["kind"],
  at: Date,
): string | null {
  return kind === "expires"
    ? formatTradeOfferExpiryCountdown(at)
    : formatTradeProcessCountdown(at);
}

/** Coarse live relative countdown (updates about once a minute). */
export function TradeCountdownLabel({
  at,
  kind,
  className,
}: TradeCountdownLabelProps) {
  const target = toDate(at);
  const targetMs = target?.getTime() ?? null;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (targetMs == null) {
      return;
    }

    const id = window.setInterval(() => {
      setTick((n) => n + 1);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [targetMs]);

  const label = target ? formatLabel(kind, target) : null;

  if (!label) {
    return null;
  }

  return (
    <span className={className} suppressHydrationWarning>
      {label}
    </span>
  );
}
