import type { RosterSlotConfig } from "@/db/schema/league-seasons";

const FLEX_ELIGIBLE = new Set(["RB", "WR", "TE"]);

function slotMax(slot: RosterSlotConfig) {
  const raw = slot.maxSlots ?? slot.slotCount;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function slotCount(slot: RosterSlotConfig) {
  const value = Number(slot.slotCount);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Active roster capacity: starters + bench (IR/taxi are separate). */
export function getMaxRosterSize(
  rosterSlots: RosterSlotConfig[] | null | undefined,
  fallbackBenchSlots = 0,
) {
  const slots = rosterSlots ?? [];
  let starters = 0;
  let bench = 0;

  for (const slot of slots) {
    if (slot.positionId === "BN") {
      bench += slotCount(slot);
      continue;
    }
    if (slot.positionId === "IR" || slot.positionId === "TAXI") {
      continue;
    }
    if (slot.isStarter) {
      starters += slotCount(slot);
    }
  }

  if (bench === 0 && fallbackBenchSlots > 0) {
    bench = fallbackBenchSlots;
  }

  return starters + bench;
}

/** Max rosterable players for a primary position (includes FLEX headroom). */
export function getPositionRosterMax(
  rosterSlots: RosterSlotConfig[] | null | undefined,
  positionId: string,
) {
  const slots = rosterSlots ?? [];
  let max = 0;

  for (const slot of slots) {
    if (slot.positionId === positionId) {
      max += slotMax(slot);
    }
  }

  if (FLEX_ELIGIBLE.has(positionId)) {
    for (const slot of slots) {
      if (slot.positionId === "FLEX") {
        max += slotMax(slot);
      }
    }
  }

  // No configured max for this position — total roster size still caps adds.
  if (max === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return max;
}

export function isFlexEligible(positionId: string) {
  return FLEX_ELIGIBLE.has(positionId);
}

/** IR / Taxi are reserve slots and do not consume active roster or position caps. */
export function countsTowardRosterMax(
  slotPositionId: string | null | undefined,
  primaryPositionId: string,
) {
  const slot = slotPositionId ?? primaryPositionId;
  return slot !== "IR" && slot !== "TAXI";
}

export function countActiveRosterPlayers(
  players: Array<{
    slotPositionId: string | null;
    primaryPositionId: string;
  }>,
) {
  return players.filter((player) =>
    countsTowardRosterMax(player.slotPositionId, player.primaryPositionId),
  ).length;
}

export function countActivePositionPlayers(
  players: Array<{
    slotPositionId: string | null;
    primaryPositionId: string;
  }>,
  positionId: string,
) {
  return players.filter(
    (player) =>
      player.primaryPositionId === positionId &&
      countsTowardRosterMax(player.slotPositionId, player.primaryPositionId),
  ).length;
}

/** Ensure active (non-IR/Taxi) roster and position caps are respected. */
export function validateActiveRosterCaps(
  players: Array<{
    slotPositionId: string | null;
    primaryPositionId: string;
  }>,
  rosterSlots: RosterSlotConfig[] | null | undefined,
  fallbackBenchSlots = 0,
): { ok: true } | { ok: false; error: string } {
  const maxRoster = getMaxRosterSize(rosterSlots, fallbackBenchSlots);
  const activeCount = countActiveRosterPlayers(players);
  if (activeCount > maxRoster) {
    return {
      ok: false,
      error: `Active roster can hold ${maxRoster} players (IR and Taxi excluded).`,
    };
  }

  const positionIds = new Set(
    players
      .filter((player) =>
        countsTowardRosterMax(player.slotPositionId, player.primaryPositionId),
      )
      .map((player) => player.primaryPositionId),
  );

  for (const positionId of positionIds) {
    const max = getPositionRosterMax(rosterSlots, positionId);
    if (max === Number.POSITIVE_INFINITY) {
      continue;
    }
    const count = countActivePositionPlayers(players, positionId);
    if (count > max) {
      return {
        ok: false,
        error: `At max ${positionId}s on the active roster (${max}).`,
      };
    }
  }

  return { ok: true };
}
