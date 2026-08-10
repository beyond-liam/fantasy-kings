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
      {ROSTER_PRESET_OPTIONS.map((option) => (
        <RadioGroupItem
          key={option.value}
          value={option.value}
          disabled={Boolean(option.disabled)}
        >
          <span className="block text-sm font-medium">{option.label}</span>
        </RadioGroupItem>
      ))}
    </RadioGroup>
  );
}
