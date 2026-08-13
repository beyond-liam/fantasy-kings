"use client";

import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SettingsFormCard } from "@/components/leagues/settings/settings-form-card";
import { PageFormActions } from "@/components/layout/page-form-actions";
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
import { updateTransactionRules } from "@/lib/actions/league-settings";
import {
  TRADE_PROCESSING_OPTIONS,
  buildWeekDeadlineOptions,
  type TransactionRulesFormValues,
} from "@/lib/leagues/transaction-rules";

type TransactionRulesSettingsProps = {
  slug: string;
  leagueName: string;
  seasonStatus: string;
  maxWeek: number;
  initialValues: TransactionRulesFormValues;
};

const NONE_VALUE = "none";

const YES_NO_ITEMS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

const TRANSACTION_LIMIT_ITEMS = [
  { value: "unlimited", label: "Unlimited" },
  { value: "weekly", label: "Weekly limit only" },
  { value: "season", label: "Season limit only" },
  { value: "both", label: "Both weekly and season limits" },
] as const;

function valuesEqual(
  a: TransactionRulesFormValues,
  b: TransactionRulesFormValues,
) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function YesNoField({
  id,
  label,
  description,
  value,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <Select
        items={[...YES_NO_ITEMS]}
        value={value ? "yes" : "no"}
        onValueChange={(next) => {
          if (next === "yes" || next === "no") {
            onChange(next === "yes");
          }
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {YES_NO_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

export function TransactionRulesSettings({
  slug,
  maxWeek,
  initialValues,
}: TransactionRulesSettingsProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges = !valuesEqual(values, initialValues);
  const weekOptions = buildWeekDeadlineOptions(maxWeek);
  const deadlineItems = [
    { value: NONE_VALUE, label: "None" },
    ...weekOptions,
  ];
  const tradeProcessingItems = TRADE_PROCESSING_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  const patch = (next: Partial<TransactionRulesFormValues>) => {
    setValues((current) => ({ ...current, ...next }));
  };

  const handleReset = () => {
    setValues(initialValues);
    setError(null);
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateTransactionRules(slug, values);
      if (!result.success) {
        setError(result.error ?? "Could not save transaction rules.");
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
        title="Transaction Rules"
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
          <SwitchField
            id="tradesEnabled"
            label="Trades"
            description="Allow managers to trade players."
            checked={values.tradesEnabled}
            onCheckedChange={(checked) => patch({ tradesEnabled: checked })}
          />

          {values.tradesEnabled ? (
            <>
              <Field>
                <FieldLabel htmlFor="tradeProcessing">Trade processing</FieldLabel>
                <FieldDescription>
                  Same options as league creation.
                </FieldDescription>
                <Select
                  items={tradeProcessingItems}
                  value={values.tradeProcessing}
                  onValueChange={(value) => {
                    if (
                      value === "commissioner" ||
                      value === "review_24h" ||
                      value === "instant"
                    ) {
                      patch({ tradeProcessing: value });
                    }
                  }}
                >
                  <SelectTrigger id="tradeProcessing" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {tradeProcessingItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="tradeDeadlineWeek">Trade deadline</FieldLabel>
                <FieldDescription>
                  No new trades after this week ends, until the season&apos;s
                  last game week finishes. Trades are allowed during the draft
                  and before the deadline.
                </FieldDescription>
                <Select
                  items={deadlineItems}
                  value={
                    values.tradeDeadlineWeek == null
                      ? NONE_VALUE
                      : String(values.tradeDeadlineWeek)
                  }
                  onValueChange={(value) => {
                    if (!value || value === NONE_VALUE) {
                      patch({ tradeDeadlineWeek: null });
                      return;
                    }
                    patch({ tradeDeadlineWeek: Number(value) });
                  }}
                >
                  <SelectTrigger id="tradeDeadlineWeek" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {deadlineItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <YesNoField
                id="permitTradesAfterSeason"
                label="Permit trades after season ends"
                value={values.permitTradesAfterSeason}
                onChange={(permitTradesAfterSeason) =>
                  patch({ permitTradesAfterSeason })
                }
              />

              <YesNoField
                id="allowVetoes"
                label="Allow vetoes"
                value={values.allowVetoes}
                onChange={(allowVetoes) => patch({ allowVetoes })}
              />
            </>
          ) : null}

          <Field>
            <FieldLabel htmlFor="addDropDeadlineWeek">Add/drop deadline</FieldLabel>
            <FieldDescription>
              No adds, drops, or waiver claims after this week ends.
            </FieldDescription>
            <Select
              items={deadlineItems}
              value={
                values.addDropDeadlineWeek == null
                  ? NONE_VALUE
                  : String(values.addDropDeadlineWeek)
              }
              onValueChange={(value) => {
                if (!value || value === NONE_VALUE) {
                  patch({ addDropDeadlineWeek: null });
                  return;
                }
                patch({ addDropDeadlineWeek: Number(value) });
              }}
            >
              <SelectTrigger id="addDropDeadlineWeek" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {deadlineItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <YesNoField
            id="permitAddDropsAfterSeason"
            label="Permit add/drops after season ends"
            value={values.permitAddDropsAfterSeason}
            onChange={(permitAddDropsAfterSeason) =>
              patch({ permitAddDropsAfterSeason })
            }
          />

          <YesNoField
            id="enforceRosterMinimums"
            label="Enforce roster minimums"
            description="Block cuts, claims, and trades that would leave a team below a position’s configured minimum. IR and Taxi don’t count toward the minimum."
            value={values.enforceRosterMinimums}
            onChange={(enforceRosterMinimums) =>
              patch({ enforceRosterMinimums })
            }
          />

          <YesNoField
            id="preventCutsAfterGameStart"
            label="Prevent cuts after game start"
            description="Players whose NFL game has started cannot be dropped that week."
            value={values.preventCutsAfterGameStart}
            onChange={(preventCutsAfterGameStart) =>
              patch({ preventCutsAfterGameStart })
            }
          />

          <Field>
            <FieldLabel htmlFor="transactionLimits">
              Transaction limits (in-season only)
            </FieldLabel>
            <Select
              items={[...TRANSACTION_LIMIT_ITEMS]}
              value={values.transactionLimits}
              onValueChange={(value) => {
                if (
                  value === "unlimited" ||
                  value === "weekly" ||
                  value === "season" ||
                  value === "both"
                ) {
                  patch({ transactionLimits: value });
                }
              }}
            >
              <SelectTrigger id="transactionLimits" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {TRANSACTION_LIMIT_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          {values.transactionLimits === "weekly" ||
          values.transactionLimits === "both" ? (
            <Field>
              <FieldLabel htmlFor="transactionWeeklyMax">
                Weekly transaction max
              </FieldLabel>
              <NumberInput
                id="transactionWeeklyMax"
                min={1}
                max={99}
                value={values.transactionWeeklyMax}
                onValueChange={(transactionWeeklyMax) =>
                  patch({ transactionWeeklyMax })
                }
              />
              <FieldDescription>
                Counts trades, free-agent adds, and waiver awards per UTC week.
              </FieldDescription>
            </Field>
          ) : null}

          {values.transactionLimits === "season" ||
          values.transactionLimits === "both" ? (
            <Field>
              <FieldLabel htmlFor="transactionSeasonMax">
                Season transaction max
              </FieldLabel>
              <NumberInput
                id="transactionSeasonMax"
                min={1}
                max={999}
                value={values.transactionSeasonMax}
                onValueChange={(transactionSeasonMax) =>
                  patch({ transactionSeasonMax })
                }
              />
            </Field>
          ) : null}
        </FieldGroup>
      </SettingsFormCard>
    </div>
  );
}
