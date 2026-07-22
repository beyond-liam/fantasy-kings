"use client";

import {
  ArrowReloadHorizontalIcon,
  Cancel01Icon,
  FloppyDiskIcon,
  TickDouble02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PageFormActions } from "@/components/layout/page-form-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePlayoffSettings } from "@/lib/actions/league-settings";
import { formatLeagueLabel } from "@/lib/leagues/format";
import {
  clampPlayoffTeamCount,
  derivePlayoffSummary,
  playoffTeamCountsForLeague,
  type PlayoffSettingsFormValues,
} from "@/lib/leagues/playoff-settings";
import { CHAMPIONSHIP_WEEKS } from "@/lib/leagues/season-calendar";

type PlayoffSettingsFormProps = {
  slug: string;
  leagueName: string;
  seasonStatus: string;
  teamCount: number;
  isLeagueFull: boolean;
  matchupCount: number;
  editable: boolean;
  initialValues: PlayoffSettingsFormValues;
};

function YesNoRadio({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <RadioGroup
      value={value ? "yes" : "no"}
      disabled={disabled}
      onValueChange={(next) => {
        if (next == null) return;
        onChange(next === "yes");
      }}
      className="flex flex-wrap gap-4"
    >
      <Label
        htmlFor={`${id}-yes`}
        className="flex cursor-pointer items-center gap-2"
      >
        <RadioGroupItem id={`${id}-yes`} value="yes" />
        Yes
      </Label>
      <Label
        htmlFor={`${id}-no`}
        className="flex cursor-pointer items-center gap-2"
      >
        <RadioGroupItem id={`${id}-no`} value="no" />
        No
      </Label>
    </RadioGroup>
  );
}

export function PlayoffSettingsForm({
  slug,
  leagueName,
  seasonStatus,
  teamCount,
  isLeagueFull,
  matchupCount,
  editable,
  initialValues,
}: PlayoffSettingsFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const playoffTeamOptions = playoffTeamCountsForLeague(teamCount);
  const championshipItems = CHAMPIONSHIP_WEEKS.map((week) => ({
    value: String(week),
    label: `Week ${week}`,
  }));

  const summary = useMemo(
    () =>
      derivePlayoffSummary({
        enabled: values.enabled,
        playoffTeamCount: values.playoffTeamCount,
        championshipWeek: values.championshipWeek,
        twoWeekChampionship: values.twoWeekChampionship,
      }),
    [values],
  );

  const hasChanges =
    values.enabled !== initialValues.enabled ||
    values.playoffTeamCount !== initialValues.playoffTeamCount ||
    values.championshipWeek !== initialValues.championshipWeek ||
    values.reSeedAfterEachRound !== initialValues.reSeedAfterEachRound ||
    values.twoWeekChampionship !== initialValues.twoWeekChampionship;

  const willRegenerate = isLeagueFull || matchupCount > 0;

  const patch = (next: Partial<PlayoffSettingsFormValues>) => {
    setValues((prev) => {
      const merged = { ...prev, ...next };
      if (!merged.enabled) {
        return {
          ...merged,
          twoWeekChampionship: false,
        };
      }
      return {
        ...merged,
        playoffTeamCount: clampPlayoffTeamCount(
          merged.playoffTeamCount,
          teamCount,
        ),
      };
    });
  };

  const handleReset = () => {
    setValues(initialValues);
    setError(null);
  };

  const persist = () => {
    setError(null);
    startTransition(async () => {
      const result = await updatePlayoffSettings(slug, values);
      if (!result.success) {
        setError(result.error ?? "Could not save playoff settings.");
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    });
  };

  const handleSave = () => {
    setConfirmOpen(true);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Playoffs
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {leagueName}
          {" · "}
          <span className="capitalize">{formatLeagueLabel(seasonStatus)}</span>
        </p>
      </div>

      {!editable ? (
        <Alert>
          <AlertDescription>
            Playoff settings lock once NFL Week 1 of the season begins.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field>
          <FieldLabel>Hold a playoff tournament</FieldLabel>
          <YesNoRadio
            id="playoffs-enabled"
            value={values.enabled}
            disabled={!editable}
            onChange={(enabled) => patch({ enabled })}
          />
        </Field>

        {values.enabled ? (
          <>
            <Field>
              <FieldLabel htmlFor="playoff-team-count">
                Number of teams that make the playoffs
              </FieldLabel>
              <Select
                items={playoffTeamOptions.map((count) => ({
                  value: String(count),
                  label: String(count),
                }))}
                value={String(values.playoffTeamCount)}
                disabled={!editable}
                onValueChange={(value) => {
                  if (!value) return;
                  patch({
                    playoffTeamCount: clampPlayoffTeamCount(
                      Number(value),
                      teamCount,
                    ),
                  });
                }}
              >
                <SelectTrigger
                  id="playoff-team-count"
                  className="w-full max-w-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {playoffTeamOptions.map((count) => (
                      <SelectItem key={count} value={String(count)}>
                        {count}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="championship-week">Championship week</FieldLabel>
              <Select
                items={championshipItems}
                value={String(values.championshipWeek)}
                disabled={!editable}
                onValueChange={(value) => {
                  if (!value) return;
                  patch({
                    championshipWeek: Number(
                      value,
                    ) as PlayoffSettingsFormValues["championshipWeek"],
                  });
                }}
              >
                <SelectTrigger
                  id="championship-week"
                  className="w-full max-w-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {championshipItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Re-seed after each round</FieldLabel>
              <YesNoRadio
                id="reseed"
                value={values.reSeedAfterEachRound}
                disabled={!editable}
                onChange={(reSeedAfterEachRound) =>
                  patch({ reSeedAfterEachRound })
                }
              />
              <FieldDescription>
                When yes, higher seeds always face the lowest remaining seed.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Two-week championship</FieldLabel>
              <YesNoRadio
                id="two-week"
                value={values.twoWeekChampionship}
                disabled={!editable}
                onChange={(twoWeekChampionship) =>
                  patch({ twoWeekChampionship })
                }
              />
              <FieldDescription>
                Combines two NFL weeks for the championship. Shortens the
                regular season by one week.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>1st round byes</FieldLabel>
              <p className="text-sm font-medium tabular-nums">
                {summary.firstRoundByes}
              </p>
            </Field>

            <Field>
              <FieldLabel>Playoff weeks</FieldLabel>
              <p className="text-sm font-medium tabular-nums">
                {summary.playoffWeeksLabel}
              </p>
              <FieldDescription>
                Regular season ends after Week {summary.regularSeasonEndWeek}.
              </FieldDescription>
            </Field>
          </>
        ) : (
          <Field>
            <FieldLabel htmlFor="season-end-week">Season end week</FieldLabel>
            <Select
              items={championshipItems}
              value={String(values.championshipWeek)}
              disabled={!editable}
              onValueChange={(value) => {
                if (!value) return;
                patch({
                  championshipWeek: Number(
                    value,
                  ) as PlayoffSettingsFormValues["championshipWeek"],
                });
              }}
            >
              <SelectTrigger id="season-end-week" className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {championshipItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              Without playoffs, the regular season runs through this week.
            </FieldDescription>
          </Field>
        )}
      </FieldGroup>

      <PageFormActions>
        {editable ? (
          <>
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
          </>
        ) : null}
      </PageFormActions>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
                    <AlertDialogHeader>
            <AlertDialogTitle>Regenerate schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              {willRegenerate
                ? `Saving updates the regular-season calendar (through Week ${summary.regularSeasonEndWeek}) and regenerates all regular-season matchups.`
                : `Saving updates the regular-season calendar (through Week ${summary.regularSeasonEndWeek}). Matchups will generate automatically when the league is full.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
                    <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button type="button" disabled={isPending} onClick={persist}>
              <HugeiconsIcon
                icon={
                  willRegenerate
                    ? ArrowReloadHorizontalIcon
                    : FloppyDiskIcon
                }
                strokeWidth={2}
                data-icon="inline-start"
              />
              {willRegenerate ? "Save & regenerate" : "Save"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
