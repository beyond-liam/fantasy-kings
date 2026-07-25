import type {
  OverviewInefficiencyRow,
  OverviewPositionLeader,
  OverviewTeamMetric,
} from "@/lib/leagues/league-overview";
import type { OverviewPlayerHighlight } from "@/lib/leagues/overview-players-of-the-week";
import type {
  LeagueStandingsRow,
  StandingsFormGame,
} from "@/lib/leagues/standings";

export type LeagueOverviewMockData = {
  leagueSlug: string;
  standingsRows: LeagueStandingsRow[];
  myTeamId: string | null;
  highestScorer: OverviewTeamMetric | null;
  worstDefense: OverviewTeamMetric | null;
  inefficient: OverviewInefficiencyRow | null;
  seasonLeaders: OverviewPositionLeader[];
  playersOfTheWeek: {
    passer: OverviewPlayerHighlight | null;
    rusher: OverviewPlayerHighlight | null;
    receiver: OverviewPlayerHighlight | null;
  };
  highlightWeek: number | null;
};

const MY_TEAM_ID = "mock-team-4";

function form(
  results: Array<"W" | "L" | "T">,
  startWeek = 3,
): StandingsFormGame[] {
  const opponents = [
    "Northside Knights",
    "Bayou Ballers",
    "Iron Curtain FC",
    "Redzone Renegades",
    "Gridiron Ghosts",
  ];
  return results.map((result, index) => ({
    result,
    week: startWeek + index,
    opponentName: opponents[index] ?? `Team ${index + 1}`,
    ownPts:
      result === "W" ? 118.4 + index : result === "T" ? 102.2 : 94.1 + index,
    oppPts:
      result === "W" ? 101.2 + index : result === "T" ? 102.2 : 112.6 + index,
  }));
}

function standing(
  partial: Pick<
    LeagueStandingsRow,
    | "id"
    | "teamId"
    | "teamName"
    | "wins"
    | "losses"
    | "ties"
    | "pointsFor"
    | "pointsAgainst"
    | "form"
  > &
    Partial<LeagueStandingsRow>,
): LeagueStandingsRow {
  const games = partial.wins + partial.losses + partial.ties;
  const winPct =
    games === 0 ? 0 : (partial.wins + partial.ties * 0.5) / games;
  return {
    teamPublicId: partial.teamId,
    claimed: true,
    ownerName: "Manager",
    logoUrl: null,
    winPct,
    gamesBehind: null,
    streak: null,
    pointsForAvg: games ? partial.pointsFor / games : 0,
    pointsAgainstAvg: games ? partial.pointsAgainst / games : 0,
    waiverPriority: null,
    faabRemaining: null,
    rank: null,
    draftOrder: null,
    opponentName: null,
    sos: null,
    sosPlayed: null,
    sosRemaining: null,
    ...partial,
  };
}

const MOCK_STANDINGS: LeagueStandingsRow[] = [
  standing({
    id: "mock-team-2",
    teamId: "mock-team-2",
    teamName: "Northside Knights",
    rank: 2,
    wins: 6,
    losses: 1,
    ties: 0,
    pointsFor: 912.4,
    pointsAgainst: 780.1,
    form: form(["W", "W", "L", "W", "W"]),
  }),
  standing({
    id: "mock-team-3",
    teamId: "mock-team-3",
    teamName: "Bayou Ballers",
    rank: 3,
    wins: 5,
    losses: 2,
    ties: 0,
    pointsFor: 888.2,
    pointsAgainst: 801.4,
    form: form(["W", "L", "W", "W", "L"]),
  }),
  standing({
    id: MY_TEAM_ID,
    teamId: MY_TEAM_ID,
    teamName: "Your Squad",
    rank: 4,
    wins: 4,
    losses: 3,
    ties: 0,
    pointsFor: 854.6,
    pointsAgainst: 842.0,
    form: form(["L", "W", "W", "L", "W"]),
  }),
  standing({
    id: "mock-team-5",
    teamId: "mock-team-5",
    teamName: "Iron Curtain FC",
    rank: 5,
    wins: 4,
    losses: 3,
    ties: 0,
    pointsFor: 841.1,
    pointsAgainst: 860.3,
    form: form(["W", "L", "L", "W", "W"]),
  }),
  standing({
    id: "mock-team-6",
    teamId: "mock-team-6",
    teamName: "Redzone Renegades",
    rank: 6,
    wins: 3,
    losses: 4,
    ties: 0,
    pointsFor: 802.8,
    pointsAgainst: 879.5,
    form: form(["L", "L", "W", "L", "W"]),
  }),
];

const MOCK_HIGHEST: OverviewTeamMetric = {
  teamId: "mock-team-2",
  teamPublicId: "mock-team-2",
  teamName: "Northside Knights",
  ownerName: "Alex Rivera",
  logoUrl: null,
  value: 912.4,
};

const MOCK_WORST_DEFENSE: OverviewTeamMetric = {
  teamId: "mock-team-8",
  teamPublicId: "mock-team-8",
  teamName: "Soft Zone Society",
  ownerName: "Jordan Blake",
  logoUrl: null,
  value: 948.6,
};

const MOCK_INEFFICIENT: OverviewInefficiencyRow = {
  teamId: "mock-team-8",
  teamPublicId: "mock-team-8",
  teamName: "Soft Zone Society",
  ownerName: "Jordan Blake",
  logoUrl: null,
  value: 74.8,
  pointsFor: 760.2,
  optimumPointsFor: 1016.3,
};

const MOCK_SEASON_LEADERS: OverviewPositionLeader[] = [
  {
    positionId: "QB",
    label: "Quarterback",
    teamId: "mock-team-2",
    teamPublicId: "mock-team-2",
    teamName: "Northside Knights",
    logoUrl: null,
    points: 168.4,
  },
  {
    positionId: "RB",
    label: "Running back",
    teamId: MY_TEAM_ID,
    teamPublicId: MY_TEAM_ID,
    teamName: "Your Squad",
    logoUrl: null,
    points: 214.7,
  },
  {
    positionId: "WR",
    label: "Wide receiver",
    teamId: "mock-team-3",
    teamPublicId: "mock-team-3",
    teamName: "Bayou Ballers",
    logoUrl: null,
    points: 246.1,
  },
  {
    positionId: "TE",
    label: "Tight end",
    teamId: "mock-team-5",
    teamPublicId: "mock-team-5",
    teamName: "Iron Curtain FC",
    logoUrl: null,
    points: 98.3,
  },
];

const MOCK_POTW = {
  passer: {
    id: "mock-qb",
    fullName: "Josh Allen",
    sleeperId: "4984",
    primaryPositionId: "QB",
    nflTeam: "BUF",
    line: "28.4 pts",
    points: 28.4,
  },
  rusher: {
    id: "mock-rb",
    fullName: "Saquon Barkley",
    sleeperId: "4866",
    primaryPositionId: "RB",
    nflTeam: "PHI",
    line: "24.1 pts",
    points: 24.1,
  },
  receiver: {
    id: "mock-wr",
    fullName: "Ja'Marr Chase",
    sleeperId: "7564",
    primaryPositionId: "WR",
    nflTeam: "CIN",
    line: "26.8 pts",
    points: 26.8,
  },
};

/** Design preview for Overview cards. Enable with `?mock=1` on league home. */
export function getLeagueOverviewMock(
  leagueSlug: string,
): LeagueOverviewMockData {
  return {
    leagueSlug,
    standingsRows: MOCK_STANDINGS,
    myTeamId: MY_TEAM_ID,
    highestScorer: MOCK_HIGHEST,
    worstDefense: MOCK_WORST_DEFENSE,
    inefficient: MOCK_INEFFICIENT,
    seasonLeaders: MOCK_SEASON_LEADERS,
    playersOfTheWeek: MOCK_POTW,
    highlightWeek: 7,
  };
}
