"use client";

import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { TransactionsStepValues } from "@/lib/leagues/wizard-schema";

type TransactionsStepProps = {
  values: TransactionsStepValues;
  errors: Partial<Record<keyof TransactionsStepValues, string>>;
  tradeWeekOptions: number[];
  onChange: (values: Partial<TransactionsStepValues>) => void;
};

export function TransactionsStep({
  values,
  errors,
  tradeWeekOptions,
  onChange,
}: TransactionsStepProps) {
  return (
    <FieldGroup>
      <Field orientation="horizontal">
        <div className="flex flex-1 flex-col gap-1">
          <FieldLabel htmlFor="waiversEnabled">Waivers</FieldLabel>
          <p className="text-sm text-muted-foreground">
            Require claims for free agent adds.
          </p>
        </div>
        <Switch
          id="waiversEnabled"
          checked={values.waiversEnabled}
          onCheckedChange={(checked) => onChange({ waiversEnabled: checked })}
        />
      </Field>

      {values.waiversEnabled ? (
        <>
          <Field>
            <FieldLabel>Waiver system</FieldLabel>
            <RadioGroup
              value={values.waiverType}
              onValueChange={(value) =>
                onChange({
                  waiverType: value as TransactionsStepValues["waiverType"],
                })
              }
              className="grid gap-3 sm:grid-cols-2"
            >
              <Label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="priority" />
                Rolling priority
              </Label>
              <Label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="faab" />
                FAAB budget
              </Label>
            </RadioGroup>
          </Field>
          {values.waiverType === "faab" ? (
            <Field>
              <FieldLabel htmlFor="faabBudget">FAAB budget</FieldLabel>
              <NumberInput
                id="faabBudget"
                min={1}
                value={values.faabBudget}
                onValueChange={(faabBudget) => onChange({ faabBudget })}
              />
              {errors.faabBudget ? (
                <FieldError>{errors.faabBudget}</FieldError>
              ) : null}
            </Field>
          ) : null}
        </>
      ) : null}

      <Field orientation="horizontal">
        <div className="flex flex-1 flex-col gap-1">
          <FieldLabel htmlFor="tradesEnabled">Trades</FieldLabel>
          <p className="text-sm text-muted-foreground">
            Allow managers to trade players.
          </p>
        </div>
        <Switch
          id="tradesEnabled"
          checked={values.tradesEnabled}
          onCheckedChange={(checked) => onChange({ tradesEnabled: checked })}
        />
      </Field>

      {values.tradesEnabled ? (
        <>
          <Field>
            <FieldLabel>Trade processing</FieldLabel>
            <RadioGroup
              value={values.tradeProcessing}
              onValueChange={(value) =>
                onChange({
                  tradeProcessing:
                    value as TransactionsStepValues["tradeProcessing"],
                })
              }
              className="grid gap-3"
            >
              {[
                { value: "commissioner", label: "Commissioner approval" },
                { value: "review_24h", label: "24-hour review" },
                { value: "instant", label: "Instant processing" },
              ].map((option) => (
                <Label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                >
                  <RadioGroupItem value={option.value} />
                  {option.label}
                </Label>
              ))}
            </RadioGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="tradeDeadlineWeek">Trade deadline</FieldLabel>
            <Select
              items={tradeWeekOptions.map((week) => ({
                value: String(week),
                label: `After week ${week}`,
              }))}
              value={String(values.tradeDeadlineWeek)}
              onValueChange={(value) => {
                if (value) {
                  onChange({ tradeDeadlineWeek: Number(value) });
                }
              }}
            >
              <SelectTrigger id="tradeDeadlineWeek" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {tradeWeekOptions.map((week) => (
                    <SelectItem key={week} value={String(week)}>
                      After week {week}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </>
      ) : null}
    </FieldGroup>
  );
}
