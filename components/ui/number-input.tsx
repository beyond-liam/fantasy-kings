"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NumberInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange" | "inputMode"
> & {
  value: number;
  onValueChange: (value: number) => void;
  allowDecimal?: boolean;
  allowNegative?: boolean;
};

function isPartialNumber(
  raw: string,
  allowDecimal: boolean,
  allowNegative: boolean,
) {
  if (raw === "") return true;
  if (allowNegative && raw === "-") return true;
  if (allowDecimal && (raw === "." || raw === "-.")) return true;

  if (allowDecimal) {
    return allowNegative ? /^-?\d*\.?\d*$/.test(raw) : /^\d*\.?\d*$/.test(raw);
  }

  return allowNegative ? /^-?\d*$/.test(raw) : /^\d*$/.test(raw);
}

function toNumber(raw: string, allowDecimal: boolean) {
  return allowDecimal ? Number(raw) : Number.parseInt(raw, 10);
}

function clampNumber(value: number, min?: string | number, max?: string | number) {
  let next = value;
  if (min !== undefined && min !== "") {
    const minValue = typeof min === "number" ? min : Number(min);
    if (Number.isFinite(minValue)) next = Math.max(minValue, next);
  }
  if (max !== undefined && max !== "") {
    const maxValue = typeof max === "number" ? max : Number(max);
    if (Number.isFinite(maxValue)) next = Math.min(maxValue, next);
  }
  return next;
}

function formatValue(value: number) {
  return Number.isFinite(value) ? String(value) : "";
}

function NumberInput({
  value,
  onValueChange,
  allowDecimal = false,
  allowNegative = false,
  min,
  max,
  className,
  onBlur,
  onFocus,
  ...props
}: NumberInputProps) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const display = draft ?? formatValue(value);

  return (
    <Input
      {...props}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      className={cn("tabular-nums", className)}
      value={display}
      onFocus={(event) => {
        setDraft(formatValue(value));
        onFocus?.(event);
      }}
      onBlur={(event) => {
        const raw = draft ?? formatValue(value);
        setDraft(null);

        if (
          raw.trim() === "" ||
          raw === "-" ||
          raw === "." ||
          raw === "-."
        ) {
          onBlur?.(event);
          return;
        }

        const parsed = toNumber(raw, allowDecimal);
        if (Number.isFinite(parsed)) {
          onValueChange(clampNumber(parsed, min, max));
        }

        onBlur?.(event);
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (!isPartialNumber(next, allowDecimal, allowNegative)) return;

        setDraft(next);

        if (
          next === "" ||
          next === "-" ||
          next === "." ||
          next === "-."
        ) {
          return;
        }

        const parsed = toNumber(next, allowDecimal);
        if (Number.isFinite(parsed)) {
          onValueChange(parsed);
        }
      }}
    />
  );
}

export { NumberInput };
