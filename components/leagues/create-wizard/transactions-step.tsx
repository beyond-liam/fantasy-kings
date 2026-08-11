"use client";

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
      <SwitchField
        id="waiversEnabled"
        label="Waivers"
        description="Require claims for free agent adds."
        checked={values.waiversEnabled}
        onCheckedChange={(checked) => onChange({ waiversEnabled: checked })}
      />

      {values.waiversEnabled ? (
        <>
          <Field>
            <FieldLabel>Waiver system</FieldLabel>
            <RadioGroup
              variant="card"
              value={values.waiverType}
              onValueChange={(value) =>
                onChange({
                  waiverType: value as TransactionsStepValues["waiverType"],
                })
              }
              className="sm:grid-cols-2"
            >
              <RadioGroupItem value="priority">
                <span className="text-sm font-medium">Rolling priority</span>
              </RadioGroupItem>
              <RadioGroupItem value="faab">
                <span className="text-sm font-medium">FAAB budget</span>
              </RadioGroupItem>
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

      <SwitchField
        id="tradesEnabled"
        label="Trades"
        description="Allow managers to trade players."
        checked={values.tradesEnabled}
        onCheckedChange={(checked) => onChange({ tradesEnabled: checked })}
      />

      {values.tradesEnabled ? (
        <>
          <Field>
            <FieldLabel>Trade processing</FieldLabel>
            <RadioGroup
              variant="card"
              value={values.tradeProcessing}
              onValueChange={(value) =>
                onChange({
                  tradeProcessing:
                    value as TransactionsStepValues["tradeProcessing"],
                })
              }
            >
              {[
                { value: "commissioner", label: "Commissioner approval" },
                { value: "review_24h", label: "24-hour review" },
                { value: "instant", label: "Instant processing" },
              ].map((option) => (
                <RadioGroupItem key={option.value} value={option.value}>
                  <span className="text-sm font-medium">{option.label}</span>
                </RadioGroupItem>
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
