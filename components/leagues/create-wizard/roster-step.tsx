"use client";

import { RosterBreakdown } from "@/components/leagues/roster/roster-breakdown";
import { ScoringPresetPicker } from "@/components/leagues/scoring/scoring-preset-picker";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
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
          value={values.rosterMode}
          onValueChange={(value) =>
            onChange({ rosterMode: value as RosterStepValues["rosterMode"] })
          }
          className="grid gap-3 sm:grid-cols-2"
        >
          <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
            <RadioGroupItem value="standard" />
            <div>
              <p className="font-medium">Standard</p>
              <p className="text-sm text-muted-foreground">
                QB, RB×2, WR×2, TE, FLEX, K, DEF + bench.
              </p>
            </div>
          </Label>
          <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
            <RadioGroupItem value="custom" />
            <div>
              <p className="font-medium">Custom</p>
              <p className="text-sm text-muted-foreground">
                Build your own position limits.
              </p>
            </div>
          </Label>
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
          customRosterSlots: values.customRosterSlots,
        }}
        errors={{
          customRosterSlots: errors.customRosterSlots,
          irSlots: errors.irSlots,
          irEligibleStatuses: errors.irEligibleStatuses,
          taxiSlots: errors.taxiSlots,
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
