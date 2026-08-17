import { getAdp, sortableRankValue } from "@/lib/rankings/stat-helpers";

export type DraftProjectedPick = {
  picksUntil: number;
  round: number;
  overall: number;
};

type AdpPlayer = {
  id: string;
  fullName: string;
  stats: Record<string, number | null>;
};

export function comparePlayersByAdp(a: AdpPlayer, b: AdpPlayer) {
  const cmp =
    sortableRankValue(getAdp(a.stats)) - sortableRankValue(getAdp(b.stats));
  if (cmp !== 0) {
    return cmp;
  }
  return a.fullName.localeCompare(b.fullName);
}

/**
 * Remaining player at the projected-pick depth, sorted by ADP.
 * On the clock (0) and "up in 1" both map to the 1st player; up in 10 → 10th.
 */
export function getProjectedPickPlayerId(
  players: readonly AdpPlayer[],
  draftedIds: ReadonlySet<string>,
  picksUntil: number,
): string | null {
  return getProjectedPicksByPlayerId(players, draftedIds, [
    { picksUntil, round: 0, overall: 0 },
  ]).keys().next().value ?? null;
}

/** Map remaining ADP depth for each pick onto a player. First pick wins on collision. */
export function getProjectedPicksByPlayerId(
  players: readonly AdpPlayer[],
  draftedIds: ReadonlySet<string>,
  picks: readonly DraftProjectedPick[],
): Map<string, DraftProjectedPick> {
  const remaining = players
    .filter((player) => !draftedIds.has(player.id))
    .toSorted(comparePlayersByAdp);
  const byPlayer = new Map<string, DraftProjectedPick>();

  for (const pick of picks) {
    if (pick.picksUntil < 0) {
      continue;
    }
    const index = Math.max(pick.picksUntil, 1) - 1;
    const player = remaining[index];
    if (!player || byPlayer.has(player.id)) {
      continue;
    }
    byPlayer.set(player.id, pick);
  }

  return byPlayer;
}

export function formatProjectedPickLabel(pick: {
  round: number;
  overall: number;
}) {
  return `Projected pick: Round ${pick.round}, Overall #${pick.overall}`;
}
