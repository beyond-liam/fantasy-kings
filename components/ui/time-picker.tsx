"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TimePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Native time input (shadcn date-picker Time Picker pattern), minutes only.
 * Expects `value` as `HH:mm`.
 */
function TimePicker({
  id,
  value,
  onChange,
  disabled,
  className,
}: TimePickerProps) {
  return (
    <Input
      type="time"
      id={id}
      step={60}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
        className,
      )}
    />
  );
}

export { TimePicker };
