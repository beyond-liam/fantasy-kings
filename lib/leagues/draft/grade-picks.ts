import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import {
  adpFromPlayerStats,
  type DraftGradePickInput,
} from "@/lib/leagues/draft/grades";

export function countStarterSlots(settings: LeagueSeasonSettings) {
  return settings.rosterSlots
    .filter((slot) => slot.isStarter)
    .reduce((sum, slot) => sum + slot.slotCount, 0);
}

type RankedPlayerLite = {
  fantasyPts: number | null;
  stats: Record<string, number | null> | null | undefined;
  primaryPositionId: string;
};

type DraftPickLite = {
  teamId: string;
  playerId: string;
  overall: number;
  round: number;
  pickInRound: number;
  playerPositionId: string;
};

/** Map draft picks + season projections into grade inputs. */
export function toDraftGradePickInputs(
  picks: DraftPickLite[],
  rankedById: Map<string, RankedPlayerLite>,
): DraftGradePickInput[] {
  return picks.map((pick) => {
    const player = rankedById.get(pick.playerId);
    return {
      teamId: pick.teamId,
      playerId: pick.playerId,
      overall: pick.overall,
      round: pick.round,
      pickInRound: pick.pickInRound,
      fantasyPts: player?.fantasyPts ?? null,
      adp: adpFromPlayerStats(player?.stats),
      primaryPositionId: player?.primaryPositionId ?? pick.playerPositionId,
    };
  });
}
