import type {
  HofAllTimeRow,
  HofDivision,
  HofDivisionWinnerRow,
  HofTeamIdentity,
} from "@/lib/leagues/hall-of-fame";
import type { PlayoffBracket } from "@/lib/leagues/playoff-bracket";
import {
  formatPoints,
  formatRecord,
  formatWinPct,
} from "@/lib/leagues/standings";

export type HofTitleTeam = {
  teamId: string;
  teamPublicId: string | null;
  teamName: string;
  ownerName: string;
  logoUrl: string | null;
};

export type HofChampionshipSeason = {
  seasonYear: number;
  champion: HofTitleTeam | null;
  runnerUp: HofTitleTeam | null;
};

export type HofRegularSeasonTitle = {
  seasonYear: number;
  team: HofTitleTeam;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
};

export type HofDivisionTitleSeason = {
  seasonYear: number;
  divisionId: string;
  divisionName: string;
  team: HofTitleTeam;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
};

export type { HofDivision };

export function teamFromIdentity(team: HofTeamIdentity): HofTitleTeam {
  return {
    teamId: team.teamId,
    teamPublicId: team.teamPublicId,
    teamName: team.teamName,
    ownerName: team.ownerName,
    logoUrl: team.logoUrl,
  };
}

export function buildChampionshipSeasonRow(input: {
  seasonYear: number;
  teams: HofTeamIdentity[];
  championTeamId: string | null;
  runnerUpTeamId?: string | null;
}): HofChampionshipSeason {
  const byId = new Map(input.teams.map((t) => [t.teamId, t]));
  const champ = input.championTeamId
    ? byId.get(input.championTeamId)
    : undefined;
  const runner = input.runnerUpTeamId
    ? byId.get(input.runnerUpTeamId)
    : undefined;
  return {
    seasonYear: input.seasonYear,
    champion: champ?.claimed ? teamFromIdentity(champ) : null,
    runnerUp: runner?.claimed ? teamFromIdentity(runner) : null,
  };
}

/** Regular-season champion = #1 on the RS all-time / standings table. */
export function buildRegularSeasonTitleRow(input: {
  seasonYear: number;
  allTimeTable: HofAllTimeRow[];
}): HofRegularSeasonTitle | null {
  const top = input.allTimeTable[0];
  if (!top || top.wins <= 0) return null;
  return {
    seasonYear: input.seasonYear,
    team: {
      teamId: top.teamId,
      teamPublicId: top.teamPublicId,
      teamName: top.teamName,
      ownerName: top.ownerName,
      logoUrl: top.logoUrl,
    },
    wins: top.wins,
    losses: top.losses,
    ties: top.ties,
    winPct: top.winPct,
    pointsFor: top.pointsFor,
  };
}

export function toDivisionTitleSeasons(
  winners: HofDivisionWinnerRow[],
): HofDivisionTitleSeason[] {
  return winners.map((row) => ({
    seasonYear: row.seasonYear,
    divisionId: row.divisionId,
    divisionName: row.divisionName,
    team: {
      teamId: row.teamId,
      teamPublicId: row.teamPublicId,
      teamName: row.teamName,
      ownerName: row.ownerName,
      logoUrl: row.logoUrl,
    },
    wins: row.wins,
    losses: row.losses,
    ties: row.ties,
    winPct: row.winPct,
    pointsFor: row.pointsFor,
  }));
}

export function formatTitleRecord(row: {
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
}) {
  return `${formatRecord(row.wins, row.losses, row.ties)} · ${formatWinPct(row.winPct)} · ${formatPoints(row.pointsFor)} PF`;
}

function teamIdFromSlot(
  slot: PlayoffBracket["rounds"][number]["matchups"][number]["top"],
): string | null {
  if (slot.type === "team" || slot.type === "bye") {
    return slot.team.teamId;
  }
  return null;
}

/** Runner-up = the other championship finalist when a champion is crowned. */
export function runnerUpTeamIdFromBracket(
  bracket: PlayoffBracket | null | undefined,
): string | null {
  if (!bracket?.champion?.teamId) return null;
  const champId = bracket.champion.teamId;

  const championship =
    bracket.rounds.find((round) => round.id === "championship-g2") ??
    bracket.rounds.find((round) => round.id === "championship");
  const matchup = championship?.matchups[0];
  if (!matchup) return null;

  const topId = teamIdFromSlot(matchup.top);
  const bottomId = teamIdFromSlot(matchup.bottom);
  if (topId && topId !== champId) return topId;
  if (bottomId && bottomId !== champId) return bottomId;
  return null;
}
