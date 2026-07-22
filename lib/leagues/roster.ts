import { z } from "zod";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import {
  STANDARD_STARTER_SLOTS,
  buildStandardRosterSlots,
} from "@/lib/leagues/defaults";
import {
  DEFAULT_IR_ELIGIBLE_STATUSES,
  IR_ELIGIBILITY_OPTIONS,
  type IrEligibleStatusId,
} from "@/lib/leagues/ir-eligibility";

export type RosterMode = "standard" | "custom";

/** UI-only mode; `idp` is not persisted. */
export type RosterUiMode = "standard" | "idp" | "custom";

export type RosterSlotInput = {
  positionId: string;
  slotCount: number;
  minSlots: number;
  maxSlots: number;
  isStarter: boolean;
};

export type RosterRequirementsValues = {
  rosterMode: RosterMode;
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  irEligibleStatuses: IrEligibleStatusId[];
  taxiEnabled: boolean;
  taxiSlots: number;
  customRosterSlots: RosterSlotInput[];
};

const rosterSlotSchema = z.object({
  positionId: z.string().min(1),
  slotCount: z.number().int().min(0).max(20),
  minSlots: z.number().int().min(0).max(20),
  maxSlots: z.number().int().min(0).max(20),
  isStarter: z.boolean(),
});

const irEligibleStatusSchema = z.enum(
  IR_ELIGIBILITY_OPTIONS.map((option) => option.id) as [
    IrEligibleStatusId,
    ...IrEligibleStatusId[],
  ],
);

export const rosterRequirementsSchema = z
  .object({
    rosterMode: z.enum(["standard", "custom"]),
    benchSlots: z.number().int().min(0).max(15),
    irEnabled: z.boolean(),
    irSlots: z.number().int().min(0).max(5),
    irEligibleStatuses: z.array(irEligibleStatusSchema),
    taxiEnabled: z.boolean(),
    taxiSlots: z.number().int().min(0).max(5),
    customRosterSlots: z.array(rosterSlotSchema),
  })
  .refine((data) => !data.irEnabled || data.irSlots >= 1, {
    message: "Add at least one IR spot",
    path: ["irSlots"],
  })
  .refine(
    (data) => !data.irEnabled || data.irEligibleStatuses.length > 0,
    {
      message: "Select at least one IR-eligible designation",
      path: ["irEligibleStatuses"],
    },
  )
  .refine((data) => !data.taxiEnabled || data.taxiSlots >= 1, {
    message: "Add at least one taxi spot",
    path: ["taxiSlots"],
  })
  .refine(
    (data) =>
      data.rosterMode === "standard" || data.customRosterSlots.length > 0,
    {
      message: "Add at least one roster position",
      path: ["customRosterSlots"],
    },
  );

export { DEFAULT_IR_ELIGIBLE_STATUSES };

export const ROSTER_PRESET_OPTIONS: Array<{
  value: RosterUiMode;
  label: string;
  description: string;
  disabled?: boolean;
}> = [
  {
    value: "standard",
    label: "Standard",
    description: "QB, RB×2, WR×2, TE, FLEX, K, DEF + bench.",
  },
  {
    value: "idp",
    label: "Individual defense",
    description: "Granular IDP slots (EDGE, DT, LB, CB, S).",
    disabled: true,
  },
  {
    value: "custom",
    label: "Custom",
    description: "Build your own position limits.",
  },
];

export const ROSTER_POSITION_OPTIONS = [
  { id: "QB", name: "QB" },
  { id: "RB", name: "RB" },
  { id: "WR", name: "WR" },
  { id: "TE", name: "TE" },
  { id: "FLEX", name: "FLEX" },
  { id: "K", name: "K" },
  { id: "DEF", name: "DEF" },
] as const;

export function formatStandardStarterSummary(): string {
  return STANDARD_STARTER_SLOTS.map(
    (slot) => `${slot.positionId}×${slot.slotCount}`,
  ).join(", ");
}

export function getDefaultCustomRosterSlots(): RosterSlotInput[] {
  return STANDARD_STARTER_SLOTS.map((slot) => ({
    ...slot,
    minSlots: slot.slotCount,
    maxSlots: slot.slotCount,
  }));
}

export function starterSlotsFromSettings(
  rosterSlots: RosterSlotConfig[],
): RosterSlotInput[] {
  const starters = rosterSlots.filter((slot) => slot.isStarter);
  return starters.length > 0 ? starters : getDefaultCustomRosterSlots();
}

export function buildPersistedRosterSlots(
  values: RosterRequirementsValues,
): RosterSlotConfig[] {
  if (values.rosterMode === "standard") {
    return buildStandardRosterSlots(
      values.benchSlots,
      values.irEnabled ? values.irSlots : 0,
      values.taxiEnabled ? values.taxiSlots : 0,
    );
  }

  const starters: RosterSlotConfig[] = values.customRosterSlots.map((slot) => {
    const isFlex = slot.positionId === "FLEX";
    return {
      ...slot,
      minSlots: isFlex ? slot.slotCount : slot.minSlots,
      maxSlots: isFlex ? slot.slotCount : slot.maxSlots,
      isStarter: true,
    };
  });

  const bench: RosterSlotConfig[] =
    values.benchSlots > 0
      ? [
          {
            positionId: "BN",
            slotCount: values.benchSlots,
            minSlots: 0,
            maxSlots: values.benchSlots,
            isStarter: false,
          },
        ]
      : [];

  const ir: RosterSlotConfig[] =
    values.irEnabled && values.irSlots > 0
      ? [
          {
            positionId: "IR",
            slotCount: values.irSlots,
            minSlots: 0,
            maxSlots: values.irSlots,
            isStarter: false,
          },
        ]
      : [];

  const taxi: RosterSlotConfig[] =
    values.taxiEnabled && values.taxiSlots > 0
      ? [
          {
            positionId: "TAXI",
            slotCount: values.taxiSlots,
            minSlots: 0,
            maxSlots: values.taxiSlots,
            isStarter: false,
          },
        ]
      : [];

  return [...starters, ...bench, ...ir, ...taxi];
}

export function isFlexPosition(positionId: string) {
  return positionId === "FLEX";
}

export function toRosterUiMode(rosterMode: RosterMode): RosterUiMode {
  return rosterMode;
}
