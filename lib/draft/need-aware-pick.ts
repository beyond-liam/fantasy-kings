import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";

export type NeedAwarePlayer = {
  id: string;
  fullName: string;
  primaryPositionId: string;
  nflTeam: string | null;
  stats: Record<string, number | null>;
  fantasyPts: number | null;
  byeWeek?: number | null;
};

export type DraftedRosterPlayer = {
  primaryPositionId: string;
  byeWeek?: number | null;
};

const FLEX_ELIGIBLE = new Set(["RB", "WR", "TE"]);
const DEFERRED_POSITIONS = new Set(["K", "DEF"]);

export function getAdpForScoring(
  stats: Record<string, number | null>,
  scoring: ScoringPreset,
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

/** Lower is better (ADP-like). Falls back to inverted fantasy pts (BPA). */
export function rankValue(
  player: NeedAwarePlayer,
  scoring: ScoringPreset,
): number {
  const adp = getAdpForScoring(player.stats, scoring);
  if (adp != null) return adp;
  if (player.fantasyPts != null && Number.isFinite(player.fantasyPts)) {
    return 1000 - player.fantasyPts;
  }
  return 9999;
}

export function starterNeeds(
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
    if (
      slot.positionId === "BN" ||
      slot.positionId === "IR" ||
      slot.positionId === "TAXI"
    ) {
      continue;
    }
    if (slot.positionId === "FLEX") {
      flexSlots += slot.slotCount;
      continue;
    }
    const have = counts[slot.positionId] ?? 0;
    const need = Math.max(0, slot.slotCount - have);
    if (need > 0) needs[slot.positionId] = need;
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

export function playerFillsNeed(
  positionId: string,
  needs: Record<string, number>,
): boolean {
  if ((needs[positionId] ?? 0) > 0) return true;
  if ((needs.FLEX ?? 0) > 0 && FLEX_ELIGIBLE.has(positionId)) return true;
  return false;
}

/** 1 when bye matches another rostered player at the same position. */
export function samePositionByeClash(
  player: Pick<NeedAwarePlayer, "primaryPositionId" | "byeWeek">,
  roster: DraftedRosterPlayer[],
): number {
  if (player.byeWeek == null) return 0;
  for (const row of roster) {
    if (row.primaryPositionId !== player.primaryPositionId) continue;
    if (row.byeWeek != null && row.byeWeek === player.byeWeek) return 1;
  }
  return 0;
}

export type PickNeedAwarePlayerInput = {
  available: NeedAwarePlayer[];
  /** Positions already drafted by this team (order irrelevant). */
  draftedRoster: DraftedRosterPlayer[];
  rosterSlots: RosterSlotConfig[];
  scoring: ScoringPreset;
  /** Picks remaining for this team including the current pick. */
  picksRemainingForTeam: number;
  /**
   * Optional RNG for tie-break among top candidates (0–1).
   * League autopick should pass `() => 0` for a deterministic top pick.
   */
  random?: () => number;
};

/**
 * Need-aware ADP bot with BPA fallback and same-position bye avoidance.
 *
 * 1. Prefer players who fill open starter needs (else BPA into full pool)
 * 2. Defer K/DEF until the team's last two picks
 * 3. Rank by ADP, then season projection points (BPA)
 * 4. Prefer candidates whose bye does not clash with same-position teammates
 */
export function pickNeedAwarePlayer(
  input: PickNeedAwarePlayerInput,
): NeedAwarePlayer | null {
  if (input.available.length === 0) return null;

  const draftedPositions = input.draftedRoster.map(
    (row) => row.primaryPositionId,
  );
  const lateRound = input.picksRemainingForTeam <= 2;
  const needs = starterNeeds(input.rosterSlots, draftedPositions);
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

  const sorted = [...candidates].sort((a, b) => {
    const byeDiff =
      samePositionByeClash(a, input.draftedRoster) -
      samePositionByeClash(b, input.draftedRoster);
    if (byeDiff !== 0) return byeDiff;

    return rankValue(a, input.scoring) - rankValue(b, input.scoring);
  });

  const topN = sorted.slice(0, Math.min(3, sorted.length));
  const index = Math.min(
    topN.length - 1,
    Math.floor(random() * topN.length),
  );
  return topN[index] ?? sorted[0] ?? null;
}
