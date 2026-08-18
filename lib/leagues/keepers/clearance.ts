export type ClearanceSource = "commissioner" | "deadline" | "draft_start";

export type RosteredKeeperRow = {
  rosterRowId: string;
  teamId: string;
  teamName: string;
  ownerName: string | null;
  playerId: string;
  playerName: string;
  isKeeper: boolean;
};

export type NonKeeperClearanceTeam = {
  teamId: string;
  teamName: string;
  ownerName: string | null;
  players: { playerId: string; playerName: string }[];
};

/** Teams that still have rostered non-keepers, in team-name order. */
export function groupNonKeepersForClearance(
  rows: RosteredKeeperRow[],
): NonKeeperClearanceTeam[] {
  const byTeam = new Map<string, NonKeeperClearanceTeam>();

  for (const row of rows) {
    let team = byTeam.get(row.teamId);
    if (!team) {
      team = {
        teamId: row.teamId,
        teamName: row.teamName,
        ownerName: row.ownerName,
        players: [],
      };
      byTeam.set(row.teamId, team);
    }
    if (!row.isKeeper) {
      team.players.push({
        playerId: row.playerId,
        playerName: row.playerName,
      });
    }
  }

  return [...byTeam.values()]
    .filter((team) => team.players.length > 0)
    .map((team) => ({
      ...team,
      players: team.players.toSorted((a, b) =>
        a.playerName.localeCompare(b.playerName),
      ),
    }))
    .toSorted((a, b) => a.teamName.localeCompare(b.teamName));
}

export function countNonKeepers(teams: NonKeeperClearanceTeam[]): number {
  let count = 0;
  for (const team of teams) {
    count += team.players.length;
  }
  return count;
}

export function keepersClearedSummary(
  source: ClearanceSource,
  clearedCount: number,
): string {
  const noun = `non-keeper${clearedCount === 1 ? "" : "s"}`;
  if (source === "commissioner") {
    return clearedCount === 0
      ? "Commissioner cleared non-keepers (none remaining)"
      : `Commissioner cleared ${clearedCount} ${noun}`;
  }
  if (source === "deadline") {
    return clearedCount === 0
      ? "Keeper deadline passed with no non-keepers to clear"
      : `Keeper deadline cleared ${clearedCount} ${noun}`;
  }
  return clearedCount === 0
    ? "Draft start cleared non-keepers (none remaining)"
    : `Draft start cleared ${clearedCount} ${noun}`;
}
