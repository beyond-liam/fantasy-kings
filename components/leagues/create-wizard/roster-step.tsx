"use client";

import { RosterBreakdown } from "@/components/leagues/roster/roster-breakdown";
import { RosterPresetPicker } from "@/components/leagues/roster/roster-preset-picker";
import { ScoringPresetPicker } from "@/components/leagues/scoring/scoring-preset-picker";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  detectRosterUiMode,
  getDefaultCustomRosterSlots,
  getDefaultIdpCustomRosterSlots,
  type RosterUiMode,
} from "@/lib/leagues/roster";
import type { RosterStepValues } from "@/lib/leagues/wizard-schema";

type RosterStepProps = {
  values: RosterStepValues;
  errors: Partial<Record<keyof RosterStepValues, string>>;
  onChange: (values: Partial<RosterStepValues>) => void;
};

export function RosterStep({ values, errors, onChange }: RosterStepProps) {
  const uiMode = detectRosterUiMode({
    rosterMode: values.rosterMode,
    customRosterSlots: values.customRosterSlots,
  });

  const handleModeChange = (nextMode: RosterUiMode) => {
    if (nextMode === "standard") {
      onChange({ rosterMode: "standard" });
      return;
    }

    if (nextMode === "idp") {
      onChange({
        rosterMode: "custom",
        customRosterSlots: getDefaultIdpCustomRosterSlots(),
      });
      return;
    }

    onChange({
      rosterMode: "custom",
      customRosterSlots:
        values.customRosterSlots.length === 0 || uiMode === "idp"
          ? getDefaultCustomRosterSlots()
          : values.customRosterSlots,
    });
  };

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Roster format</FieldLabel>
        <RosterPresetPicker value={uiMode} onValueChange={handleModeChange} />
      </Field>

      <RosterBreakdown
        rosterUiMode={uiMode}
        values={{
          rosterMode: values.rosterMode,
          benchSlots: values.benchSlots,
          irEnabled: values.irEnabled,
          irSlots: values.irSlots,
          irEligibleStatuses: values.irEligibleStatuses,
          taxiEnabled: values.taxiEnabled,
          taxiSlots: values.taxiSlots,
          taxiMaxYearsExp: values.taxiMaxYearsExp,
          taxiPreventReaddAfterActivation:
            values.taxiPreventReaddAfterActivation,
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
