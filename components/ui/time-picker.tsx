"use client";

import { Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

const timeInputClassName =
  "appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none";

type TimePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

function TimePicker({
  id,
  value,
  onChange,
  disabled,
  className,
}: TimePickerProps) {
  return (
    <InputGroup className={cn("w-full", className)}>
      <InputGroupInput
        id={id}
        type="time"
        step={60}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={timeInputClassName}
      />
      <InputGroupAddon>
        <HugeiconsIcon
          icon={Clock01Icon}
          strokeWidth={2}
          className="text-muted-foreground"
        />
      </InputGroupAddon>
    </InputGroup>
  );
}

export { TimePicker };
