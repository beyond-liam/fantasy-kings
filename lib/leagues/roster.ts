import { z } from "zod";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import {
  STANDARD_STARTER_SLOTS,
  buildStandardRosterSlots,
} from "@/lib/leagues/defaults";
import {
  IDP_POSITION_IDS,
  IDP_STARTER_SLOT_COUNTS,
} from "@/lib/leagues/idp-positions";
import {
  DEFAULT_IR_ELIGIBLE_STATUSES,
  IR_ELIGIBILITY_OPTIONS,
  type IrEligibleStatusId,
} from "@/lib/leagues/ir-eligibility";
import {
  DEFAULT_TAXI_MAX_YEARS_EXP,
  DEFAULT_TAXI_PREVENT_READD_AFTER_ACTIVATION,
  TAXI_MAX_YEARS_OPTIONS,
  type TaxiMaxYearsExp,
} from "@/lib/leagues/taxi-eligibility";

export type RosterMode = "standard" | "custom";

/** UI-only mode; `idp` persists as `custom` with IDP starter slots. */
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
  taxiMaxYearsExp: TaxiMaxYearsExp;
  taxiPreventReaddAfterActivation: boolean;
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

const taxiMaxYearsExpSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const rosterRequirementsSchema = z
  .object({
    rosterMode: z.enum(["standard", "custom"]),
    benchSlots: z.number().int().min(0).max(15),
    irEnabled: z.boolean(),
    irSlots: z.number().int().min(0).max(5),
    irEligibleStatuses: z.array(irEligibleStatusSchema),
    taxiEnabled: z.boolean(),
    taxiSlots: z.number().int().min(0).max(5),
    taxiMaxYearsExp: taxiMaxYearsExpSchema,
    taxiPreventReaddAfterActivation: z.boolean(),
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
      !data.taxiEnabled ||
      TAXI_MAX_YEARS_OPTIONS.some(
        (option) => option.value === data.taxiMaxYearsExp,
      ),
    {
      message: "Choose taxi eligibility",
      path: ["taxiMaxYearsExp"],
    },
  )
  .refine(
    (data) =>
      data.rosterMode === "standard" || data.customRosterSlots.length > 0,
    {
      message: "Add at least one roster position",
      path: ["customRosterSlots"],
    },
  );

export { DEFAULT_IR_ELIGIBLE_STATUSES, DEFAULT_TAXI_MAX_YEARS_EXP, DEFAULT_TAXI_PREVENT_READD_AFTER_ACTIVATION };

export const ROSTER_PRESET_OPTIONS: Array<{
  value: RosterUiMode;
  label: string;
  disabled?: boolean;
}> = [
  { value: "standard", label: "Standard offense" },
  { value: "idp", label: "Offense + IDP" },
  { value: "custom", label: "Custom" },
];

export const ROSTER_POSITION_OPTIONS = [
  { id: "QB", name: "QB" },
  { id: "RB", name: "RB" },
  { id: "WR", name: "WR" },
  { id: "TE", name: "TE" },
  { id: "FLEX", name: "FLEX" },
  { id: "K", name: "K" },
  { id: "DEF", name: "DEF" },
  { id: "CB", name: "CB" },
  { id: "S", name: "S" },
  { id: "DT", name: "DT" },
  { id: "DE", name: "DE" },
  { id: "LB", name: "LB" },
] as const;

export function formatStandardStarterSummary(): string {
  return STANDARD_STARTER_SLOTS.map(
    (slot) => `${slot.positionId}×${slot.slotCount}`,
  ).join(", ");
}

export function formatIdpStarterSummary(): string {
  const idp = IDP_POSITION_IDS.map(
    (positionId) => `${positionId}×${IDP_STARTER_SLOT_COUNTS[positionId]}`,
  ).join(", ");
  return `${formatStandardStarterSummary()}, ${idp}`;
}

export function getDefaultCustomRosterSlots(): RosterSlotInput[] {
  return STANDARD_STARTER_SLOTS.map((slot) => ({
    ...slot,
    minSlots: slot.slotCount,
    maxSlots: slot.slotCount,
  }));
}

/** Standard starters (incl. team DEF) plus 2 CB, 2 S, 1 DT, 2 DE, 2 LB. */
export function getDefaultIdpCustomRosterSlots(): RosterSlotInput[] {
  return [
    ...getDefaultCustomRosterSlots(),
    ...IDP_POSITION_IDS.map((positionId) => {
      const slotCount = IDP_STARTER_SLOT_COUNTS[positionId];
      return {
        positionId,
        slotCount,
        minSlots: slotCount,
        maxSlots: slotCount,
        isStarter: true,
      };
    }),
  ];
}

/** Exact match for the Individual defense preset starter set. */
export function isIdpRosterPreset(slots: RosterSlotInput[]): boolean {
  const starterCounts = new Map<string, number>();
  for (const slot of slots) {
    if (!slot.isStarter) continue;
    starterCounts.set(
      slot.positionId,
      (starterCounts.get(slot.positionId) ?? 0) + slot.slotCount,
    );
  }

  for (const slot of STANDARD_STARTER_SLOTS) {
    if ((starterCounts.get(slot.positionId) ?? 0) !== slot.slotCount) {
      return false;
    }
  }

  for (const positionId of IDP_POSITION_IDS) {
    if (
      (starterCounts.get(positionId) ?? 0) !==
      IDP_STARTER_SLOT_COUNTS[positionId]
    ) {
      return false;
    }
  }

  const allowed = new Set<string>([
    ...STANDARD_STARTER_SLOTS.map((slot) => slot.positionId),
    ...IDP_POSITION_IDS,
  ]);
  if (starterCounts.size !== allowed.size) return false;
  for (const positionId of starterCounts.keys()) {
    if (!allowed.has(positionId)) return false;
  }
  return true;
}

export function detectRosterUiMode(
  values: Pick<RosterRequirementsValues, "rosterMode" | "customRosterSlots">,
): RosterUiMode {
  if (values.rosterMode === "standard") return "standard";
  if (isIdpRosterPreset(values.customRosterSlots)) return "idp";
  return "custom";
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
