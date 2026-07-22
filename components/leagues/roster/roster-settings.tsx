"use client";

import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { RosterBreakdown } from "@/components/leagues/roster/roster-breakdown";
import { RosterPresetPicker } from "@/components/leagues/roster/roster-preset-picker";
import { PageFormActions } from "@/components/layout/page-form-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { updateRosterRequirements } from "@/lib/actions/league-settings";
import { formatLeagueLabel } from "@/lib/leagues/format";
import {
  getDefaultCustomRosterSlots,
  type RosterMode,
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
  leagueName,
  seasonStatus,
  initialValues,
}: RosterSettingsProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [uiMode, setUiMode] = useState<RosterUiMode>(initialValues.rosterMode);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges = !valuesEqual(values, initialValues);

  const patchValues = (patch: Partial<RosterRequirementsValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  const handleModeChange = (nextMode: RosterUiMode) => {
    if (nextMode === "idp") {
      return;
    }

    setUiMode(nextMode);
    patchValues({
      rosterMode: nextMode,
      customRosterSlots:
        nextMode === "custom" && values.customRosterSlots.length === 0
          ? getDefaultCustomRosterSlots()
          : values.customRosterSlots,
    });
  };

  const handleReset = () => {
    setValues(initialValues);
    setUiMode(initialValues.rosterMode);
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
      setUiMode(values.rosterMode);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Roster requirements
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {leagueName}
          {" · "}
          <span className="capitalize">{formatLeagueLabel(seasonStatus)}</span>
        </p>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel>Roster format</FieldLabel>
          <RosterPresetPicker value={uiMode} onValueChange={handleModeChange} />
          <FieldDescription>
            Standard includes team DEF. Individual defensive positions are
            coming later. Custom lets you define starter slots yourself.
          </FieldDescription>
        </Field>
      </FieldGroup>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <RosterBreakdown
        values={{
          ...values,
          rosterMode: uiMode === "idp" ? "standard" : (uiMode as RosterMode),
        }}
        onChange={patchValues}
      />

      <PageFormActions>
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
    </div>
  );
}
