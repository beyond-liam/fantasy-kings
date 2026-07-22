"use client";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
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
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) {
          onValueChange(nextValue as ScoringPreset);
        }
      }}
      className="grid gap-3 sm:grid-cols-3"
    >
      {SCORING_PRESET_OPTIONS.map((option) => {
        const id = `scoring-preset-${option.value}`;

        return (
          <FieldLabel key={option.value} htmlFor={id}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{option.label}</FieldTitle>
                <FieldDescription>{option.description}</FieldDescription>
              </FieldContent>
              <RadioGroupItem value={option.value} id={id} />
            </Field>
          </FieldLabel>
        );
      })}
    </RadioGroup>
  );
}
