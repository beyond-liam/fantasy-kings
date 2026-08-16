import { statsWeekHasOccurred } from "@/lib/rankings/table-rank-source";

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

export type SeasonHighlightWeekRow = RankedWeekPlayer & {
  week: number;
  seasonType: string;
};

/** Sum weekly skill-position scores into season-to-date rows for Overview. */
export function playersFromSeasonWeekTotals(
  weeks: SeasonHighlightWeekRow[],
  statsPoint: { week: number; seasonType?: string },
): RankedWeekPlayer[] {
  const totals = new Map<string, RankedWeekPlayer>();

  for (const row of weeks) {
    if (
      !statsWeekHasOccurred(
        { week: row.week, seasonType: row.seasonType },
        statsPoint,
      )
    ) {
      continue;
    }
    const pts = row.fantasyPts ?? 0;
    if (pts <= 0) continue;
    const existing = totals.get(row.id);
    if (!existing) {
      totals.set(row.id, {
        id: row.id,
        fullName: row.fullName,
        sleeperId: row.sleeperId,
        primaryPositionId: row.primaryPositionId,
        nflTeam: row.nflTeam,
        fantasyPts: pts,
      });
      continue;
    }
    existing.fantasyPts = (existing.fantasyPts ?? 0) + pts;
    existing.fullName = row.fullName;
    existing.sleeperId = row.sleeperId ?? existing.sleeperId;
    existing.nflTeam = row.nflTeam ?? existing.nflTeam;
  }

  return [...totals.values()];
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
