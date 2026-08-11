"use client";

import {
  ArrowReloadHorizontalIcon,
  Cancel01Icon,
  TickDouble02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { SettingsFormCard } from "@/components/leagues/settings/settings-form-card";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SwitchField } from "@/components/ui/switch-field";
import { PRESEASON_START_WEEK_OPTIONS } from "@/lib/account/schedule-settings";
import type { PlayEachOtherTimes } from "@/db/schema/league-seasons";
import {
  regenerateRegularSeasonSchedule,
  updateRegularSeasonSchedule,
} from "@/lib/actions/league-settings";
import { fantasyRegularSeasonEndWeek } from "@/lib/leagues/schedule/fantasy-week-map";
import {
  clampPlayEachOtherTimes,
  maxPlayEachOtherTimes,
  PLAY_EACH_OTHER_OPTIONS,
} from "@/lib/leagues/schedule/settings";

type ScheduleSettingsFormProps = {
  slug: string;
  leagueName: string;
  seasonStatus: string;
  divisionCount: number;
  teamCount: number;
  regularSeasonEndWeek: number;
  initialPlayEachOtherTimes: PlayEachOtherTimes;
  initialIncludePreseason: boolean;
  initialPreseasonStartWeek: number;
  isLeagueFull: boolean;
  matchupCount: number;
  editable: boolean;
};

function timesLabel(times: PlayEachOtherTimes) {
  if (times === 1) return "Once";
  return `${times} Times`;
}

export function ScheduleSettingsForm({
  slug,
  divisionCount,
  teamCount,
  regularSeasonEndWeek,
  initialPlayEachOtherTimes,
  initialIncludePreseason,
  initialPreseasonStartWeek,
  isLeagueFull,
  matchupCount,
  editable,
}: ScheduleSettingsFormProps) {
  const router = useRouter();
  const maxTimes = maxPlayEachOtherTimes(divisionCount);
  const [times, setTimes] = useState(
    clampPlayEachOtherTimes(initialPlayEachOtherTimes, divisionCount),
  );
  const [includePreseason, setIncludePreseason] = useState(
    initialIncludePreseason,
  );
  const [preseasonStartWeek, setPreseasonStartWeek] = useState(
    initialPreseasonStartWeek,
  );
  const [error, setError] = useState<string | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasChanges =
    times !== initialPlayEachOtherTimes ||
    includePreseason !== initialIncludePreseason ||
    preseasonStartWeek !== initialPreseasonStartWeek;
  const options = PLAY_EACH_OTHER_OPTIONS.filter((option) => option <= maxTimes);
  const fantasyWeekCount = fantasyRegularSeasonEndWeek(regularSeasonEndWeek, {
    playEachOtherTimes: times,
    includePreseason,
    preseasonStartWeek,
  });
  const weekItems = PRESEASON_START_WEEK_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  const handleReset = () => {
    setTimes(clampPlayEachOtherTimes(initialPlayEachOtherTimes, divisionCount));
    setIncludePreseason(initialIncludePreseason);
    setPreseasonStartWeek(initialPreseasonStartWeek);
    setError(null);
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateRegularSeasonSchedule(slug, {
        playEachOtherTimes: times,
        includePreseason,
        preseasonStartWeek,
      });
      if (!result.success) {
        setError(result.error ?? "Could not save schedule settings.");
        return;
      }
      router.refresh();
    });
  };

  const handleRegenerate = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await regenerateRegularSeasonSchedule(slug);
        if (!result.success) {
          setError(result.error ?? "Could not regenerate schedule.");
          setRegenOpen(false);
          return;
        }
        setRegenOpen(false);
        router.refresh();
      } catch {
        setError("Could not regenerate schedule.");
        setRegenOpen(false);
      }
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {!editable ? (
        <Alert>
          <AlertDescription>
            Schedule settings lock once the fantasy season begins.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <SettingsFormCard
        title="Regular Season Schedule"
        footer={
          editable ? (
            <>
              {!hasChanges ? (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending || !isLeagueFull}
                    onClick={() => setRegenOpen(true)}
                  >
                    <HugeiconsIcon
                      icon={ArrowReloadHorizontalIcon}
                      strokeWidth={2}
                      data-icon="inline-start"
                    />
                    Regenerate Schedule
                  </Button>
                </div>
              ) : null}
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
                  variant="outline"
                  disabled={isPending || !isLeagueFull}
                  onClick={() => setRegenOpen(true)}
                >
                  <HugeiconsIcon
                    icon={ArrowReloadHorizontalIcon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  Regenerate Schedule
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
            </>
          ) : undefined
        }
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="play-each-other">Play each other</FieldLabel>
            <Select
              items={options.map((option) => ({
                value: String(option),
                label: timesLabel(option),
              }))}
              value={String(times)}
              disabled={!editable}
              onValueChange={(value) => {
                if (!value) return;
                setTimes(
                  clampPlayEachOtherTimes(Number(value), divisionCount),
                );
              }}
            >
              <SelectTrigger id="play-each-other" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {options.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {timesLabel(option)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              {divisionCount <= 1
                ? "Single-division leagues play each other once. Everyone faces everyone before any rematch. Rematches only fill leftover weeks after that first cycle."
                : "Choose how many times opponents play each other over the regular season (time permitting). Multi-division leagues can select up to three."}
            </FieldDescription>
          </Field>

          <SwitchField
            id="includePreseason"
            label="Include preseason"
            description="Extend the fantasy schedule so Week 1 starts in NFL preseason. Championship still ends on the configured NFL championship week."
            checked={includePreseason}
            disabled={!editable}
            onCheckedChange={setIncludePreseason}
          />

          {includePreseason ? (
            <Field>
              <FieldLabel htmlFor="preseasonStartWeek">
                Preseason start week
              </FieldLabel>
              <Select
                items={weekItems}
                value={String(preseasonStartWeek)}
                disabled={!editable}
                onValueChange={(next) => {
                  if (next == null) return;
                  const week = Number(next);
                  if (!Number.isFinite(week)) return;
                  setPreseasonStartWeek(week);
                }}
              >
                <SelectTrigger id="preseasonStartWeek" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PRESEASON_START_WEEK_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field>
            <FieldLabel>Calendar</FieldLabel>
            <FieldDescription>
              {teamCount} teams · weeks 1–{fantasyWeekCount}
              {includePreseason
                ? ` (NFL regular season ends week ${regularSeasonEndWeek})`
                : null}
              {isLeagueFull
                ? matchupCount > 0
                  ? ` · ${matchupCount} matchups generated`
                  : " · schedule will generate on save"
                : " · schedule generates automatically when the league is full"}
            </FieldDescription>
          </Field>
        </FieldGroup>
      </SettingsFormCard>

      <AlertDialog
        open={regenOpen}
        onOpenChange={(open) => {
          if (isPending && !open) return;
          setRegenOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces all regular-season matchups for weeks 1–
              {fantasyWeekCount} using the current schedule settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleRegenerate}
            >
              <HugeiconsIcon
                icon={ArrowReloadHorizontalIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              {isPending ? "Regenerating…" : "Regenerate"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
