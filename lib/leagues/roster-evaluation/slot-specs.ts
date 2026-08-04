import type { RosterSlotConfig } from "@/db/schema/league-seasons";

export type StarterSlotSpec = {
  /** Display label: QB, RB1, WR2, FLX, K, … */
  slotLabel: string;
  /** Storage / fill position: QB, RB, WR, TE, FLEX, K, DEF */
  positionId: string;
  /** 0-based depth within that position (RB1=0, RB2=1). */
  depthIndex: number;
};

const SHORT_LABEL: Record<string, string> = {
  FLEX: "FLX",
};

/**
 * Expand league starter settings into ordinal chart/table slots.
 * Bar count matches starter `slotCount` from settings.
 */
export function buildStarterSlotSpecs(
  rosterSlots: RosterSlotConfig[],
): StarterSlotSpec[] {
  const starters = rosterSlots.filter((slot) => slot.isStarter);
  const specs: StarterSlotSpec[] = [];

  for (const slot of starters) {
    const count = Math.max(0, slot.slotCount);
    const short = SHORT_LABEL[slot.positionId] ?? slot.positionId;
    for (let depth = 0; depth < count; depth += 1) {
      const slotLabel =
        count === 1 ? short : `${short}${depth + 1}`;
      specs.push({
        slotLabel,
        positionId: slot.positionId,
        depthIndex: depth,
      });
    }
  }

  return specs;
}
