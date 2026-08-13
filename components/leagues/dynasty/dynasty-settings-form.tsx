"use client";

import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
import { updateDynastySettings } from "@/lib/actions/league-settings";
import { applyLocalTime, formatLocalTime } from "@/lib/datetime/local-time";
import {
  clampDynastyKeepersToRosterCap,
  keepersMaxDescription,
  maxCountingKeepersCap,
  type DynastyRosterKeeperCap,
  type DynastySettingsFormValues,
} from "@/lib/leagues/dynasty-settings";
import { ukTimezoneAbbrev } from "@/lib/datetime/uk-time";

type DynastySettingsFormProps = {
  slug: string;
  initialValues: DynastySettingsFormValues;
  rosterCap: DynastyRosterKeeperCap;
};

const DRAFT_POOL_ITEMS = [
  { value: "rookies", label: "Rookies only" },
  { value: "all", label: "All available players" },
] as const;

function valuesEqual(
  a: DynastySettingsFormValues,
  b: DynastySettingsFormValues,
) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function deadlineDate(iso: string | null): Date | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export function DynastySettingsForm({
  slug,
  initialValues,
  rosterCap,
}: DynastySettingsFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(() =>
    clampDynastyKeepersToRosterCap(initialValues, rosterCap),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges = !valuesEqual(values, initialValues);
  const deadlineEnabled = values.keeperDeadlineAt != null;
  const deadline = deadlineDate(values.keeperDeadlineAt);
  const deadlineTime = deadline ? formatLocalTime(deadline) : "19:00";
  const zone = ukTimezoneAbbrev(deadline ?? new Date());
  const countingCap = maxCountingKeepersCap(rosterCap, values);
  const keepersMaxHelp = keepersMaxDescription(rosterCap, values);
  const keepersMinCeiling = values.keepersMax ?? countingCap;

  const patch = (next: Partial<DynastySettingsFormValues>) => {
    setValues((current) =>
      clampDynastyKeepersToRosterCap({ ...current, ...next }, rosterCap),
    );
  };

  const updateDeadline = (date: Date, time: string) => {
    patch({ keeperDeadlineAt: applyLocalTime(date, time).toISOString() });
  };

  const handleReset = () => {
    setValues(clampDynastyKeepersToRosterCap(initialValues, rosterCap));
    setError(null);
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateDynastySettings(slug, values);
      if (!result.success) {
        setError(result.error ?? "Could not save dynasty rules.");
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
        title="Dynasty Rules"
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
            <FieldLabel htmlFor="keepersMax">Keepers max</FieldLabel>
            <FieldDescription>{keepersMaxHelp}</FieldDescription>
            <NumberInput
              id="keepersMax"
              className="mt-3 w-full max-w-40"
              min={0}
              max={countingCap}
              value={values.keepersMax}
              onClear={() => patch({ keepersMax: null })}
              onValueChange={(value) => {
                patch({
                  keepersMax: Math.min(countingCap, Math.max(0, value)),
                });
              }}
            />
          </Field>

          <SwitchField
            id="keepersMinEnabled"
            label="Require a keepers minimum"
            description="When on, each team must set at least this many counting keepers before clearance."
            checked={values.keepersMin != null}
            onCheckedChange={(checked) => {
              patch({
                keepersMin: checked
                  ? Math.min(keepersMinCeiling, values.keepersMin ?? 1)
                  : null,
              });
            }}
          />

          {values.keepersMin != null ? (
            <Field>
              <FieldLabel htmlFor="keepersMin">Keepers min</FieldLabel>
              <NumberInput
                id="keepersMin"
                className="mt-3 w-full max-w-40"
                min={0}
                max={keepersMinCeiling}
                value={values.keepersMin}
                onValueChange={(value) =>
                  patch({
                    keepersMin: Math.min(
                      keepersMinCeiling,
                      Math.max(0, value),
                    ),
                  })
                }
              />
            </Field>
          ) : null}

          <SwitchField
            id="keeperDeadlineEnabled"
            label="Keeper deadline"
            description={`At the deadline, non-keepers are cleared automatically.`}
            checked={deadlineEnabled}
            onCheckedChange={(checked) => {
              if (!checked) {
                patch({ keeperDeadlineAt: null });
                return;
              }
              const base = deadline ?? new Date();
              updateDeadline(base, deadlineTime || "19:00");
            }}
          />

          {deadlineEnabled ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="keeperDeadlineDate">
                  Deadline date
                </FieldLabel>
                <DatePicker
                  id="keeperDeadlineDate"
                  value={deadline}
                  onChange={(date) => {
                    if (!date) return;
                    updateDeadline(date, deadlineTime || "19:00");
                  }}
                  placeholder="Select date"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="keeperDeadlineTime">
                  Deadline time
                </FieldLabel>
                <TimePicker
                  id="keeperDeadlineTime"
                  value={deadlineTime}
                  onChange={(time) => {
                    const base = deadline ?? new Date();
                    updateDeadline(base, time);
                  }}
                />
              </Field>
            </div>
          ) : null}

          <SwitchField
            id="irCountsTowardKeepers"
            label="IR counts toward keepers max"
            description="When off, keepers on IR do not consume a keepers-max slot."
            checked={values.irCountsTowardKeepers}
            onCheckedChange={(checked) =>
              patch({ irCountsTowardKeepers: checked })
            }
          />

          <SwitchField
            id="taxiCountsTowardKeepers"
            label="Taxi counts toward keepers max"
            description="When off, keepers on Taxi do not consume a keepers-max slot."
            checked={values.taxiCountsTowardKeepers}
            onCheckedChange={(checked) =>
              patch({ taxiCountsTowardKeepers: checked })
            }
          />

          <Field>
            <FieldLabel htmlFor="futurePickTradeYears">
              Future pick trade years
            </FieldLabel>
            <FieldDescription>
              How many future draft years beyond the upcoming draft can be owned
              and traded.
            </FieldDescription>
            <NumberInput
              id="futurePickTradeYears"
              className="mt-3 w-full max-w-40"
              min={1}
              max={10}
              value={values.futurePickTradeYears}
              onValueChange={(value) =>
                patch({ futurePickTradeYears: Math.max(1, value) })
              }
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="draftPlayerPool">
              Dynasty draft player pool
            </FieldLabel>
            <FieldDescription>
              Who is eligible in year-2+ dynasty drafts (after keepers).
            </FieldDescription>
            <Select
              items={[...DRAFT_POOL_ITEMS]}
              value={values.draftPlayerPool}
              onValueChange={(value) => {
                if (value === "rookies" || value === "all") {
                  patch({ draftPlayerPool: value });
                }
              }}
            >
              <SelectTrigger id="draftPlayerPool" className="mt-3 w-full">
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
          </Field>
        </FieldGroup>
      </SettingsFormCard>
    </div>
  );
}
