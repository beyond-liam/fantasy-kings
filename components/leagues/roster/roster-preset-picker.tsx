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
  ROSTER_PRESET_OPTIONS,
  type RosterUiMode,
} from "@/lib/leagues/roster";
import { cn } from "@/lib/utils";

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
      className="grid gap-3 sm:grid-cols-3"
    >
      {ROSTER_PRESET_OPTIONS.map((option) => {
        const id = `roster-preset-${option.value}`;
        const disabled = Boolean(option.disabled);

        return (
          <FieldLabel
            key={option.value}
            htmlFor={id}
            className={cn(disabled && "cursor-not-allowed opacity-60")}
          >
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{option.label}</FieldTitle>
                <FieldDescription>
                  {option.description}
                  {disabled ? " Coming soon." : null}
                </FieldDescription>
              </FieldContent>
              <RadioGroupItem
                value={option.value}
                id={id}
                disabled={disabled}
              />
            </Field>
          </FieldLabel>
        );
      })}
    </RadioGroup>
  );
}
