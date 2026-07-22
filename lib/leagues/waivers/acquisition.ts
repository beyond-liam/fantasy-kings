import type { WaiverWireSettings } from "@/db/schema/league-seasons";
import { isFcfsWindowOpen } from "@/lib/leagues/waivers/calendar";

export type AcquisitionKind = "owned" | "add" | "claim" | "unavailable";

export type AcquisitionInput = {
  waiversEnabled: boolean;
  waiverWire: WaiverWireSettings;
  /** preseason unlocked vs always_on_waivers */
  preseasonFreeAgents?: "always_on_waivers" | "unlocked";
  /** True after draft completed / free agency open for the season. */
  rosterTransactionsEnabled: boolean;
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

  if (!input.waiversEnabled) {
    return "add";
  }

  const now = input.now ?? new Date();
  const wire = input.waiverWire;

  // Active drop waiver period always requires a claim.
  if (input.ownership.onWaivers) {
    return "claim";
  }

  // Game-start lock for free agents when pool includes them.
  if (
    wire.waiverPool === "drops_and_free_agents" &&
    input.gameStartedThisWeek
  ) {
    // Locked onto waivers until FCFS after process (or forever if never).
    if (wire.fcfsMode === "never") {
      return "claim";
    }
    return isFcfsWindowOpen(wire.processDays, now) ? "add" : "claim";
  }

  if (wire.fcfsMode === "never") {
    return "claim";
  }

  // Cleared free agents: add only during FCFS window.
  return isFcfsWindowOpen(wire.processDays, now) ? "add" : "claim";
}
