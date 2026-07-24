"use client";

import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SettingsFormCard } from "@/components/leagues/settings/settings-form-card";
import { PageFormActions } from "@/components/layout/page-form-actions";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { LineupLockMode } from "@/db/schema/league-seasons";
import { updateLineupLockMode } from "@/lib/actions/league-settings";
import { LINEUP_LOCK_OPTIONS } from "@/lib/leagues/lineup-lock";

type LineupLockSettingsProps = {
  slug: string;
  leagueName: string;
  seasonStatus: string;
  initialMode: LineupLockMode;
};

export function LineupLockSettings({
  slug,
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
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <SettingsFormCard
        title="Lineup Locking"
        footer={
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
        }
      >
        <FieldGroup>
        <Field>
          <FieldLabel>When lineups lock</FieldLabel>
          <FieldDescription>
            Controls when managers can no longer change starters for the week.
          </FieldDescription>
          <RadioGroup
            variant="card"
            value={mode}
            onValueChange={(value) => {
              if (value === "first_game" || value === "individual") {
                setMode(value);
              }
            }}
            className="mt-3"
          >
            {LINEUP_LOCK_OPTIONS.map((option) => (
              <RadioGroupItem key={option.value} value={option.value}>
                <span className="block text-sm font-medium">
                  {option.label}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {option.description}
                </span>
              </RadioGroupItem>
            ))}
          </RadioGroup>
        </Field>
        </FieldGroup>
      </SettingsFormCard>
    </div>
  );
}
