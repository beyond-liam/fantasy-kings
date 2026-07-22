"use client";

import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageFormActions } from "@/components/layout/page-form-actions";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateTransactionRules } from "@/lib/actions/league-settings";
import { formatLeagueLabel } from "@/lib/leagues/format";
import {
  TRADE_PROCESSING_OPTIONS,
  buildWeekDeadlineOptions,
  type TransactionRulesFormValues,
} from "@/lib/leagues/transaction-rules";
import { cn } from "@/lib/utils";

type TransactionRulesSettingsProps = {
  slug: string;
  leagueName: string;
  seasonStatus: string;
  maxWeek: number;
  initialValues: TransactionRulesFormValues;
};

const NONE_VALUE = "none";

function valuesEqual(
  a: TransactionRulesFormValues,
  b: TransactionRulesFormValues,
) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function OptionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-data-checked:border-primary",
        className,
      )}
    >
      {children}
    </Label>
  );
}

function YesNoField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <RadioGroup
        value={value ? "yes" : "no"}
        onValueChange={(next) => onChange(next === "yes")}
        className="mt-3 grid gap-3 sm:grid-cols-2"
      >
        <OptionLabel>
          <RadioGroupItem value="yes" className="mt-0.5" />
          <span className="text-sm font-medium">Yes</span>
        </OptionLabel>
        <OptionLabel>
          <RadioGroupItem value="no" className="mt-0.5" />
          <span className="text-sm font-medium">No</span>
        </OptionLabel>
      </RadioGroup>
    </Field>
  );
}

export function TransactionRulesSettings({
  slug,
  leagueName,
  seasonStatus,
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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Transaction rules
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {leagueName}
          {" · "}
          <span className="capitalize">{formatLeagueLabel(seasonStatus)}</span>
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
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
            onCheckedChange={(checked) => patch({ tradesEnabled: checked })}
          />
        </Field>

        {values.tradesEnabled ? (
          <>
            <Field>
              <FieldLabel>Trade processing</FieldLabel>
              <FieldDescription>
                Same options as league creation.
              </FieldDescription>
              <RadioGroup
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
                className="mt-3 grid gap-3"
              >
                {TRADE_PROCESSING_OPTIONS.map((option) => (
                  <OptionLabel key={option.value}>
                    <RadioGroupItem value={option.value} className="mt-0.5" />
                    <span className="text-sm font-medium">{option.label}</span>
                  </OptionLabel>
                ))}
              </RadioGroup>
            </Field>

            <Field>
              <FieldLabel htmlFor="tradeDeadlineWeek">Trade deadline</FieldLabel>
              <FieldDescription>
                No trades can be proposed after this week ends.
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
                <SelectTrigger id="tradeDeadlineWeek" className="mt-3 max-w-sm">
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
              label="Permit trades after season ends"
              value={values.permitTradesAfterSeason}
              onChange={(permitTradesAfterSeason) =>
                patch({ permitTradesAfterSeason })
              }
            />

            <YesNoField
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
            <SelectTrigger id="addDropDeadlineWeek" className="mt-3 max-w-sm">
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
          label="Permit add/drops after season ends"
          value={values.permitAddDropsAfterSeason}
          onChange={(permitAddDropsAfterSeason) =>
            patch({ permitAddDropsAfterSeason })
          }
        />

        <YesNoField
          label="Enforce roster minimums"
          description="Block drops that would leave a team under the roster minimum."
          value={values.enforceRosterMinimums}
          onChange={(enforceRosterMinimums) =>
            patch({ enforceRosterMinimums })
          }
        />

        <Field>
          <FieldLabel>Free agents during preseason (after draft)</FieldLabel>
          <RadioGroup
            value={values.preseasonFreeAgents}
            onValueChange={(value) => {
              if (value === "always_on_waivers" || value === "unlocked") {
                patch({ preseasonFreeAgents: value });
              }
            }}
            className="mt-3 grid gap-3"
          >
            <OptionLabel>
              <RadioGroupItem value="always_on_waivers" className="mt-0.5" />
              <span className="text-sm font-medium">Always-on waivers</span>
            </OptionLabel>
            <OptionLabel>
              <RadioGroupItem value="unlocked" className="mt-0.5" />
              <span className="text-sm font-medium">Unlocked</span>
            </OptionLabel>
          </RadioGroup>
        </Field>

        <YesNoField
          label="Prevent cuts after game start"
          description="Players whose NFL game has started cannot be dropped that week."
          value={values.preventCutsAfterGameStart}
          onChange={(preventCutsAfterGameStart) =>
            patch({ preventCutsAfterGameStart })
          }
        />

        <Field>
          <FieldLabel>Transaction limits (in-season only)</FieldLabel>
          <RadioGroup
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
            className="mt-3 grid gap-3"
          >
            <OptionLabel>
              <RadioGroupItem value="unlimited" className="mt-0.5" />
              <span className="text-sm font-medium">Unlimited</span>
            </OptionLabel>
            <OptionLabel>
              <RadioGroupItem value="weekly" className="mt-0.5" />
              <span className="text-sm font-medium">Weekly limit only</span>
            </OptionLabel>
            <OptionLabel>
              <RadioGroupItem value="season" className="mt-0.5" />
              <span className="text-sm font-medium">Season limit only</span>
            </OptionLabel>
            <OptionLabel>
              <RadioGroupItem value="both" className="mt-0.5" />
              <span className="text-sm font-medium">
                Both weekly and season limits
              </span>
            </OptionLabel>
          </RadioGroup>
        </Field>
      </FieldGroup>

      <PageFormActions>
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
    </div>
  );
}
