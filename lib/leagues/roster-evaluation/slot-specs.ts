import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import {
  LEADER_POSITION_ORDER,
  type LeaderPositionId,
} from "@/lib/leagues/league-position-stats";

export type StarterSlotSpec = {
  /** Display label: QB, RB1, WR2, FLX, CB1, … */
  slotLabel: string;
  /** Storage / fill position: QB, RB, …, CB, S, DT, DE, LB, K, DEF */
  positionId: string;
  /** 0-based depth within that position (RB1=0, RB2=1). */
  depthIndex: number;
};

const SHORT_LABEL: Record<string, string> = {
  FLEX: "FLX",
};

function leaderSortIndex(positionId: string): number {
  const index = LEADER_POSITION_ORDER.indexOf(positionId as LeaderPositionId);
  return index === -1 ? LEADER_POSITION_ORDER.length : index;
}

/**
 * Expand league starter settings into ordinal chart/table slots.
 * Bar count matches starter `slotCount` from settings.
 * Ordered via shared leader position order (offense → IDP → K/DEF).
 */
export function buildStarterSlotSpecs(
  rosterSlots: RosterSlotConfig[],
): StarterSlotSpec[] {
  const starters = rosterSlots
    .filter((slot) => slot.isStarter)
    .toSorted(
      (a, b) =>
        leaderSortIndex(a.positionId) - leaderSortIndex(b.positionId) ||
        a.positionId.localeCompare(b.positionId),
    );
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
