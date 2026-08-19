import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { validateActiveRosterCaps } from "@/lib/leagues/roster-capacity";
import { getSlotCapacity } from "@/lib/leagues/roster-slots";

export type LineupWeekRelation = "past" | "current" | "future";

export function lineupWeekRelation(
  viewedWeek: number,
  currentWeek: number,
): LineupWeekRelation {
  if (viewedWeek < currentWeek) return "past";
  if (viewedWeek > currentWeek) return "future";
  return "current";
}

/** Lock all slots once the viewed week's NFL slate has fully closed. */
export function isLineupWeekFullyLocked(slateFinalized: boolean): boolean {
  return slateFinalized;
}

export function overlayPlanSlots<
  T extends { id: string; slotPositionId: string | null },
>(players: T[], slotsByPlayerId: Map<string, string>): T[] {
  if (slotsByPlayerId.size === 0) return players;
  return players.map((player) => {
    const slot = slotsByPlayerId.get(player.id);
    return slot == null ? player : { ...player, slotPositionId: slot };
  });
}

export function lineupPlanFitsRoster(
  players: Array<{
    slotPositionId: string | null;
    primaryPositionId: string;
  }>,
  rosterSlots: RosterSlotConfig[],
  benchSlots: number,
): boolean {
  const occupancy = new Map<string, number>();
  for (const player of players) {
    const slot = player.slotPositionId ?? player.primaryPositionId;
    occupancy.set(slot, (occupancy.get(slot) ?? 0) + 1);
  }
  for (const [slot, count] of occupancy) {
    const capacity = getSlotCapacity(rosterSlots, slot, benchSlots);
    if (capacity > 0 && count > capacity) return false;
  }
  return validateActiveRosterCaps(players, rosterSlots, benchSlots).ok;
}
