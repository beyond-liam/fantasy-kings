import type { TeamRosterPlayer } from "@/lib/leagues/roster-fill";
import type { PlayerOpponent } from "@/lib/nfl/matchups";

function trimOpponent(opponent: PlayerOpponent | null | undefined) {
  if (!opponent) return undefined;
  const trimmed: PlayerOpponent = {
    label: opponent.label,
    abbrev: opponent.abbrev,
    kickoffLabel: opponent.kickoffLabel,
    gameStatus: opponent.gameStatus,
    hasPossession: opponent.hasPossession,
    inRedZone: opponent.inRedZone,
    gameId: opponent.gameId,
  };
  if (opponent.matchup) {
    trimmed.matchup = opponent.matchup;
  }
  return trimmed;
}

/** Drop empty optional fields before the roster crosses the RSC boundary. */
export function serializeRosterPlayersForClient(
  players: TeamRosterPlayer[],
): TeamRosterPlayer[] {
  return players.map((player) => {
    const next: TeamRosterPlayer = {
      id: player.id,
      fullName: player.fullName,
      nflTeam: player.nflTeam,
      primaryPositionId: player.primaryPositionId,
      byeWeek: player.byeWeek,
      injuryStatus: player.injuryStatus,
      sleeperId: player.sleeperId,
      slotPositionId: player.slotPositionId,
    };

    if (player.yearsExp != null) next.yearsExp = player.yearsExp;
    if (player.taxiActivated) next.taxiActivated = player.taxiActivated;
    if (player.isKeeper) next.isKeeper = player.isKeeper;
    if (player.ownedPct != null) next.ownedPct = player.ownedPct;
    if (player.startPct != null) next.startPct = player.startPct;
    if (player.projectedPts != null) next.projectedPts = player.projectedPts;
    if (player.actualPts != null) next.actualPts = player.actualPts;
    if (player.positionRank != null) next.positionRank = player.positionRank;
    if (player.fantasyPts != null) next.fantasyPts = player.fantasyPts;
    if (player.avgPts != null) next.avgPts = player.avgPts;

    const opponent = trimOpponent(player.opponent);
    if (opponent) next.opponent = opponent;

    if (player.weekStats && Object.keys(player.weekStats).length > 0) {
      next.weekStats = player.weekStats;
    }

    return next;
  });
}
