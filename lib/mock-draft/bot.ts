import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import type { MockDraftScoring } from "@/lib/mock-draft/settings";

export type MockDraftPlayer = {
  id: string;
  fullName: string;
  primaryPositionId: string;
  nflTeam: string | null;
  stats: Record<string, number | null>;
  fantasyPts: number | null;
};

const FLEX_ELIGIBLE = new Set(["RB", "WR", "TE"]);
const DEFERRED_POSITIONS = new Set(["K", "DEF"]);

export function getAdpForScoring(
  stats: Record<string, number | null>,
  scoring: MockDraftScoring,
): number | null {
  const raw =
    scoring === "full_ppr"
      ? (stats.adp_ppr ?? stats.adp_dd_ppr ?? stats.adp_half_ppr ?? stats.adp_std)
      : scoring === "half_ppr"
        ? (stats.adp_half_ppr ?? stats.adp_ppr ?? stats.adp_dd_ppr ?? stats.adp_std)
        : (stats.adp_std ?? stats.adp_half_ppr ?? stats.adp_ppr ?? stats.adp_dd_ppr);

  if (raw == null || raw >= 999) return null;
  return Number.isFinite(raw) ? raw : null;
}

function rankValue(
  player: MockDraftPlayer,
  scoring: MockDraftScoring,
): number {
  const adp = getAdpForScoring(player.stats, scoring);
  if (adp != null) return adp;
  // Higher fantasy pts = better; invert so lower is better like ADP.
  if (player.fantasyPts != null && Number.isFinite(player.fantasyPts)) {
    return 1000 - player.fantasyPts;
  }
  return 9999;
}

function starterNeeds(
  rosterSlots: RosterSlotConfig[],
  draftedPositions: string[],
): Record<string, number> {
  const needs: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const pos of draftedPositions) {
    counts[pos] = (counts[pos] ?? 0) + 1;
  }

  let flexSlots = 0;
  for (const slot of rosterSlots) {
    if (!slot.isStarter) continue;
    if (slot.positionId === "BN" || slot.positionId === "IR" || slot.positionId === "TAXI") {
      continue;
    }
    if (slot.positionId === "FLEX") {
      flexSlots += slot.slotCount;
      continue;
    }
    const have = counts[slot.positionId] ?? 0;
    const need = Math.max(0, slot.slotCount - have);
    if (need > 0) needs[slot.positionId] = need;
    // Excess beyond starter slots can fill FLEX later
    counts[slot.positionId] = Math.max(0, have - slot.slotCount);
  }

  if (flexSlots > 0) {
    let flexFilled = 0;
    for (const pos of FLEX_ELIGIBLE) {
      flexFilled += counts[pos] ?? 0;
    }
    const flexNeed = Math.max(0, flexSlots - flexFilled);
    if (flexNeed > 0) needs.FLEX = flexNeed;
  }

  return needs;
}

function playerFillsNeed(
  positionId: string,
  needs: Record<string, number>,
): boolean {
  if ((needs[positionId] ?? 0) > 0) return true;
  if ((needs.FLEX ?? 0) > 0 && FLEX_ELIGIBLE.has(positionId)) return true;
  return false;
}

export type PickBotPlayerInput = {
  available: MockDraftPlayer[];
  draftedPositions: string[];
  rosterSlots: RosterSlotConfig[];
  scoring: MockDraftScoring;
  /** Picks remaining for this team including the current pick. */
  picksRemainingForTeam: number;
  /** Optional RNG for tie-break among top candidates (0–1). */
  random?: () => number;
};

/**
 * Need-aware ADP bot: fills open starters by ADP, defers K/DEF until the
 * last two picks for the team, then BPA into bench.
 */
export function pickBotPlayer(input: PickBotPlayerInput): MockDraftPlayer | null {
  if (input.available.length === 0) return null;

  const lateRound = input.picksRemainingForTeam <= 2;
  const needs = starterNeeds(input.rosterSlots, input.draftedPositions);
  const random = input.random ?? Math.random;

  let pool = input.available;
  if (!lateRound) {
    const withoutDeferred = pool.filter(
      (player) => !DEFERRED_POSITIONS.has(player.primaryPositionId),
    );
    if (withoutDeferred.length > 0) {
      pool = withoutDeferred;
    }
  }

  const needPool = pool.filter((player) =>
    playerFillsNeed(player.primaryPositionId, needs),
  );

  const candidates = needPool.length > 0 ? needPool : pool;
  const sorted = [...candidates].sort(
    (a, b) => rankValue(a, input.scoring) - rankValue(b, input.scoring),
  );

  const topN = sorted.slice(0, Math.min(3, sorted.length));
  const index = Math.min(
    topN.length - 1,
    Math.floor(random() * topN.length),
  );
  return topN[index] ?? sorted[0] ?? null;
}
