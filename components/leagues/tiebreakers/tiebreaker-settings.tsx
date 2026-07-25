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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SortableList } from "@/components/ui/sortable-list";
import { updateTiebreakerSettings } from "@/lib/actions/league-settings";
import {
  labelForGameTiebreaker,
  labelForRankTiebreaker,
  type GameTiebreakerId,
  type RankTiebreakerId,
  type TiebreakerSettings,
} from "@/lib/leagues/tiebreakers";

type TiebreakerSettingsFormProps = {
  slug: string;
  leagueName: string;
  seasonStatus: string;
  initialValues: TiebreakerSettings;
};

const YES_NO_ITEMS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

function valuesEqual(a: TiebreakerSettings, b: TiebreakerSettings) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function TiebreakerSettingsForm({
  slug,
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
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <SettingsFormCard
        title="Tiebreak Rules"
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
              Save
            </Button>
          </PageFormActions>
        }
      >
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
            <FieldLabel htmlFor="breakRegularSeasonTies">
              Break regular season ties
            </FieldLabel>
            <FieldDescription>
              Whether to apply game tiebreakers during the regular season, or
              leave matchups as ties.
            </FieldDescription>
            <Select
              items={[...YES_NO_ITEMS]}
              value={values.breakRegularSeasonTies ? "yes" : "no"}
              onValueChange={(value) => {
                if (value === "yes" || value === "no") {
                  patch({ breakRegularSeasonTies: value === "yes" });
                }
              }}
            >
              <SelectTrigger id="breakRegularSeasonTies" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {YES_NO_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
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
            <FieldLabel htmlFor="applyOfficialStatChanges">
              Allow official score corrections
            </FieldLabel>
            <FieldDescription>
              When enabled, post-week official stats (e.g. nflverse / revised NFL
              box scores) can update fantasy points and results that already
              finished. When disabled, finalized week scores stay locked.
            </FieldDescription>
            <Select
              items={[...YES_NO_ITEMS]}
              value={values.applyOfficialStatChanges ? "yes" : "no"}
              onValueChange={(value) => {
                if (value === "yes" || value === "no") {
                  patch({ applyOfficialStatChanges: value === "yes" });
                }
              }}
            >
              <SelectTrigger id="applyOfficialStatChanges" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {YES_NO_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </SettingsFormCard>
    </div>
  );
}
