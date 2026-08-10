"use client";

import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { RosterBreakdown } from "@/components/leagues/roster/roster-breakdown";
import { RosterPresetPicker } from "@/components/leagues/roster/roster-preset-picker";
import { SettingsFormCard } from "@/components/leagues/settings/settings-form-card";
import { PageFormActions } from "@/components/layout/page-form-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { updateRosterRequirements } from "@/lib/actions/league-settings";
import {
  detectRosterUiMode,
  getDefaultCustomRosterSlots,
  getDefaultIdpCustomRosterSlots,
  type RosterRequirementsValues,
  type RosterUiMode,
} from "@/lib/leagues/roster";

type RosterSettingsProps = {
  slug: string;
  leagueName: string;
  seasonStatus: string;
  initialValues: RosterRequirementsValues;
};

function valuesEqual(
  a: RosterRequirementsValues,
  b: RosterRequirementsValues,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function RosterSettings({
  slug,
  initialValues,
}: RosterSettingsProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [uiMode, setUiMode] = useState<RosterUiMode>(() =>
    detectRosterUiMode(initialValues),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges = !valuesEqual(values, initialValues);

  const patchValues = (patch: Partial<RosterRequirementsValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  const handleModeChange = (nextMode: RosterUiMode) => {
    setUiMode(nextMode);

    if (nextMode === "standard") {
      patchValues({ rosterMode: "standard" });
      return;
    }

    if (nextMode === "idp") {
      patchValues({
        rosterMode: "custom",
        customRosterSlots: getDefaultIdpCustomRosterSlots(),
      });
      return;
    }

    patchValues({
      rosterMode: "custom",
      customRosterSlots:
        values.customRosterSlots.length === 0
          ? getDefaultCustomRosterSlots()
          : values.customRosterSlots,
    });
  };

  const handleReset = () => {
    setValues(initialValues);
    setUiMode(detectRosterUiMode(initialValues));
    setError(null);
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateRosterRequirements(slug, values);
      if (!result.success) {
        setError(result.error ?? "Could not save roster requirements.");
        return;
      }
      setValues(values);
      setUiMode(detectRosterUiMode(values));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <SettingsFormCard
        title="Roster Requirements"
        contentClassName="flex flex-col gap-8"
        footer={
          <PageFormActions float={hasChanges}>
            <Button
              type="button"
              variant="outline"
              disabled={isPending || !hasChanges}
              onClick={handleReset}
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Reset
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isPending || !hasChanges}
            >
              <HugeiconsIcon
                icon={TickDouble02Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Save Roster
            </Button>
          </PageFormActions>
        }
      >
        <FieldGroup>
        <Field>
          <FieldLabel>Roster format</FieldLabel>
          <RosterPresetPicker value={uiMode} onValueChange={handleModeChange} />
        </Field>
        </FieldGroup>

        <RosterBreakdown
          rosterUiMode={uiMode}
          values={{
            ...values,
            rosterMode: uiMode === "standard" ? "standard" : "custom",
          }}
          onChange={patchValues}
        />
      </SettingsFormCard>
    </div>
  );
}
