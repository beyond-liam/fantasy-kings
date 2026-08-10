"use client";

import { NumberInput } from "@/components/ui/number-input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { applyLocalTime, formatLocalTime } from "@/lib/datetime/local-time";
import type { DraftStepValues } from "@/lib/leagues/wizard-schema";

const PICK_TIME_UNIT_ITEMS = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
] as const;

type DraftStepProps = {
  values: DraftStepValues;
  errors: Partial<Record<keyof DraftStepValues, string>>;
  onChange: (values: Partial<DraftStepValues>) => void;
};

export function DraftStep({ values, errors, onChange }: DraftStepProps) {
  const draftStartAt = new Date(values.draftStartAt);
  const draftTime = formatLocalTime(draftStartAt);
  const showPickClock =
    values.draftType === "live" || values.pickTimeLimitEnabled;

  const updateDraftStartAt = (date: Date, time: string) => {
    onChange({ draftStartAt: applyLocalTime(date, time).toISOString() });
  };

  const updateDraftDate = (date: Date | undefined) => {
    if (!date) {
      return;
    }
    updateDraftStartAt(date, draftTime || "19:00");
  };

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Draft format</FieldLabel>
        <RadioGroup
          variant="card"
          value={values.draftType}
          onValueChange={(value) => {
            const draftType = value as DraftStepValues["draftType"];
            if (draftType === "email") {
              onChange({
                draftType,
                pickTimeLimitEnabled: true,
                pickTimeLimit: 8,
                pickTimeUnit: "hours",
              });
              return;
            }
            onChange({
              draftType,
              pickTimeLimitEnabled: true,
              pickTimeLimit: 2,
              pickTimeUnit: "minutes",
            });
          }}
          className="sm:grid-cols-2"
        >
          <RadioGroupItem value="live">
            <span className="block text-sm font-medium">Live draft</span>
            <span className="block text-sm text-muted-foreground">
              Everyone drafts together in the draft room.
            </span>
          </RadioGroupItem>
          <RadioGroupItem value="email">
            <span className="block text-sm font-medium">Email draft</span>
            <span className="block text-sm text-muted-foreground">
              Same draft room — pick over hours or days with email alerts.
            </span>
          </RadioGroupItem>
        </RadioGroup>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="draftDate">Start date</FieldLabel>
          <DatePicker
            id="draftDate"
            value={draftStartAt}
            onChange={updateDraftDate}
            placeholder="Select date"
            minDate={new Date()}
          />
          {values.draftType === "email" ? (
            <FieldDescription>
              When the draft opens and the first pick becomes available.
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

      {values.draftType === "email" ? (
        <Field>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="min-w-0">
              <FieldLabel htmlFor="pickTimeLimitEnabled">
                Pick time limit
              </FieldLabel>
              <FieldDescription>
                Limit how long each manager has on the clock.
              </FieldDescription>
            </div>
            <Switch
              id="pickTimeLimitEnabled"
              checked={values.pickTimeLimitEnabled}
              onCheckedChange={(pickTimeLimitEnabled) =>
                onChange({ pickTimeLimitEnabled })
              }
            />
          </div>
        </Field>
      ) : null}

      {showPickClock ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pickTimeLimit">
              {values.draftType === "live" ? "Pick time limit" : "Time allowed"}
            </FieldLabel>
            <NumberInput
              id="pickTimeLimit"
              min={1}
              max={48}
              value={values.pickTimeLimit}
              onValueChange={(pickTimeLimit) => onChange({ pickTimeLimit })}
            />
            {errors.pickTimeLimit ? (
              <FieldError>{errors.pickTimeLimit}</FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="pickTimeUnit">Time unit</FieldLabel>
            <Select
              items={PICK_TIME_UNIT_ITEMS}
              value={values.pickTimeUnit}
              onValueChange={(value) => {
                if (value) {
                  onChange({
                    pickTimeUnit: value as DraftStepValues["pickTimeUnit"],
                  });
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
    </FieldGroup>
  );
}
