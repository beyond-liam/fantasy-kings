import type { RankedPlayerRow } from "@/lib/queries/players";
import type { PositionFilter } from "@/lib/rankings/column-config";

export type TeamStatsSectionId =
  | "quarterbacks"
  | "skill"
  | "kickers"
  | "defensive-backs"
  | "defensive-linemen"
  | "linebackers"
  | "defense";

export type TeamStatsSection = {
  id: TeamStatsSectionId;
  title: string;
  /** Column layout source for players-table stats. */
  columnPosition: PositionFilter;
  players: RankedPlayerRow[];
};

const SKILL_POSITIONS = new Set(["RB", "WR", "TE", "FLEX"]);
const DEFENSIVE_BACK_POSITIONS = new Set(["CB", "S"]);
const DEFENSIVE_LINE_POSITIONS = new Set(["DT", "DE"]);

function byFantasyPts(a: RankedPlayerRow, b: RankedPlayerRow) {
  return (b.fantasyPts ?? 0) - (a.fantasyPts ?? 0);
}

function section(
  id: TeamStatsSectionId,
  title: string,
  columnPosition: PositionFilter,
  players: RankedPlayerRow[],
): TeamStatsSection {
  return {
    id,
    title,
    columnPosition,
    players: players.sort(byFantasyPts),
  };
}

/**
 * Group roster players into Player Stats tables.
 * Team DEF and IDP buckets are omitted when empty so offense-only rosters
 * stay clean.
 */
export function groupRosterPlayersForStats(
  players: RankedPlayerRow[],
): TeamStatsSection[] {
  const quarterbacks: RankedPlayerRow[] = [];
  const skill: RankedPlayerRow[] = [];
  const kickers: RankedPlayerRow[] = [];
  const defensiveBacks: RankedPlayerRow[] = [];
  const defensiveLinemen: RankedPlayerRow[] = [];
  const linebackers: RankedPlayerRow[] = [];
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

    if (DEFENSIVE_BACK_POSITIONS.has(position)) {
      defensiveBacks.push(player);
      continue;
    }

    if (DEFENSIVE_LINE_POSITIONS.has(position)) {
      defensiveLinemen.push(player);
      continue;
    }

    if (position === "LB") {
      linebackers.push(player);
      continue;
    }

    if (position === "DEF") {
      defense.push(player);
    }
  }

  const sections: TeamStatsSection[] = [
    section("quarterbacks", "Quarterbacks", "QB", quarterbacks),
    section("skill", "Running Backs and Receivers", "RB", skill),
    section("kickers", "Kickers", "K", kickers),
  ];

  if (defensiveBacks.length > 0) {
    sections.push(
      section("defensive-backs", "Defensive Backs", "CB", defensiveBacks),
    );
  }
  if (defensiveLinemen.length > 0) {
    sections.push(
      section("defensive-linemen", "Defensive Linemen", "DE", defensiveLinemen),
    );
  }
  if (linebackers.length > 0) {
    sections.push(section("linebackers", "Linebackers", "LB", linebackers));
  }
  if (defense.length > 0) {
    sections.push(section("defense", "Team Defense", "DEF", defense));
  }

  return sections;
}
