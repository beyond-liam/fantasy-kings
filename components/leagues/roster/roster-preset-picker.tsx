"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ROSTER_PRESET_OPTIONS,
  type RosterUiMode,
} from "@/lib/leagues/roster";

type RosterPresetPickerProps = {
  value: RosterUiMode;
  onValueChange: (value: RosterUiMode) => void;
};

export function RosterPresetPicker({
  value,
  onValueChange,
}: RosterPresetPickerProps) {
  return (
    <RadioGroup
      variant="card"
      value={value}
      onValueChange={(nextValue) => {
        if (
          nextValue === "standard" ||
          nextValue === "custom" ||
          nextValue === "idp"
        ) {
          onValueChange(nextValue);
        }
      }}
      className="sm:grid-cols-3"
    >
      {ROSTER_PRESET_OPTIONS.map((option) => {
        const disabled = Boolean(option.disabled);

        return (
          <RadioGroupItem
            key={option.value}
            value={option.value}
            disabled={disabled}
          >
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="block text-sm text-muted-foreground">
              {option.description}
              {disabled ? " Coming soon." : null}
            </span>
          </RadioGroupItem>
        );
      })}
    </RadioGroup>
  );
}
