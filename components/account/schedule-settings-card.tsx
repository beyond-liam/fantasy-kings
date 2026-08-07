"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  PRESEASON_START_WEEK_OPTIONS,
  type ScheduleSettingsValues,
} from "@/lib/account/schedule-settings";
import { updateScheduleSettings } from "@/lib/actions/schedule-settings";

type ScheduleSettingsCardProps = {
  initialValues: ScheduleSettingsValues;
};

export function ScheduleSettingsCard({
  initialValues,
}: ScheduleSettingsCardProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useTransition();

  const save = (next: ScheduleSettingsValues) => {
    const previous = values;
    setValues(next);
    startTransition(async () => {
      const result = await updateScheduleSettings(next);
      if (!result.success) {
        setValues(previous);
        toast.error(result.error ?? "Could not update schedule settings.");
        return;
      }
      toast.success("Schedule settings saved");
      router.refresh();
    });
  };

  const weekItems = PRESEASON_START_WEEK_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  return (
    <Card size="sm" className="gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle className="text-base text-balance">NFL schedule</CardTitle>
      </CardHeader>
      <CardContent className="py-4">
        <FieldGroup>
          <Field>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <FieldLabel htmlFor="includePreseason">
                  Include preseason
                </FieldLabel>
                <FieldDescription>
                  Show preseason weeks in NFL Scores.
                </FieldDescription>
              </div>
              <Switch
                id="includePreseason"
                checked={values.includePreseason}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  save({ ...values, includePreseason: checked })
                }
              />
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="preseasonStartWeek">
              Preseason start week
            </FieldLabel>
            <FieldDescription>
              Hide earlier preseason weeks from the schedule.
            </FieldDescription>
            <Select
              items={weekItems}
              value={String(values.preseasonStartWeek)}
              disabled={!values.includePreseason || isPending}
              onValueChange={(next) => {
                if (next == null) return;
                const week = Number(next);
                if (!Number.isFinite(week)) return;
                save({ ...values, preseasonStartWeek: week });
              }}
            >
              <SelectTrigger id="preseasonStartWeek" className="w-full max-w-xs">
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
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
