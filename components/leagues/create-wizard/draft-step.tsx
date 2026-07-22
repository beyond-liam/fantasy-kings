"use client";

import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  const draftTime = values.draftStartAt.slice(11, 16);

  const updateDraftStartAt = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const next = new Date(date);
    next.setHours(hours, minutes, 0, 0);
    onChange({ draftStartAt: next.toISOString() });
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
          value={values.draftType}
          onValueChange={(value) =>
            onChange({ draftType: value as DraftStepValues["draftType"] })
          }
          className="grid gap-3 sm:grid-cols-2"
        >
          <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
            <RadioGroupItem value="live" />
            <div>
              <p className="font-medium">Live draft</p>
              <p className="text-sm text-muted-foreground">
                Everyone drafts together in the draft room.
              </p>
            </div>
          </Label>
          <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
            <RadioGroupItem value="email" />
            <div>
              <p className="font-medium">Email draft</p>
              <p className="text-sm text-muted-foreground">
                Async picks with email alerts when you&apos;re on the clock.
              </p>
            </div>
          </Label>
        </RadioGroup>
        {values.draftType === "email" ? (
          <p className="text-sm text-muted-foreground">
            Email notifications will be enabled when the notification service is
            wired up.
          </p>
        ) : null}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="draftDate">Start date</FieldLabel>
          <DatePicker
            id="draftDate"
            value={draftStartAt}
            onChange={updateDraftDate}
            placeholder="Select date"
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="pickTimeLimit">Pick time limit</FieldLabel>
          <NumberInput
            id="pickTimeLimit"
            min={1}
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
    </FieldGroup>
  );
}
