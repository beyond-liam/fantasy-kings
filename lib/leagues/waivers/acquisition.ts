import type { WaiverWireSettings } from "@/db/schema/league-seasons";
import { isFcfsWindowOpen } from "@/lib/leagues/waivers/calendar";

export type AcquisitionKind = "owned" | "add" | "claim" | "unavailable";

export type AcquisitionInput = {
  waiversEnabled: boolean;
  waiverWire: WaiverWireSettings;
  /** True after draft completed / free agency open for the season. */
  rosterTransactionsEnabled: boolean;
  /** Fantasy-league preseason (before first counting fantasy week). */
  isFantasyPreseason?: boolean;
  now?: Date;
  ownership: {
    fantasyTeamId: string | null;
    onWaivers: boolean;
  };
  /** True when this player's NFL team has started its game this fantasy week. */
  gameStartedThisWeek?: boolean;
};

/**
 * Decide how an unowned (or waived) player may be acquired.
 * Callers must pass accurate `onWaivers` from ownership map.
 */
export function getAcquisitionKind(input: AcquisitionInput): AcquisitionKind {
  if (!input.rosterTransactionsEnabled) {
    return "unavailable";
  }

  if (input.ownership.fantasyTeamId) {
    return "owned";
  }

  const wire = input.waiverWire;

  // Already played this fantasy week → locked until the next week,
  // unless daily drop processing holds them for the weekly claim pool.
  if (input.gameStartedThisWeek && !wire.dailyDropProcessing) {
    return "unavailable";
  }

  if (!input.waiversEnabled) {
    return "add";
  }

  const now = input.now ?? new Date();

  // Active drop waiver period always requires a claim.
  if (input.ownership.onWaivers) {
    return "claim";
  }

  // Fantasy preseason: unlocked free agents, or always-on claims (FCFS paused).
  if (input.isFantasyPreseason) {
    return wire.preseasonWaivers ? "claim" : "add";
  }

  if (wire.fcfsMode === "never") {
    return "claim";
  }

  // Cleared free agents: add only during the weekly FCFS window.
  return isFcfsWindowOpen(wire, now) ? "add" : "claim";
}
