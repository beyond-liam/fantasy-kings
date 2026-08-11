"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { SettingsFormCard } from "@/components/leagues/settings/settings-form-card";
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
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SwitchField } from "@/components/ui/switch-field";
import { TimePicker } from "@/components/ui/time-picker";
import { updateDraftConfig } from "@/lib/actions/league-settings";
import { applyLocalTime, formatLocalTime } from "@/lib/datetime/local-time";
import { jsonEqual } from "@/lib/json-equal";
import {
  normalizeDraftConfigFormValues,
  DEFAULT_PAUSE_WINDOW_END,
  DEFAULT_PAUSE_WINDOW_START,
  type DraftConfigFormValues,
} from "@/lib/leagues/draft-settings";

const PICK_TIME_UNIT_ITEMS = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
] as const;

const DRAFT_TYPE_ITEMS = [
  { value: "live", label: "Live draft" },
  { value: "email", label: "Email draft" },
] as const;

const DRAFT_STYLE_ITEMS = [
  { value: "snake", label: "Snake" },
  { value: "linear", label: "Linear" },
] as const;

type DraftConfigSettingsProps = {
  slug: string;
  leagueName: string;
  initialValues: DraftConfigFormValues;
};

export function DraftConfigSettings({
  slug,
  initialValues,
}: DraftConfigSettingsProps) {
  const router = useRouter();
  const [baseline, setBaseline] = useState(() =>
    normalizeDraftConfigFormValues(initialValues),
  );
  const [values, setValues] = useState(() =>
    normalizeDraftConfigFormValues(initialValues),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges = !jsonEqual(values, baseline);
  const draftStartAt = new Date(values.draftStartAt);
  const draftTime = formatLocalTime(draftStartAt);

  const patch = (next: Partial<DraftConfigFormValues>) => {
    setValues((current) =>
      normalizeDraftConfigFormValues({ ...current, ...next }),
    );
  };

  const updateDraftStartAt = (date: Date, time: string) => {
    patch({ draftStartAt: applyLocalTime(date, time).toISOString() });
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const next = normalizeDraftConfigFormValues(values);
      const result = await updateDraftConfig(slug, next);
      if (!result.success) {
        const message = result.error ?? "Could not save draft settings.";
        setError(message);
        toast.error(message);
        return;
      }
      setValues(next);
      setBaseline(next);
      toast.success("Draft settings saved");
      router.refresh();
    });
  };

  const handleReset = () => {
    setValues(baseline);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <SettingsFormCard
        title="Configure Draft"
        footer={
          <PageFormActions float={hasChanges}>
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
        }
      >
        <FieldGroup>
        <Field>
          <FieldLabel htmlFor="draftType">Draft type</FieldLabel>
          <Select
            items={DRAFT_TYPE_ITEMS.map(({ value, label }) => ({
              value,
              label,
            }))}
            value={values.draftType}
            onValueChange={(value) => {
              if (value === "live") {
                patch({
                  draftType: "live",
                  pickTimeLimitEnabled: true,
                  pickTimeLimit: 2,
                  pickTimeUnit: "minutes",
                  pauseWindowEnabled: false,
                });
                return;
              }
              if (value === "email") {
                patch({
                  draftType: "email",
                  pickTimeLimitEnabled: true,
                  pickTimeLimit: 8,
                  pickTimeUnit: "hours",
                });
              }
            }}
          >
            <SelectTrigger id="draftType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {DRAFT_TYPE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
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
              minDate={new Date()}
            />
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
          <FieldLabel htmlFor="draftStyle">Draft style</FieldLabel>
          <Select
            items={[...DRAFT_STYLE_ITEMS]}
            value={values.draftStyle}
            onValueChange={(value) => {
              if (value === "snake" || value === "linear") {
                patch({ draftStyle: value });
              }
            }}
          >
            <SelectTrigger id="draftStyle" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {DRAFT_STYLE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldDescription>
            {values.draftStyle === "snake"
              ? "Order reverses each round."
              : "Same order every round."}
          </FieldDescription>
        </Field>

        {values.draftType === "email" ? (
          <SwitchField
            id="pickTimeLimitEnabled"
            label="Pick time limit"
            description="Limit how long each manager has on the clock."
            checked={values.pickTimeLimitEnabled}
            onCheckedChange={(pickTimeLimitEnabled) =>
              patch({
                pickTimeLimitEnabled,
                ...(pickTimeLimitEnabled
                  ? {}
                  : {
                      autoPickEnabled: false,
                      pauseWindowEnabled: false,
                    }),
              })
            }
          />
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
          <SwitchField
            id="autoPickEnabled"
            label="Enable auto pick"
            description="When on, teams default to autopick (queue first, then best available). Managers can still change this later per team."
            checked={values.autoPickEnabled}
            onCheckedChange={(autoPickEnabled) => patch({ autoPickEnabled })}
          />
        ) : null}

        {values.draftType === "email" && values.pickTimeLimitEnabled ? (
          <>
            <SwitchField
              id="pauseWindowEnabled"
              label="Pause during a time window"
              description="Automatically pause the draft clock each day between these UK times (e.g. overnight)."
              checked={values.pauseWindowEnabled}
              onCheckedChange={(pauseWindowEnabled) =>
                patch({
                  pauseWindowEnabled,
                  ...(pauseWindowEnabled
                    ? {
                        pauseWindowStart:
                          values.pauseWindowStart ||
                          DEFAULT_PAUSE_WINDOW_START,
                        pauseWindowEnd:
                          values.pauseWindowEnd || DEFAULT_PAUSE_WINDOW_END,
                      }
                    : {}),
                })
              }
            />
            {values.pauseWindowEnabled ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="pauseWindowStart">
                    Pause starts
                  </FieldLabel>
                  <TimePicker
                    id="pauseWindowStart"
                    value={values.pauseWindowStart}
                    onChange={(pauseWindowStart) =>
                      patch({ pauseWindowStart })
                    }
                  />
                  <FieldDescription>
                    Clock freezes from this time.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="pauseWindowEnd">
                    Pause ends
                  </FieldLabel>
                  <TimePicker
                    id="pauseWindowEnd"
                    value={values.pauseWindowEnd}
                    onChange={(pauseWindowEnd) => patch({ pauseWindowEnd })}
                  />
                  <FieldDescription>
                    Draft resumes at this time. Overnight windows are allowed.
                  </FieldDescription>
                </Field>
              </div>
            ) : null}
          </>
        ) : null}
        </FieldGroup>
      </SettingsFormCard>
    </div>
  );
}
