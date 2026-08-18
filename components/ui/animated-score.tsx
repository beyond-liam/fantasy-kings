"use client";

import NumberFlow from "@number-flow/react";
import type { ComponentProps } from "react";

type AnimatedScoreProps = {
  value: number;
  /** Decimal places — 0 for integers, 1–2 for fantasy points. */
  decimals?: number;
  className?: string;
  style?: ComponentProps<typeof NumberFlow>["style"];
};

export function AnimatedScore({
  value,
  decimals = 0,
  className,
  style,
}: AnimatedScoreProps) {
  return (
    <NumberFlow
      value={value}
      format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }}
      trend={1}
      willChange
      className={className}
      style={style}
    />
  );
}
