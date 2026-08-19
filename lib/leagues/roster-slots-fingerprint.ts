import type { TeamRosterPlayer } from "@/lib/leagues/roster-fill";

/** Stable roster slot assignment key for week-switch cache validation. */
export function rosterSlotsFingerprint(players: TeamRosterPlayer[]) {
  return players
    .map((player) => `${player.id}:${player.slotPositionId ?? ""}`)
    .sort()
    .join("|");
}
