"use client";

import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageFormActions } from "@/components/layout/page-form-actions";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { LineupLockMode } from "@/db/schema/league-seasons";
import { updateLineupLockMode } from "@/lib/actions/league-settings";
import { formatLeagueLabel } from "@/lib/leagues/format";
import { LINEUP_LOCK_OPTIONS } from "@/lib/leagues/lineup-lock";

type LineupLockSettingsProps = {
  slug: string;
  leagueName: string;
  seasonStatus: string;
  initialMode: LineupLockMode;
};

export function LineupLockSettings({
  slug,
  leagueName,
  seasonStatus,
  initialMode,
}: LineupLockSettingsProps) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges = mode !== initialMode;

  const handleReset = () => {
    setMode(initialMode);
    setError(null);
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateLineupLockMode(slug, mode);
      if (!result.success) {
        setError(result.error ?? "Could not save lineup locking.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Lineup locking
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {leagueName}
          {" · "}
          <span className="capitalize">{formatLeagueLabel(seasonStatus)}</span>
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field>
          <FieldLabel>When lineups lock</FieldLabel>
          <FieldDescription>
            Controls when managers can no longer change starters for the week.
          </FieldDescription>
          <RadioGroup
            value={mode}
            onValueChange={(value) => {
              if (value === "first_game" || value === "individual") {
                setMode(value);
              }
            }}
            className="mt-3 grid gap-3"
          >
            {LINEUP_LOCK_OPTIONS.map((option) => (
              <Label
                key={option.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-data-checked:border-primary"
              >
                <RadioGroupItem value={option.value} className="mt-0.5" />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">
                    {option.label}
                  </span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </Field>
      </FieldGroup>

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
          Save
        </Button>
      </PageFormActions>
    </div>
  );
}
