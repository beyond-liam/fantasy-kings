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
