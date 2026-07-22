"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PageFormActions } from "@/components/layout/page-form-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import { updateDraftConfig } from "@/lib/actions/league-settings";
import type { DraftConfigFormValues } from "@/lib/leagues/draft-settings";
import { cn } from "@/lib/utils";

const PICK_TIME_UNIT_ITEMS = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
] as const;

type DraftConfigSettingsProps = {
  slug: string;
  leagueName: string;
  initialValues: DraftConfigFormValues;
};

function valuesEqual(a: DraftConfigFormValues, b: DraftConfigFormValues) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function OptionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
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

export function DraftConfigSettings({
  slug,
  leagueName,
  initialValues,
}: DraftConfigSettingsProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges = !valuesEqual(values, initialValues);
  const draftStartAt = new Date(values.draftStartAt);
  const draftTime = values.draftStartAt.slice(11, 16);

  const patch = (next: Partial<DraftConfigFormValues>) => {
    setValues((current) => ({ ...current, ...next }));
  };

  const updateDraftStartAt = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const next = new Date(date);
    next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    patch({ draftStartAt: next.toISOString() });
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateDraftConfig(slug, values);
      if (!result.success) {
        setError(result.error ?? "Could not save draft settings.");
        return;
      }
      router.refresh();
    });
  };

  const handleReset = () => {
    setValues(initialValues);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Configure Draft
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {leagueName} · Set format, clock, and autopick defaults.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field>
          <FieldLabel>Draft type</FieldLabel>
          <RadioGroup
            value={values.draftType}
            onValueChange={(value) => {
              if (value === "live" || value === "email") {
                patch({ draftType: value });
              }
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <OptionLabel>
              <RadioGroupItem value="live" className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Live draft</span>
                <span className="block text-sm text-muted-foreground">
                  Everyone drafts together on a set start time.
                </span>
              </span>
            </OptionLabel>
            <OptionLabel>
              <RadioGroupItem value="email" className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Slow draft</span>
                <span className="block text-sm text-muted-foreground">
                  Async picks. Email alerts come later — picks work without
                  them.
                </span>
              </span>
            </OptionLabel>
          </RadioGroup>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="draftDate">Start date</FieldLabel>
            <DatePicker
              id="draftDate"
              value={draftStartAt}
              onChange={(date) => {
                if (!date) return;
                updateDraftStartAt(date, draftTime || "19:00");
              }}
              placeholder="Select date"
            />
            {values.draftType === "email" ? (
              <FieldDescription>
                When the slow draft opens and the first pick becomes available.
              </FieldDescription>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="draftTime">Start time</FieldLabel>
            <TimePicker
              id="draftTime"
              value={draftTime}
              onChange={(time) => updateDraftStartAt(draftStartAt, time)}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel>Draft style</FieldLabel>
          <RadioGroup
            value={values.draftStyle}
            onValueChange={(value) => {
              if (value === "snake" || value === "linear") {
                patch({ draftStyle: value });
              }
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <OptionLabel>
              <RadioGroupItem value="snake" className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Snake</span>
                <span className="block text-sm text-muted-foreground">
                  Order reverses each round.
                </span>
              </span>
            </OptionLabel>
            <OptionLabel>
              <RadioGroupItem value="linear" className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Linear</span>
                <span className="block text-sm text-muted-foreground">
                  Same order every round.
                </span>
              </span>
            </OptionLabel>
          </RadioGroup>
        </Field>

        {values.draftType === "email" ? (
          <Field>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div className="min-w-0">
                <FieldLabel htmlFor="pickTimeLimitEnabled">
                  Pick time limit
                </FieldLabel>
                <FieldDescription>
                  Limit how long each manager has on the clock. Off means
                  unlimited until they pick.
                </FieldDescription>
              </div>
              <Switch
                id="pickTimeLimitEnabled"
                checked={values.pickTimeLimitEnabled}
                onCheckedChange={(pickTimeLimitEnabled) =>
                  patch({
                    pickTimeLimitEnabled,
                    ...(pickTimeLimitEnabled
                      ? {}
                      : { autoPickEnabled: false }),
                  })
                }
              />
            </div>
          </Field>
        ) : null}

        {values.draftType === "live" || values.pickTimeLimitEnabled ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="pickTimeLimit">
                {values.draftType === "live"
                  ? "Pick time limit"
                  : "Time allowed"}
              </FieldLabel>
              <NumberInput
                id="pickTimeLimit"
                min={1}
                max={48}
                value={values.pickTimeLimit}
                onValueChange={(pickTimeLimit) => patch({ pickTimeLimit })}
              />
              <FieldDescription>
                How long each manager has on the clock.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="pickTimeUnit">Time unit</FieldLabel>
              <Select
                items={[...PICK_TIME_UNIT_ITEMS]}
                value={values.pickTimeUnit}
                onValueChange={(value) => {
                  if (value === "minutes" || value === "hours") {
                    patch({ pickTimeUnit: value });
                  }
                }}
              >
                <SelectTrigger id="pickTimeUnit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PICK_TIME_UNIT_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}

        {values.draftType === "live" || values.pickTimeLimitEnabled ? (
          <Field>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div className="min-w-0">
                <FieldLabel htmlFor="autoPickEnabled">
                  Enable auto-pick
                </FieldLabel>
                <FieldDescription>
                  When on, teams default to autopick (queue first, then best
                  available). Managers can still change this later per team.
                </FieldDescription>
              </div>
              <Switch
                id="autoPickEnabled"
                checked={values.autoPickEnabled}
                onCheckedChange={(autoPickEnabled) =>
                  patch({ autoPickEnabled })
                }
              />
            </div>
          </Field>
        ) : null}
      </FieldGroup>

      <PageFormActions>
        <Button
          type="button"
          variant="ghost"
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
          disabled={isPending || !hasChanges}
          onClick={handleSave}
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
