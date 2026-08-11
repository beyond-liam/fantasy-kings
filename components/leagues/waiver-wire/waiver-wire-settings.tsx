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
  FieldError,
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
import { updateWaiverWireRules } from "@/lib/actions/league-settings";
import {
  WAIVER_PROCESS_DAY_OPTIONS,
  type WaiverWireFormValues,
} from "@/lib/leagues/waiver-wire";
import { SwitchField } from "@/components/ui/switch-field";

type WaiverWireSettingsProps = {
  slug: string;
  leagueName: string;
  seasonStatus: string;
  /** Draft finished — preseason waivers switch becomes editable. */
  draftComplete: boolean;
  initialValues: WaiverWireFormValues;
};

const YES_NO_ITEMS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

const WAIVERS_ENABLED_ITEMS = [
  { value: "yes", label: "Yes" },
  {
    value: "no",
    label: "No, all players are acquired on a first-come first-served basis",
  },
] as const;

const WAIVER_TYPE_ITEMS = [
  { value: "priority", label: "Waiver priority" },
  { value: "faab", label: "Blind bid auction" },
] as const;

const RESET_ORDER_ITEMS = [
  {
    value: "yes",
    label: "Yes, reset to reverse standings each week",
  },
  {
    value: "no",
    label: "No, use a rolling order that never resets",
  },
] as const;

const WAIVER_POOL_ITEMS = [
  { value: "drops_only", label: "Dropped players only" },
  {
    value: "drops_and_free_agents",
    label:
      "Dropped players and free agents (NFL game start locks until next week)",
  },
] as const;

const DROP_WAIVER_HOURS_ITEMS = [
  { value: "24", label: "24 hours" },
  { value: "48", label: "48 hours" },
] as const;

const CHURN_PREVENTION_ITEMS = [
  {
    value: "none",
    label: "None, dropped players always go on waivers",
  },
  {
    value: "return_to_fa",
    label:
      "Skip waivers for players acquired since the last process (straight to free agency)",
  },
  {
    value: "block_late_drops",
    label:
      "Prevent drops if there's not enough time for other owners to claim them",
  },
] as const;

const FCFS_MODE_ITEMS = [
  {
    value: "after_process",
    label: "After weekly waiver processing (+2 hours)",
  },
  {
    value: "never",
    label: "Never, always-on waivers are enabled",
  },
] as const;

function valuesEqual(a: WaiverWireFormValues, b: WaiverWireFormValues) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function WaiverWireSettings({
  slug,
  draftComplete,
  initialValues,
}: WaiverWireSettingsProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges = !valuesEqual(values, initialValues);
  const processDayItems = WAIVER_PROCESS_DAY_OPTIONS.map((day) => ({
    value: day.value,
    label: day.label,
  }));

  const patch = (next: Partial<WaiverWireFormValues>) => {
    setValues((current) => ({ ...current, ...next }));
  };

  const handleReset = () => {
    setValues(initialValues);
    setError(null);
    setFieldError(null);
  };

  const handleSave = () => {
    setError(null);
    setFieldError(null);
    startTransition(async () => {
      const result = await updateWaiverWireRules(slug, values);
      if (!result.success) {
        setError(result.error ?? "Could not save waiver rules.");
        if (result.fieldError) {
          setFieldError(result.fieldError);
        }
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
        title="Waiver Wire Rules"
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
            <FieldLabel htmlFor="waiversEnabled">
              Use a waiver claim system
            </FieldLabel>
            <Select
              items={[...WAIVERS_ENABLED_ITEMS]}
              value={values.waiversEnabled ? "yes" : "no"}
              onValueChange={(value) => {
                if (value === "yes" || value === "no") {
                  patch({ waiversEnabled: value === "yes" });
                }
              }}
            >
              <SelectTrigger id="waiversEnabled" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {WAIVERS_ENABLED_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          {values.waiversEnabled ? (
            <>
              <Field>
                <FieldLabel htmlFor="waiverType">How are claims resolved</FieldLabel>
                <Select
                  items={[...WAIVER_TYPE_ITEMS]}
                  value={values.waiverType}
                  onValueChange={(value) => {
                    if (value === "priority" || value === "faab") {
                      patch({ waiverType: value });
                    }
                  }}
                >
                  <SelectTrigger id="waiverType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {WAIVER_TYPE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              {values.waiverType === "faab" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="faabBudget">
                      Initial waiver budget
                    </FieldLabel>
                    <NumberInput
                      id="faabBudget"
                      min={1}
                      max={1000}
                      value={values.faabBudget}
                      onValueChange={(faabBudget) => patch({ faabBudget })}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="allowZeroBids">Allow $0 bids</FieldLabel>
                    <Select
                      items={[...YES_NO_ITEMS]}
                      value={values.allowZeroBids ? "yes" : "no"}
                      onValueChange={(value) => {
                        if (value === "yes" || value === "no") {
                          patch({ allowZeroBids: value === "yes" });
                        }
                      }}
                    >
                      <SelectTrigger id="allowZeroBids" className="w-full">
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
                </>
              ) : (
                <Field>
                  <FieldLabel htmlFor="resetOrderWeekly">
                    Reset order weekly
                  </FieldLabel>
                  <Select
                    items={[...RESET_ORDER_ITEMS]}
                    value={values.resetOrderWeekly ? "yes" : "no"}
                    onValueChange={(value) => {
                      if (value === "yes" || value === "no") {
                        patch({ resetOrderWeekly: value === "yes" });
                      }
                    }}
                  >
                    <SelectTrigger id="resetOrderWeekly" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {RESET_ORDER_ITEMS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor="waiverPool">Who is placed on waivers</FieldLabel>
                <Select
                  items={[...WAIVER_POOL_ITEMS]}
                  value={values.waiverPool}
                  onValueChange={(value) => {
                    if (
                      value === "drops_only" ||
                      value === "drops_and_free_agents"
                    ) {
                      patch({ waiverPool: value });
                    }
                  }}
                >
                  <SelectTrigger id="waiverPool" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {WAIVER_POOL_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="dropWaiverHours">
                  Time on waivers after drop
                </FieldLabel>
                <Select
                  items={[...DROP_WAIVER_HOURS_ITEMS]}
                  value={String(values.dropWaiverHours)}
                  onValueChange={(value) => {
                    if (value === "24" || value === "48") {
                      patch({
                        dropWaiverHours: Number(value) as 24 | 48,
                      });
                    }
                  }}
                >
                  <SelectTrigger id="dropWaiverHours" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {DROP_WAIVER_HOURS_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="churnPrevention">
                  Prevent waiver churning
                </FieldLabel>
                <Select
                  items={[...CHURN_PREVENTION_ITEMS]}
                  value={values.churnPrevention}
                  onValueChange={(value) => {
                    if (
                      value === "return_to_fa" ||
                      value === "block_late_drops" ||
                      value === "none"
                    ) {
                      patch({ churnPrevention: value });
                    }
                  }}
                >
                  <SelectTrigger id="churnPrevention" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CHURN_PREVENTION_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="fcfsMode">First-come first-served</FieldLabel>
                <FieldDescription>
                  When free agents clear waivers and become immediately addable.
                </FieldDescription>
                <Select
                  items={[...FCFS_MODE_ITEMS]}
                  value={values.fcfsMode}
                  onValueChange={(value) => {
                    if (value === "after_process" || value === "never") {
                      patch({ fcfsMode: value });
                    }
                  }}
                >
                  <SelectTrigger id="fcfsMode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {FCFS_MODE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <SwitchField
                id="preseasonWaivers"
                label="Preseason waivers"
                description={
                  draftComplete
                    ? "When on, free agents require waiver claims until your first fantasy week starts (FCFS is paused). When off, free agents are unlocked after the draft."
                    : "Available after the draft is complete."
                }
                checked={values.preseasonWaivers}
                disabled={!draftComplete}
                onCheckedChange={(checked) =>
                  patch({ preseasonWaivers: checked })
                }
              />

              <Field>
                <FieldLabel htmlFor="processDays">Process claims on</FieldLabel>
                <FieldDescription>
                  Claims run at 10:00 UTC. Submit by 09:00 UTC that day — later
                  claims wait until the following week&apos;s process.
                </FieldDescription>
                <Select
                  items={processDayItems}
                  value={values.processDays[0] ?? "wed"}
                  onValueChange={(value) => {
                    if (
                      value === "wed" ||
                      value === "thu" ||
                      value === "fri" ||
                      value === "sat" ||
                      value === "sun" ||
                      value === "mon"
                    ) {
                      patch({ processDays: [value] });
                    }
                  }}
                >
                  <SelectTrigger id="processDays" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {processDayItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldError ? <FieldError>{fieldError}</FieldError> : null}
              </Field>
            </>
          ) : null}
        </FieldGroup>
      </SettingsFormCard>
    </div>
  );
}
