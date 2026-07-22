import type { RosterSlotConfig } from "@/db/schema/league-seasons";

export type RosterTableSectionId = "lineup" | "bench" | "ir" | "taxi";

export type EmptyRosterSlot = {
  key: string;
  slotPositionId: string;
};

export type EmptyRosterSections = {
  lineup: EmptyRosterSlot[];
  bench: EmptyRosterSlot[];
  ir: EmptyRosterSlot[] | null;
  taxi: EmptyRosterSlot[] | null;
};

export type RosterAssignmentOption = {
  value: string;
  label: string;
};

function expandSlots(
  positionId: string,
  count: number,
  prefix: string,
): EmptyRosterSlot[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    key: `${prefix}-${positionId}-${index}`,
    slotPositionId: positionId,
  }));
}

function slotCountFor(
  rosterSlots: RosterSlotConfig[],
  positionId: string,
): number {
  return rosterSlots
    .filter((slot) => slot.positionId === positionId)
    .reduce((sum, slot) => sum + slot.slotCount, 0);
}

export function buildEmptyRosterSections(input: {
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  taxiEnabled: boolean;
  taxiSlots: number;
}): EmptyRosterSections {
  const { rosterSlots } = input;

  const lineup = rosterSlots
    .filter((slot) => slot.isStarter)
    .flatMap((slot) =>
      expandSlots(slot.positionId, slot.slotCount, "lineup"),
    );

  const benchCount =
    slotCountFor(rosterSlots, "BN") || Math.max(0, input.benchSlots);
  const bench = expandSlots("BN", benchCount, "bench");

  const irCount = input.irEnabled
    ? slotCountFor(rosterSlots, "IR") || Math.max(0, input.irSlots)
    : 0;
  const ir = input.irEnabled ? expandSlots("IR", irCount, "ir") : null;

  const taxiCount = input.taxiEnabled
    ? slotCountFor(rosterSlots, "TAXI") || Math.max(0, input.taxiSlots)
    : 0;
  const taxi = input.taxiEnabled
    ? expandSlots("TAXI", taxiCount, "taxi")
    : null;

  return { lineup, bench, ir, taxi };
}

export function buildRosterAssignmentOptions(input: {
  rosterSlots: RosterSlotConfig[];
  irEnabled: boolean;
  taxiEnabled: boolean;
}): RosterAssignmentOption[] {
  const starterOptions: RosterAssignmentOption[] = [];
  const seen = new Set<string>();

  for (const slot of input.rosterSlots) {
    if (!slot.isStarter || seen.has(slot.positionId)) continue;
    seen.add(slot.positionId);
    starterOptions.push({
      value: slot.positionId,
      label: slot.positionId,
    });
  }

  const options = [
    ...starterOptions,
    { value: "BN", label: "Bench" },
  ];

  if (input.irEnabled) {
    options.push({ value: "IR", label: "IR" });
  }

  if (input.taxiEnabled) {
    options.push({ value: "TAXI", label: "Taxi" });
  }

  return options;
}

export function rosterSectionTitle(section: RosterTableSectionId): string {
  switch (section) {
    case "lineup":
      return "Lineup";
    case "bench":
      return "Bench";
    case "ir":
      return "Injured reserve";
    case "taxi":
      return "Taxi squad";
  }
}

export function defaultSlotLabel(slotPositionId: string): string {
  if (slotPositionId === "BN") return "Bench";
  if (slotPositionId === "IR") return "IR";
  if (slotPositionId === "TAXI") return "Taxi";
  return slotPositionId;
}
