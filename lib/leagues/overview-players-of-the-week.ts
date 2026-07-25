export type OverviewPlayerHighlight = {
  id: string;
  fullName: string;
  sleeperId: string | null;
  primaryPositionId: string;
  nflTeam: string | null;
  line: string;
  points: number;
};

type RankedWeekPlayer = {
  id: string;
  fullName: string;
  sleeperId: string | null;
  primaryPositionId: string;
  nflTeam: string | null;
  fantasyPts: number | null;
};

function toHighlight(
  player: RankedWeekPlayer,
  points: number,
): OverviewPlayerHighlight {
  return {
    id: player.id,
    fullName: player.fullName,
    sleeperId: player.sleeperId,
    primaryPositionId: player.primaryPositionId,
    nflTeam: player.nflTeam,
    line: `${points.toFixed(1)} pts`,
    points,
  };
}

function pickBestByPositions(
  players: RankedWeekPlayer[],
  positions: ReadonlySet<string>,
): OverviewPlayerHighlight | null {
  let best: RankedWeekPlayer | null = null;
  let bestPts = 0;

  for (const player of players) {
    if (!positions.has(player.primaryPositionId)) continue;
    const pts = player.fantasyPts ?? 0;
    if (pts <= 0) continue;
    if (
      pts > bestPts ||
      (pts === bestPts &&
        best != null &&
        player.fullName.localeCompare(best.fullName) < 0)
    ) {
      best = player;
      bestPts = pts;
    }
  }

  return best ? toHighlight(best, bestPts) : null;
}

/**
 * Weekly leaders by full fantasy points:
 * Passing → best QB, Rushing → best RB, Receiving → best WR/TE.
 */
export function pickPlayersOfTheWeek(players: RankedWeekPlayer[]): {
  passer: OverviewPlayerHighlight | null;
  rusher: OverviewPlayerHighlight | null;
  receiver: OverviewPlayerHighlight | null;
} {
  return {
    passer: pickBestByPositions(players, new Set(["QB"])),
    rusher: pickBestByPositions(players, new Set(["RB"])),
    receiver: pickBestByPositions(players, new Set(["WR", "TE"])),
  };
}
