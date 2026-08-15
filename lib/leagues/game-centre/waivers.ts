import { slotAcceptsPlayer } from "@/lib/leagues/roster-slots";
import type { FilledRosterSlot } from "@/lib/leagues/roster-fill";
import { hasNflTeamStarted } from "@/lib/leagues/waivers/game-lock";
import type { LeaguePlayerOwnershipMap } from "@/lib/queries/roster";
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

type SlotFloor = {
  key: string;
  slotPositionId: string;
  projectedPts: number;
};

type UpgradeCandidate = {
  player: RankedPlayerRow;
  slot: SlotFloor;
  upgrade: number;
};

function isFreeAgent(
  playerId: string,
  ownership: LeaguePlayerOwnershipMap,
): boolean {
  const row = ownership.get(playerId);
  if (!row) return true;
  return !row.fantasyTeamId && !row.onWaivers;
}

/**
 * Top free agents by projection upgrade over still-open starter slots.
 * Locked slots (starter's NFL game has started) are skipped. Only FAs
 * projected higher than the current starter (or an empty slot) qualify.
 */
export function pickWaiverTips(input: {
  projections: RankedPlayerRow[];
  ownership: LeaguePlayerOwnershipMap;
  lineup: FilledRosterSlot[];
  projectedById: Map<string, number | null>;
  startedTeams?: Set<string>;
  irEligibleStatuses?: readonly string[];
  limit?: number;
}): WaiverTip[] {
  const limit = input.limit ?? 3;
  const startedTeams = input.startedTeams ?? new Set<string>();

  const openSlots: SlotFloor[] = [];
  for (const slot of input.lineup) {
    if (slot.player && hasNflTeamStarted(slot.player.nflTeam, startedTeams)) {
      continue;
    }
    openSlots.push({
      key: slot.key,
      slotPositionId: slot.slotPositionId,
      projectedPts: slot.player
        ? (input.projectedById.get(slot.player.id) ?? 0)
        : 0,
    });
  }

  if (openSlots.length === 0) {
    return [];
  }

  const candidates: UpgradeCandidate[] = [];

  for (const player of input.projections) {
    if (!isFreeAgent(player.id, input.ownership)) continue;
    if (hasNflTeamStarted(player.nflTeam, startedTeams)) continue;

    const projectedPts = player.fantasyPts ?? 0;
    if (projectedPts <= 0) continue;

    for (const slot of openSlots) {
      if (
        !slotAcceptsPlayer(slot.slotPositionId, player.primaryPositionId, {
          irEligibleStatuses: input.irEligibleStatuses,
        })
      ) {
        continue;
      }
      const upgrade = projectedPts - slot.projectedPts;
      if (upgrade > 0) {
        candidates.push({ player, slot, upgrade });
      }
    }
  }

  candidates.sort((a, b) => {
    if (b.upgrade !== a.upgrade) return b.upgrade - a.upgrade;
    return (b.player.fantasyPts ?? 0) - (a.player.fantasyPts ?? 0);
  });

  const usedPlayerIds = new Set<string>();
  const usedSlotKeys = new Set<string>();
  const tips: WaiverTip[] = [];

  for (const candidate of candidates) {
    if (tips.length >= limit) break;
    if (usedPlayerIds.has(candidate.player.id)) continue;
    if (usedSlotKeys.has(candidate.slot.key)) continue;

    usedPlayerIds.add(candidate.player.id);
    usedSlotKeys.add(candidate.slot.key);
    tips.push({
      playerId: candidate.player.id,
      fullName: candidate.player.fullName,
      nflTeam: candidate.player.nflTeam,
      primaryPositionId: candidate.player.primaryPositionId,
      projectedPts: candidate.player.fantasyPts ?? 0,
      targetSlot: candidate.slot.slotPositionId,
      upgradeOver: Math.round(candidate.upgrade * 100) / 100,
    });
  }

  return tips;
}
