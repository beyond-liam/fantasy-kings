"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  SCORING_PRESET_OPTIONS,
  type ScoringPreset,
} from "@/lib/leagues/scoring";

type ScoringPresetPickerProps = {
  value: ScoringPreset;
  onValueChange: (value: ScoringPreset) => void;
};

export function ScoringPresetPicker({
  value,
  onValueChange,
}: ScoringPresetPickerProps) {
  return (
    <RadioGroup
      variant="card"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) {
          onValueChange(nextValue as ScoringPreset);
        }
      }}
      className="sm:grid-cols-3"
    >
      {SCORING_PRESET_OPTIONS.map((option) => (
        <RadioGroupItem key={option.value} value={option.value}>
          <span className="block text-sm font-medium">{option.label}</span>
          <span className="block text-sm text-muted-foreground">
            {option.description}
          </span>
        </RadioGroupItem>
      ))}
    </RadioGroup>
  );
}
