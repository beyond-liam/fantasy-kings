import type { RankedPlayerRow } from "@/lib/queries/players";
import type { PositionFilter } from "@/lib/rankings/column-config";

export type TeamStatsSectionId =
  | "quarterbacks"
  | "skill"
  | "kickers"
  | "defense";

export type TeamStatsSection = {
  id: TeamStatsSectionId;
  title: string;
  /** Column layout source for players-table stats. */
  columnPosition: PositionFilter;
  players: RankedPlayerRow[];
};

const SKILL_POSITIONS = new Set(["RB", "WR", "TE", "FLEX"]);

export function groupRosterPlayersForStats(
  players: RankedPlayerRow[],
): TeamStatsSection[] {
  const quarterbacks: RankedPlayerRow[] = [];
  const skill: RankedPlayerRow[] = [];
  const kickers: RankedPlayerRow[] = [];
  const defense: RankedPlayerRow[] = [];

  for (const player of players) {
    const position = player.primaryPositionId;

    if (position === "QB") {
      quarterbacks.push(player);
      continue;
    }

    if (SKILL_POSITIONS.has(position)) {
      skill.push(player);
      continue;
    }

    if (position === "K") {
      kickers.push(player);
      continue;
    }

    if (position === "DEF") {
      defense.push(player);
    }
  }

  const byFantasyPts = (a: RankedPlayerRow, b: RankedPlayerRow) =>
    (b.fantasyPts ?? 0) - (a.fantasyPts ?? 0);

  return [
    {
      id: "quarterbacks",
      title: "Quarterbacks",
      columnPosition: "QB",
      players: quarterbacks.sort(byFantasyPts),
    },
    {
      id: "skill",
      title: "Running Backs & Receivers",
      columnPosition: "RB",
      players: skill.sort(byFantasyPts),
    },
    {
      id: "kickers",
      title: "Kickers",
      columnPosition: "K",
      players: kickers.sort(byFantasyPts),
    },
    {
      id: "defense",
      title: "Team Defense",
      columnPosition: "DEF",
      players: defense.sort(byFantasyPts),
    },
  ];
}
