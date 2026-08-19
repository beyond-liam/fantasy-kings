import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import {
  firstRosterMinimumError,
  simulateRosterAfterMutation,
  wouldBreachRosterMinimums,
} from "@/lib/leagues/roster-minimums";

type RosterPlayer = {
  id: string;
  primaryPositionId: string;
  slotPositionId: string | null;
};

type IncomingPlayer = {
  id: string;
  primaryPositionId: string;
  slotPositionId: string | null;
};

export type WaiverRosterMinimumDropEvaluationResult =
  | { ok: true }
  | { ok: false; error: string | null };

export function evaluateRosterMinimumDrop(input: {
  roster: RosterPlayer[];
  dropPlayerId: string;
  incoming: IncomingPlayer;
  rosterSlots: RosterSlotConfig[];
  enforce: boolean;
}): WaiverRosterMinimumDropEvaluationResult {
  const { roster, dropPlayerId, incoming, rosterSlots, enforce } = input;

  const breach = wouldBreachRosterMinimums({
    roster,
    removeIds: [dropPlayerId],
    add: [incoming],
    rosterSlots,
    enforce,
  });
  if (!breach) {
    return { ok: true };
  }

  return {
    ok: false,
    error: firstRosterMinimumError(
      simulateRosterAfterMutation({
        roster,
        removeIds: [dropPlayerId],
        add: [incoming],
      }),
      rosterSlots,
      true,
    ),
  };
}
