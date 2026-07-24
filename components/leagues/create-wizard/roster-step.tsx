"use client";

import { RosterBreakdown } from "@/components/leagues/roster/roster-breakdown";
import { ScoringPresetPicker } from "@/components/leagues/scoring/scoring-preset-picker";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { RosterStepValues } from "@/lib/leagues/wizard-schema";

type RosterStepProps = {
  values: RosterStepValues;
  errors: Partial<Record<keyof RosterStepValues, string>>;
  onChange: (values: Partial<RosterStepValues>) => void;
};

export function RosterStep({ values, errors, onChange }: RosterStepProps) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Roster format</FieldLabel>
        <RadioGroup
          variant="card"
          value={values.rosterMode}
          onValueChange={(value) =>
            onChange({ rosterMode: value as RosterStepValues["rosterMode"] })
          }
          className="sm:grid-cols-2"
        >
          <RadioGroupItem value="standard">
            <span className="block text-sm font-medium">Standard</span>
            <span className="block text-sm text-muted-foreground">
              QB, RB×2, WR×2, TE, FLEX, K, DEF + bench.
            </span>
          </RadioGroupItem>
          <RadioGroupItem value="custom">
            <span className="block text-sm font-medium">Custom</span>
            <span className="block text-sm text-muted-foreground">
              Build your own position limits.
            </span>
          </RadioGroupItem>
        </RadioGroup>
      </Field>

      <RosterBreakdown
        values={{
          rosterMode: values.rosterMode,
          benchSlots: values.benchSlots,
          irEnabled: values.irEnabled,
          irSlots: values.irSlots,
          irEligibleStatuses: values.irEligibleStatuses,
          taxiEnabled: values.taxiEnabled,
          taxiSlots: values.taxiSlots,
          taxiMaxYearsExp: values.taxiMaxYearsExp,
          customRosterSlots: values.customRosterSlots,
        }}
        errors={{
          customRosterSlots: errors.customRosterSlots,
          irSlots: errors.irSlots,
          irEligibleStatuses: errors.irEligibleStatuses,
          taxiSlots: errors.taxiSlots,
          taxiMaxYearsExp: errors.taxiMaxYearsExp,
        }}
        onChange={(patch) => onChange(patch)}
      />

      <Field>
        <FieldLabel>Scoring</FieldLabel>
        <ScoringPresetPicker
          value={values.scoringPreset}
          onValueChange={(scoringPreset) => onChange({ scoringPreset })}
        />
        <FieldDescription>
          Full scoring tables can be customized later in league settings.
        </FieldDescription>
      </Field>
    </FieldGroup>
  );
}
