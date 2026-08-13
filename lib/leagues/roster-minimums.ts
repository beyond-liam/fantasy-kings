import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { countsTowardRosterMax } from "@/lib/leagues/roster-capacity";

export type RosterMinimumPlayer = {
  id: string;
  primaryPositionId: string;
  slotPositionId?: string | null;
};

/** Sum of `minSlots` for a position across roster slot config. */
export function slotMinForPosition(
  rosterSlots: RosterSlotConfig[] | null | undefined,
  positionId: string,
) {
  let min = 0;
  for (const slot of rosterSlots ?? []) {
    if (slot.positionId === positionId) {
      min += slot.minSlots ?? 0;
    }
  }
  return min;
}

/** Positions that have a configured minimum (&gt; 0). */
export function positionsWithMinimums(
  rosterSlots: RosterSlotConfig[] | null | undefined,
): Array<{ positionId: string; min: number }> {
  const byPosition = new Map<string, number>();
  for (const slot of rosterSlots ?? []) {
    const min = slot.minSlots ?? 0;
    if (min <= 0) continue;
    byPosition.set(
      slot.positionId,
      (byPosition.get(slot.positionId) ?? 0) + min,
    );
  }
  return [...byPosition.entries()].map(([positionId, min]) => ({
    positionId,
    min,
  }));
}

function countsForMinimum(player: RosterMinimumPlayer) {
  return countsTowardRosterMax(player.slotPositionId, player.primaryPositionId);
}

export function countActiveAtPosition(
  players: RosterMinimumPlayer[],
  positionId: string,
) {
  return players.filter(
    (player) =>
      countsForMinimum(player) && player.primaryPositionId === positionId,
  ).length;
}

/**
 * Errors when active roster counts fall below slot `minSlots`.
 * Iterates every position with a minimum (including zero remaining).
 */
export function validateRosterMinimums(
  players: RosterMinimumPlayer[],
  rosterSlots: RosterSlotConfig[] | null | undefined,
  enforce: boolean,
): string[] {
  if (!enforce) {
    return [];
  }

  const errors: string[] = [];
  for (const { positionId, min } of positionsWithMinimums(rosterSlots)) {
    const count = countActiveAtPosition(players, positionId);
    if (count < min) {
      errors.push(
        `Roster would be below the minimum ${positionId} count (${min}).`,
      );
    }
  }
  return errors;
}

export function firstRosterMinimumError(
  players: RosterMinimumPlayer[],
  rosterSlots: RosterSlotConfig[] | null | undefined,
  enforce: boolean,
): string | null {
  return validateRosterMinimums(players, rosterSlots, enforce)[0] ?? null;
}

export function simulateRosterAfterMutation(input: {
  roster: RosterMinimumPlayer[];
  removeIds: Iterable<string>;
  add?: RosterMinimumPlayer[];
}): RosterMinimumPlayer[] {
  const remove = new Set(input.removeIds);
  const remaining = input.roster.filter((player) => !remove.has(player.id));
  return input.add?.length ? [...remaining, ...input.add] : remaining;
}

/** Whether removing these players (optionally adding others) breaches mins. */
export function wouldBreachRosterMinimums(input: {
  roster: RosterMinimumPlayer[];
  removeIds: Iterable<string>;
  add?: RosterMinimumPlayer[];
  rosterSlots: RosterSlotConfig[] | null | undefined;
  enforce: boolean;
}): boolean {
  if (!input.enforce) return false;
  const next = simulateRosterAfterMutation(input);
  return validateRosterMinimums(next, input.rosterSlots, true).length > 0;
}

export type MinimumDropClassification<T extends RosterMinimumPlayer> = {
  eligible: T[];
  ineligible: Array<{ player: T; reason: string }>;
};

/**
 * Split cut/drop candidates into those that keep position minimums and those that don't.
 * `incoming` / `alsoRemovingIds` model claim adds and trade offers already leaving.
 */
export function classifyDropCandidatesForMinimums<
  T extends RosterMinimumPlayer,
>(input: {
  candidates: T[];
  roster: RosterMinimumPlayer[];
  rosterSlots: RosterSlotConfig[] | null | undefined;
  enforce: boolean;
  incoming?: RosterMinimumPlayer[];
  alsoRemovingIds?: Iterable<string>;
}): MinimumDropClassification<T> {
  if (!input.enforce) {
    return { eligible: [...input.candidates], ineligible: [] };
  }

  const alsoRemoving = new Set(input.alsoRemovingIds ?? []);
  const eligible: T[] = [];
  const ineligible: Array<{ player: T; reason: string }> = [];

  for (const player of input.candidates) {
    const next = simulateRosterAfterMutation({
      roster: input.roster,
      removeIds: [...alsoRemoving, player.id],
      add: input.incoming,
    });
    const error = firstRosterMinimumError(next, input.rosterSlots, true);
    if (error) {
      ineligible.push({ player, reason: error });
    } else {
      eligible.push(player);
    }
  }

  return { eligible, ineligible };
}

/** True when toggling this id into `offeringIds` would breach mins after receives. */
export function wouldOfferingBreachRosterMinimums(input: {
  roster: RosterMinimumPlayer[];
  offeringIds: Iterable<string>;
  receiving: RosterMinimumPlayer[];
  playerId: string;
  rosterSlots: RosterSlotConfig[] | null | undefined;
  enforce: boolean;
}): boolean {
  if (!input.enforce) return false;
  const offering = new Set(input.offeringIds);
  if (offering.has(input.playerId)) {
    // Deselecting never breaches.
    return false;
  }
  offering.add(input.playerId);
  const next = simulateRosterAfterMutation({
    roster: input.roster,
    removeIds: offering,
    add: input.receiving,
  });
  return validateRosterMinimums(next, input.rosterSlots, true).length > 0;
}
