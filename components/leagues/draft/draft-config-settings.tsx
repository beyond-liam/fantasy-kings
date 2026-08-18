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
  FORCE_AUTOPICK_AFTER_TWO_EXPIRES_COPY,
  pickClockApplies,
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

const DRAFT_POOL_ITEMS = [
  { value: "rookies", label: "Rookies only" },
  { value: "all", label: "All available players" },
] as const;

type DynastyDraftConfigMeta = {
  isStartup: boolean;
  maxRounds: number;
  rosterCap: number;
  keepersMax: number | null;
};

type DraftConfigSettingsProps = {
  slug: string;
  leagueName: string;
  initialValues: DraftConfigFormValues;
  dynasty?: DynastyDraftConfigMeta | null;
};

export function DraftConfigSettings({
  slug,
  initialValues,
  dynasty = null,
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

        {dynasty ? (
          <>
            <Field data-disabled={dynasty.isStartup || dynasty.maxRounds === 0}>
              <FieldLabel htmlFor="draftRounds">Number of rounds</FieldLabel>
              <NumberInput
                id="draftRounds"
                min={dynasty.maxRounds === 0 ? 0 : 1}
                max={dynasty.maxRounds}
                value={values.draftRounds ?? dynasty.maxRounds}
                disabled={dynasty.isStartup || dynasty.maxRounds === 0}
                onValueChange={(draftRounds) => patch({ draftRounds })}
              />
              <FieldDescription>
                {dynastyRoundsDescription(dynasty)}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="draftPlayerPool">Player pool</FieldLabel>
              <Select
                items={[...DRAFT_POOL_ITEMS]}
                value={values.draftPlayerPool ?? "rookies"}
                onValueChange={(value) => {
                  if (value === "rookies" || value === "all") {
                    patch({ draftPlayerPool: value });
                  }
                }}
              >
                <SelectTrigger id="draftPlayerPool" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {DRAFT_POOL_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                {dynasty.isStartup
                  ? "Startup drafts include all available players. This applies to later drafts after keepers."
                  : "Who can be drafted after keepers are set."}
              </FieldDescription>
            </Field>
          </>
        ) : null}

        {values.draftType === "email" ? (
          <SwitchField
            id="pickTimeLimitEnabled"
            label="Pick time limit"
            description="Limit how long each manager has on the clock. Expired picks autodraft from the queue, then best available."
            checked={values.pickTimeLimitEnabled}
            onCheckedChange={(pickTimeLimitEnabled) =>
              patch({
                pickTimeLimitEnabled,
                autoPickEnabled: pickTimeLimitEnabled,
                ...(pickTimeLimitEnabled
                  ? {}
                  : {
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
                How long each manager has on the clock. Expired picks autodraft
                from the queue, then best available.
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

        {pickClockApplies(values) ? (
          <SwitchField
            id="forceAutopickAfterTwoExpires"
            label={FORCE_AUTOPICK_AFTER_TWO_EXPIRES_COPY.label}
            description={FORCE_AUTOPICK_AFTER_TWO_EXPIRES_COPY.description}
            checked={values.forceAutopickAfterTwoExpires}
            onCheckedChange={(forceAutopickAfterTwoExpires) =>
              patch({ forceAutopickAfterTwoExpires })
            }
          />
        ) : null}

        {values.draftType === "email" && values.pickTimeLimitEnabled ? (
          <>
            <SwitchField
              id="pauseWindowEnabled"
              label="Pause during a time window"
              description="Automatically pause the pick clock each day between these UK times (e.g. overnight). Teams can still pick; the clock starts again when the window ends."
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

function dynastyRoundsDescription(dynasty: DynastyDraftConfigMeta): string {
  if (dynasty.isStartup) {
    const spare = Math.max(0, dynasty.rosterCap - (dynasty.keepersMax ?? 0));
    const later =
      dynasty.keepersMax != null
        ? ` Later drafts cap at ${spare} round${spare === 1 ? "" : "s"} after keepers.`
        : "";
    return `Startup draft fills every roster spot (${dynasty.rosterCap} rounds).${later}`;
  }
  if (dynasty.keepersMax == null) {
    return "Set keepers max in Dynasty Rules to cap rounds at spare roster spots.";
  }
  return `At most ${dynasty.maxRounds} round${dynasty.maxRounds === 1 ? "" : "s"} (roster minus keepers max).`;
}
