import {
  DEFAULT_IR_ELIGIBLE_STATUSES,
  type IrEligibleStatusId,
} from "@/lib/leagues/ir-eligibility";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";

export const STANDARD_STARTER_SLOTS: Omit<
  RosterSlotConfig,
  "minSlots" | "maxSlots"
>[] = [
  { positionId: "QB", slotCount: 1, isStarter: true },
  { positionId: "RB", slotCount: 2, isStarter: true },
  { positionId: "WR", slotCount: 2, isStarter: true },
  { positionId: "TE", slotCount: 1, isStarter: true },
  { positionId: "FLEX", slotCount: 1, isStarter: true },
  { positionId: "K", slotCount: 1, isStarter: true },
  { positionId: "DEF", slotCount: 1, isStarter: true },
];

/** Roster acquisition caps (starters + bench) for standard format. */
const STANDARD_POSITION_MAX: Record<string, number> = {
  QB: 4,
  RB: 8,
  WR: 8,
  TE: 3,
  FLEX: 1,
  K: 3,
  DEF: 3,
};

export const WIZARD_DEFAULTS = {
  leagueName: "",
  leagueType: "redraft" as const,
  teamCount: 12,
  divisionCount: 1,
  playoffTeamCount: 4 as const,
  championshipWeek: 17 as const,
  rosterMode: "standard" as const,
  benchSlots: 6,
  irEnabled: false,
  irSlots: 1,
  irEligibleStatuses: [...DEFAULT_IR_ELIGIBLE_STATUSES] as IrEligibleStatusId[],
  taxiEnabled: false,
  taxiSlots: 2,
  scoringPreset: "full_ppr" as const,
  waiversEnabled: true,
  waiverType: "priority" as const,
  faabBudget: 100,
  tradesEnabled: true,
  tradeProcessing: "review_24h" as const,
  tradesDeadlineWeek: null as number | null,
  draftType: "live" as const,
  pickTimeLimit: 2,
  pickTimeUnit: "minutes" as const,
};

export function buildStandardRosterSlots(
  benchSlots: number,
  irSlots: number,
  taxiSlots: number,
): RosterSlotConfig[] {
  const starters: RosterSlotConfig[] = STANDARD_STARTER_SLOTS.map((slot) => ({
    ...slot,
    minSlots: slot.slotCount,
    maxSlots: STANDARD_POSITION_MAX[slot.positionId] ?? slot.slotCount,
  }));

  const bench: RosterSlotConfig[] =
    benchSlots > 0
      ? [
          {
            positionId: "BN",
            slotCount: benchSlots,
            minSlots: 0,
            maxSlots: benchSlots,
            isStarter: false,
          },
        ]
      : [];

  const ir: RosterSlotConfig[] =
    irSlots > 0
      ? [
          {
            positionId: "IR",
            slotCount: irSlots,
            minSlots: 0,
            maxSlots: irSlots,
            isStarter: false,
          },
        ]
      : [];

  const taxi: RosterSlotConfig[] =
    taxiSlots > 0
      ? [
          {
            positionId: "TAXI",
            slotCount: taxiSlots,
            minSlots: 0,
            maxSlots: taxiSlots,
            isStarter: false,
          },
        ]
      : [];

  return [...starters, ...bench, ...ir, ...taxi];
}

export function getDefaultDraftStartAt(): Date {
  const date = new Date();
  const day = date.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilSaturday);
  date.setHours(19, 0, 0, 0);
  return date;
}

export function pickTimeToSeconds(
  value: number,
  unit: "minutes" | "hours",
): number {
  return unit === "hours" ? value * 3600 : value * 60;
}

export function secondsToPickTime(seconds: number): {
  value: number;
  unit: "minutes" | "hours";
} {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    return { value: seconds / 3600, unit: "hours" };
  }
  return { value: Math.round(seconds / 60), unit: "minutes" };
}
