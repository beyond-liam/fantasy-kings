import { slotAcceptsPlayer } from "@/lib/leagues/roster-slots";
import type { FilledRosterSlot } from "@/lib/leagues/roster-fill";
import type { LeaguePlayerOwnershipMap } from "@/lib/queries/roster";
import { resolvePlayerOwnership } from "@/lib/queries/roster";
import type { RankedPlayerRow } from "@/lib/queries/players";

export type WaiverTip = {
  playerId: string;
  fullName: string;
  nflTeam: string | null;
  primaryPositionId: string;
  projectedPts: number;
  /** Weakest starter slot this FA could upgrade, if any. */
  targetSlot: string | null;
  upgradeOver: number | null;
};

/**
 * Top free agents by week projection that upgrade a weak starter slot.
 */
export function pickWaiverTips(input: {
  projections: RankedPlayerRow[];
  ownership: LeaguePlayerOwnershipMap;
  lineup: FilledRosterSlot[];
  projectedById: Map<string, number | null>;
  irEligibleStatuses?: readonly string[];
  limit?: number;
}): WaiverTip[] {
  const limit = input.limit ?? 3;

  const slotFloors = input.lineup.map((slot) => {
    const proj = slot.player
      ? (input.projectedById.get(slot.player.id) ?? 0)
      : 0;
    return {
      slotPositionId: slot.slotPositionId,
      projectedPts: proj,
    };
  });

  const tips: WaiverTip[] = [];

  const freeAgents = input.projections
    .filter((player) => {
      const ownership = resolvePlayerOwnership(input.ownership, player.id);
      return !ownership.fantasyTeamId && !ownership.onWaivers;
    })
    .filter((player) => (player.fantasyPts ?? 0) > 0)
    .slice()
    .sort((a, b) => (b.fantasyPts ?? 0) - (a.fantasyPts ?? 0));

  for (const player of freeAgents) {
    if (tips.length >= limit) break;

    let bestSlot: string | null = null;
    let bestUpgrade = 0;

    for (const slot of slotFloors) {
      if (
        !slotAcceptsPlayer(slot.slotPositionId, player.primaryPositionId, {
          irEligibleStatuses: input.irEligibleStatuses,
        })
      ) {
        continue;
      }
      const upgrade = (player.fantasyPts ?? 0) - slot.projectedPts;
      if (upgrade > bestUpgrade) {
        bestUpgrade = upgrade;
        bestSlot = slot.slotPositionId;
      }
    }

    // Still suggest elite FAs even without a clear upgrade.
    if (bestSlot == null && tips.length < limit) {
      tips.push({
        playerId: player.id,
        fullName: player.fullName,
        nflTeam: player.nflTeam,
        primaryPositionId: player.primaryPositionId,
        projectedPts: player.fantasyPts ?? 0,
        targetSlot: null,
        upgradeOver: null,
      });
      continue;
    }

    if (bestSlot != null && bestUpgrade > 0.5) {
      tips.push({
        playerId: player.id,
        fullName: player.fullName,
        nflTeam: player.nflTeam,
        primaryPositionId: player.primaryPositionId,
        projectedPts: player.fantasyPts ?? 0,
        targetSlot: bestSlot,
        upgradeOver: Math.round(bestUpgrade * 100) / 100,
      });
    }
  }

  return tips.slice(0, limit);
}
