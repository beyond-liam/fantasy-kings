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
  const [label, setLabel] = useState(() =>
    target ? formatLabel(kind, target) : null,
  );

  useEffect(() => {
    if (targetMs == null) {
      setLabel(null);
      return;
    }

    const date = new Date(targetMs);
    const tick = () => {
      setLabel(formatLabel(kind, date));
    };

    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [kind, targetMs]);

  if (!label) {
    return null;
  }

  return (
    <span className={className} suppressHydrationWarning>
      {label}
    </span>
  );
}
