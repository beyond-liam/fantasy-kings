import type { WaiverWireSettings } from "@/db/schema/league-seasons";
import {
  isFcfsBlockedUntilWeeklyProcess,
  isFcfsWindowOpen,
} from "@/lib/leagues/waivers/calendar";

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
  /** True when every NFL game on this fantasy week's board is final. */
  slateComplete?: boolean;
  /** Last kickoff on this fantasy week's board — used with slateComplete. */
  lastKickoff?: Date | null;
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

  // Played this week, or slate done until weekly process → claim only.
  if (
    input.gameStartedThisWeek ||
    isFcfsBlockedUntilWeeklyProcess(
      wire,
      Boolean(input.slateComplete),
      now,
      input.lastKickoff ?? null,
    )
  ) {
    return "claim";
  }

  // Cleared, unplayed free agents: add during the weekly FCFS window.
  return isFcfsWindowOpen(wire, now) ? "add" : "claim";
}
