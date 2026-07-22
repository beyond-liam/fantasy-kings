"use client";

import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition, type ReactNode } from "react";
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
import { SortableList } from "@/components/ui/sortable-list";
import { updateTiebreakerSettings } from "@/lib/actions/league-settings";
import { formatLeagueLabel } from "@/lib/leagues/format";
import {
  labelForGameTiebreaker,
  labelForRankTiebreaker,
  type GameTiebreakerId,
  type RankTiebreakerId,
  type TiebreakerSettings,
} from "@/lib/leagues/tiebreakers";
import { cn } from "@/lib/utils";

type TiebreakerSettingsFormProps = {
  slug: string;
  leagueName: string;
  seasonStatus: string;
  initialValues: TiebreakerSettings;
};

function valuesEqual(a: TiebreakerSettings, b: TiebreakerSettings) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function OptionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-data-checked:border-primary",
        className,
      )}
    >
      {children}
    </Label>
  );
}

export function TiebreakerSettingsForm({
  slug,
  leagueName,
  seasonStatus,
  initialValues,
}: TiebreakerSettingsFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges = !valuesEqual(values, initialValues);

  const patch = (next: Partial<TiebreakerSettings>) => {
    setValues((current) => ({ ...current, ...next }));
  };

  const handleReset = () => {
    setValues(initialValues);
    setError(null);
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateTiebreakerSettings(slug, values);
      if (!result.success) {
        setError(result.error ?? "Could not save tiebreak rules.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Tiebreak rules
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
          <FieldLabel>Individual game tiebreakers</FieldLabel>
          <FieldDescription>
            Drag to set priority when two managers finish a matchup with the
            same score.
          </FieldDescription>
          <div className="mt-3">
            <SortableList
              items={values.gameTiebreakers.map((id) => ({
                id,
                label: labelForGameTiebreaker(id),
              }))}
              onReorder={(ids) =>
                patch({ gameTiebreakers: ids as GameTiebreakerId[] })
              }
            />
          </div>
        </Field>

        <Field>
          <FieldLabel>Break regular season ties</FieldLabel>
          <FieldDescription>
            Whether to apply game tiebreakers during the regular season, or
            leave matchups as ties.
          </FieldDescription>
          <RadioGroup
            value={values.breakRegularSeasonTies ? "yes" : "no"}
            onValueChange={(value) =>
              patch({ breakRegularSeasonTies: value === "yes" })
            }
            className="mt-3 grid gap-3 sm:grid-cols-2"
          >
            <OptionLabel>
              <RadioGroupItem value="yes" className="mt-0.5" />
              <span className="text-sm font-medium">Yes</span>
            </OptionLabel>
            <OptionLabel>
              <RadioGroupItem value="no" className="mt-0.5" />
              <span className="text-sm font-medium">No</span>
            </OptionLabel>
          </RadioGroup>
        </Field>

        <Field>
          <FieldLabel>Power & playoff rank tiebreakers</FieldLabel>
          <FieldDescription>
            Drag to set priority when teams are tied in standings or playoff
            seeding.
          </FieldDescription>
          <div className="mt-3">
            <SortableList
              items={values.rankTiebreakers.map((id) => ({
                id,
                label: labelForRankTiebreaker(id),
              }))}
              onReorder={(ids) =>
                patch({ rankTiebreakers: ids as RankTiebreakerId[] })
              }
            />
          </div>
        </Field>

        <Field>
          <FieldLabel>Retroactively apply official stat corrections</FieldLabel>
          <FieldDescription>
            When the NFL revises box scores, update fantasy results that already
            finished.
          </FieldDescription>
          <RadioGroup
            value={values.applyOfficialStatChanges ? "yes" : "no"}
            onValueChange={(value) =>
              patch({ applyOfficialStatChanges: value === "yes" })
            }
            className="mt-3 grid gap-3 sm:grid-cols-2"
          >
            <OptionLabel>
              <RadioGroupItem value="yes" className="mt-0.5" />
              <span className="text-sm font-medium">Yes</span>
            </OptionLabel>
            <OptionLabel>
              <RadioGroupItem value="no" className="mt-0.5" />
              <span className="text-sm font-medium">No</span>
            </OptionLabel>
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
