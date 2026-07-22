"use client";

import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
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
import { TableShell } from "@/components/ui/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { IR_ELIGIBILITY_OPTIONS } from "@/lib/leagues/ir-eligibility";
import {
  ROSTER_POSITION_OPTIONS,
  formatStandardStarterSummary,
  isFlexPosition,
  type RosterRequirementsValues,
  type RosterSlotInput,
} from "@/lib/leagues/roster";

const POSITION_ITEMS = ROSTER_POSITION_OPTIONS.map((position) => ({
  value: position.id,
  label: position.name,
}));

const CUSTOM_ROSTER_GRID =
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2";

type RosterBreakdownProps = {
  values: RosterRequirementsValues;
  errors?: Partial<Record<keyof RosterRequirementsValues, string>>;
  onChange: (values: Partial<RosterRequirementsValues>) => void;
  /** When false, hide IR / taxi controls (e.g. mock drafts). Default true. */
  showReserveSlots?: boolean;
};

export function RosterBreakdown({
  values,
  errors = {},
  onChange,
  showReserveSlots = true,
}: RosterBreakdownProps) {
  const updateCustomSlot = (
    index: number,
    patch: Partial<RosterSlotInput>,
  ) => {
    const next = values.customRosterSlots.map((slot, i) =>
      i === index ? { ...slot, ...patch } : slot,
    );
    onChange({ customRosterSlots: next });
  };

  return (
    <FieldGroup>
      {values.rosterMode === "standard" ? (
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          Starters: {formatStandardStarterSummary()}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <TableShell>
            <div className="min-w-[32rem] divide-y">
              <div className={`${CUSTOM_ROSTER_GRID} px-3 py-2`}>
                <span className="text-xs font-medium text-muted-foreground">
                  Position
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  Slots
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  Min
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  Max
                </span>
                <span className="sr-only">Remove</span>
              </div>
              {values.customRosterSlots.map((slot, index) => {
                const flexLimits = isFlexPosition(slot.positionId);

                return (
                <div
                  key={`${slot.positionId}-${index}`}
                  className={`${CUSTOM_ROSTER_GRID} px-3 py-3`}
                >
                  <Select
                    items={POSITION_ITEMS}
                    value={slot.positionId}
                    onValueChange={(value) => {
                      if (!value) return;
                      if (isFlexPosition(value)) {
                        updateCustomSlot(index, {
                          positionId: value,
                          minSlots: slot.slotCount,
                          maxSlots: slot.slotCount,
                        });
                        return;
                      }
                      updateCustomSlot(index, { positionId: value });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {POSITION_ITEMS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <NumberInput
                    min={0}
                    value={slot.slotCount}
                    onValueChange={(slotCount) =>
                      updateCustomSlot(
                        index,
                        flexLimits
                          ? {
                              slotCount,
                              minSlots: slotCount,
                              maxSlots: slotCount,
                            }
                          : { slotCount },
                      )
                    }
                    aria-label="Slots"
                  />
                  {flexLimits ? (
                    <>
                      <div
                        className="flex h-9 items-center px-2.5 text-sm text-muted-foreground"
                        aria-label="Minimum slots not used for FLEX"
                      >
                        —
                      </div>
                      <div
                        className="flex h-9 items-center px-2.5 text-sm text-muted-foreground"
                        aria-label="Maximum slots not used for FLEX"
                      >
                        —
                      </div>
                    </>
                  ) : (
                    <>
                      <NumberInput
                        min={0}
                        value={slot.minSlots}
                        onValueChange={(minSlots) =>
                          updateCustomSlot(index, { minSlots })
                        }
                        aria-label="Minimum slots"
                      />
                      <NumberInput
                        min={0}
                        value={slot.maxSlots}
                        onValueChange={(maxSlots) =>
                          updateCustomSlot(index, { maxSlots })
                        }
                        aria-label="Maximum slots"
                      />
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost-destructive"
                    size="icon-sm"
                    aria-label="Remove position"
                    onClick={() =>
                      onChange({
                        customRosterSlots: values.customRosterSlots.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                  </Button>
                </div>
                );
              })}
            </div>
          </TableShell>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange({
                customRosterSlots: [
                  ...values.customRosterSlots,
                  {
                    positionId: "RB",
                    slotCount: 1,
                    minSlots: 0,
                    maxSlots: 1,
                    isStarter: true,
                  },
                ],
              })
            }
          >
            <HugeiconsIcon
              icon={Add01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Add Position
          </Button>
          {errors.customRosterSlots ? (
            <FieldError>{errors.customRosterSlots}</FieldError>
          ) : null}
        </div>
      )}

      <Field>
        <FieldLabel htmlFor="benchSlots">Bench spots</FieldLabel>
        <NumberInput
          id="benchSlots"
          min={0}
          max={15}
          value={values.benchSlots}
          onValueChange={(benchSlots) => onChange({ benchSlots })}
        />
      </Field>

      {showReserveSlots ? (
        <>
          <Field orientation="horizontal">
            <div className="flex flex-1 flex-col gap-1">
              <FieldLabel htmlFor="irEnabled">Injured Reserve</FieldLabel>
              <p className="text-sm text-muted-foreground">
                Enable IR roster spots.
              </p>
            </div>
            <Switch
              id="irEnabled"
              checked={values.irEnabled}
              onCheckedChange={(checked) =>
                onChange({
                  irEnabled: checked,
                  ...(checked && values.irEligibleStatuses.length === 0
                    ? {
                        irEligibleStatuses: IR_ELIGIBILITY_OPTIONS.map(
                          (option) => option.id,
                        ),
                      }
                    : {}),
                })
              }
            />
          </Field>
          {values.irEnabled ? (
            <>
              <Field>
                <FieldLabel htmlFor="irSlots">IR Spots</FieldLabel>
                <NumberInput
                  id="irSlots"
                  min={1}
                  max={5}
                  value={values.irSlots}
                  onValueChange={(irSlots) => onChange({ irSlots })}
                />
                {errors.irSlots ? (
                  <FieldError>{errors.irSlots}</FieldError>
                ) : null}
              </Field>
              <Field>
                <FieldLabel>IR-Eligible Designations</FieldLabel>
                <FieldDescription>
                  Players must carry one of these Sleeper injury statuses to use
                  an IR spot.
                </FieldDescription>
                <ToggleGroup
                  value={values.irEligibleStatuses}
                  onValueChange={(statuses) =>
                    onChange({
                      irEligibleStatuses:
                        statuses as RosterRequirementsValues["irEligibleStatuses"],
                    })
                  }
                  variant="outline"
                  spacing={2}
                  multiple
                  className="flex flex-wrap"
                >
                  {IR_ELIGIBILITY_OPTIONS.map((option) => (
                    <ToggleGroupItem
                      key={option.id}
                      value={option.id}
                      aria-label={option.label}
                    >
                      {option.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {errors.irEligibleStatuses ? (
                  <FieldError>{errors.irEligibleStatuses}</FieldError>
                ) : null}
              </Field>
            </>
          ) : null}

          <Field orientation="horizontal">
            <div className="flex flex-1 flex-col gap-1">
              <FieldLabel htmlFor="taxiEnabled">Taxi Squad</FieldLabel>
              <p className="text-sm text-muted-foreground">
                Reserve spots for development players.
              </p>
            </div>
            <Switch
              id="taxiEnabled"
              checked={values.taxiEnabled}
              onCheckedChange={(checked) =>
                onChange({ taxiEnabled: checked })
              }
            />
          </Field>
          {values.taxiEnabled ? (
            <Field>
              <FieldLabel htmlFor="taxiSlots">Taxi spots</FieldLabel>
              <NumberInput
                id="taxiSlots"
                min={1}
                max={5}
                value={values.taxiSlots}
                onValueChange={(taxiSlots) => onChange({ taxiSlots })}
              />
              {errors.taxiSlots ? (
                <FieldError>{errors.taxiSlots}</FieldError>
              ) : null}
            </Field>
          ) : null}
        </>
      ) : null}
    </FieldGroup>
  );
}
