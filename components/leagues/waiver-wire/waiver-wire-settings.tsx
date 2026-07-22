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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { updateWaiverWireRules } from "@/lib/actions/league-settings";
import { formatLeagueLabel } from "@/lib/leagues/format";
import {
  WAIVER_PROCESS_DAY_OPTIONS,
  type WaiverWireFormValues,
} from "@/lib/leagues/waiver-wire";
import { cn } from "@/lib/utils";

type WaiverWireSettingsProps = {
  slug: string;
  leagueName: string;
  seasonStatus: string;
  initialValues: WaiverWireFormValues;
};

function valuesEqual(a: WaiverWireFormValues, b: WaiverWireFormValues) {
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

export function WaiverWireSettings({
  slug,
  leagueName,
  seasonStatus,
  initialValues,
}: WaiverWireSettingsProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges = !valuesEqual(values, initialValues);

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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Waiver wire rules
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
        <Field>
          <FieldLabel>Use a waiver claim system</FieldLabel>
          <RadioGroup
            value={values.waiversEnabled ? "yes" : "no"}
            onValueChange={(value) =>
              patch({ waiversEnabled: value === "yes" })
            }
            className="mt-3 grid gap-3"
          >
            <OptionLabel>
              <RadioGroupItem value="yes" className="mt-0.5" />
              <span className="text-sm font-medium">Yes</span>
            </OptionLabel>
            <OptionLabel>
              <RadioGroupItem value="no" className="mt-0.5" />
              <span className="text-sm font-medium">
                No, all players are acquired on a first-come first-served basis
              </span>
            </OptionLabel>
          </RadioGroup>
        </Field>

        {values.waiversEnabled ? (
          <>
            <Field>
              <FieldLabel>How are claims resolved</FieldLabel>
              <RadioGroup
                value={values.waiverType}
                onValueChange={(value) => {
                  if (value === "priority" || value === "faab") {
                    patch({ waiverType: value });
                  }
                }}
                className="mt-3 grid gap-3"
              >
                <OptionLabel>
                  <RadioGroupItem value="priority" className="mt-0.5" />
                  <span className="text-sm font-medium">Waiver priority</span>
                </OptionLabel>
                <OptionLabel>
                  <RadioGroupItem value="faab" className="mt-0.5" />
                  <span className="text-sm font-medium">Blind bid auction</span>
                </OptionLabel>
              </RadioGroup>
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
                    className="max-w-40"
                  />
                </Field>

                <Field>
                  <FieldLabel>Allow $0 bids</FieldLabel>
                  <RadioGroup
                    value={values.allowZeroBids ? "yes" : "no"}
                    onValueChange={(value) =>
                      patch({ allowZeroBids: value === "yes" })
                    }
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
              </>
            ) : (
              <Field>
                <FieldLabel>Reset order weekly</FieldLabel>
                <RadioGroup
                  value={values.resetOrderWeekly ? "yes" : "no"}
                  onValueChange={(value) =>
                    patch({ resetOrderWeekly: value === "yes" })
                  }
                  className="mt-3 grid gap-3"
                >
                  <OptionLabel>
                    <RadioGroupItem value="yes" className="mt-0.5" />
                    <span className="text-sm font-medium">
                      Yes, reset to reverse standings each week
                    </span>
                  </OptionLabel>
                  <OptionLabel>
                    <RadioGroupItem value="no" className="mt-0.5" />
                    <span className="text-sm font-medium">
                      No, use a rolling order that never resets
                    </span>
                  </OptionLabel>
                </RadioGroup>
              </Field>
            )}

            <Field>
              <FieldLabel>Who is placed on waivers</FieldLabel>
              <RadioGroup
                value={values.waiverPool}
                onValueChange={(value) => {
                  if (
                    value === "drops_only" ||
                    value === "drops_and_free_agents"
                  ) {
                    patch({ waiverPool: value });
                  }
                }}
                className="mt-3 grid gap-3"
              >
                <OptionLabel>
                  <RadioGroupItem value="drops_only" className="mt-0.5" />
                  <span className="text-sm font-medium">
                    Dropped players only
                  </span>
                </OptionLabel>
                <OptionLabel>
                  <RadioGroupItem
                    value="drops_and_free_agents"
                    className="mt-0.5"
                  />
                  <span className="text-sm font-medium">
                    Dropped players and all free agents after game start
                  </span>
                </OptionLabel>
              </RadioGroup>
            </Field>

            <Field>
              <FieldLabel>Time on waivers after drop</FieldLabel>
              <RadioGroup
                value={String(values.dropWaiverHours)}
                onValueChange={(value) => {
                  if (value === "24" || value === "48") {
                    patch({
                      dropWaiverHours: Number(value) as 24 | 48,
                    });
                  }
                }}
                className="mt-3 grid gap-3 sm:grid-cols-2"
              >
                <OptionLabel>
                  <RadioGroupItem value="24" className="mt-0.5" />
                  <span className="text-sm font-medium">24 hours</span>
                </OptionLabel>
                <OptionLabel>
                  <RadioGroupItem value="48" className="mt-0.5" />
                  <span className="text-sm font-medium">48 hours</span>
                </OptionLabel>
              </RadioGroup>
            </Field>

            <Field>
              <FieldLabel>Prevent waiver churning</FieldLabel>
              <RadioGroup
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
                className="mt-3 grid gap-3"
              >
                <OptionLabel>
                  <RadioGroupItem value="return_to_fa" className="mt-0.5" />
                  <span className="text-sm font-medium">
                    Return recently added players to free agency
                  </span>
                </OptionLabel>
                <OptionLabel>
                  <RadioGroupItem value="block_late_drops" className="mt-0.5" />
                  <span className="text-sm font-medium">
                    Prevent drops if there&apos;s not enough time for other
                    owners to claim them
                  </span>
                </OptionLabel>
                <OptionLabel>
                  <RadioGroupItem value="none" className="mt-0.5" />
                  <span className="text-sm font-medium">
                    None, cycled players are subject to waivers like all others
                  </span>
                </OptionLabel>
              </RadioGroup>
            </Field>

            <Field>
              <FieldLabel>First-come first-served</FieldLabel>
              <FieldDescription>
                When free agents clear waivers and become immediately addable.
              </FieldDescription>
              <RadioGroup
                value={values.fcfsMode}
                onValueChange={(value) => {
                  if (value === "after_process" || value === "never") {
                    patch({ fcfsMode: value });
                  }
                }}
                className="mt-3 grid gap-3"
              >
                <OptionLabel>
                  <RadioGroupItem value="after_process" className="mt-0.5" />
                  <span className="text-sm font-medium">
                    After weekly waiver processing (+2 hours)
                  </span>
                </OptionLabel>
                <OptionLabel>
                  <RadioGroupItem value="never" className="mt-0.5" />
                  <span className="text-sm font-medium">
                    Never, always-on waivers are enabled
                  </span>
                </OptionLabel>
              </RadioGroup>
            </Field>

            <Field>
              <FieldLabel>Process claims on</FieldLabel>
              <FieldDescription>
                Claims run at 10:00 UTC. Submit by 09:00 UTC that day — later
                claims wait until the following week&apos;s process.
              </FieldDescription>
              <RadioGroup
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
                className="mt-3 grid gap-3 sm:grid-cols-2"
              >
                {WAIVER_PROCESS_DAY_OPTIONS.map((day) => (
                  <OptionLabel key={day.value}>
                    <RadioGroupItem value={day.value} className="mt-0.5" />
                    <span className="text-sm font-medium">{day.label}</span>
                  </OptionLabel>
                ))}
              </RadioGroup>
              {fieldError ? <FieldError>{fieldError}</FieldError> : null}
            </Field>
          </>
        ) : null}
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
