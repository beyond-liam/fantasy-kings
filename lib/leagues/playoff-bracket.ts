import {
  getFirstRoundByes,
  getPlayoffWeekRange,
  type PlayoffCalendarOptions,
} from "@/lib/leagues/season-calendar";

export type BracketTeam = {
  seed: number;
  teamId: string | null;
  teamPublicId: string | null;
  teamName: string;
  logoUrl: string | null;
  /** Actual matchup points when scored; null before/during. */
  score?: number | null;
  /** Projected points for the matchup week. */
  projection?: number | null;
};

export type BracketSlot =
  | { type: "team"; team: BracketTeam }
  | { type: "tbd"; label: string }
  | { type: "bye"; team: BracketTeam };

export type BracketMatchup = {
  id: string;
  top: BracketSlot;
  bottom: BracketSlot;
};

export type BracketRound = {
  id: string;
  name: string;
  weekLabel: string;
  matchups: BracketMatchup[];
};

export type PlayoffBracket = {
  rounds: BracketRound[];
  playoffTeamCount: number;
  firstRoundByes: number;
  championshipWeekLabel: string;
};

function teamSlot(team: BracketTeam): BracketSlot {
  return { type: "team", team };
}

function byeSlot(team: BracketTeam): BracketSlot {
  return { type: "bye", team };
}

function tbd(label = "TBD"): BracketSlot {
  return { type: "tbd", label };
}

function bySeed(teams: BracketTeam[]): Map<number, BracketTeam> {
  return new Map(teams.map((team) => [team.seed, team]));
}

function requireSeed(map: Map<number, BracketTeam>, seed: number): BracketTeam {
  const team = map.get(seed);
  if (team) {
    return team;
  }
  return {
    seed,
    teamId: null,
    teamPublicId: null,
    teamName: `Seed ${seed}`,
    logoUrl: null,
  };
}

function weekLabels(
  championshipWeek: number,
  playoffTeamCount: number,
  options: PlayoffCalendarOptions,
): string[] {
  const range = getPlayoffWeekRange(
    championshipWeek,
    playoffTeamCount,
    options,
  );
  if (!range) {
    return [];
  }
  const labels: string[] = [];
  for (let week = range.startWeek; week <= range.endWeek; week++) {
    labels.push(`Week ${week}`);
  }
  return labels;
}

/** Build the projected bracket from current seeds (no results yet). */
export function buildPlayoffBracket(input: {
  teams: BracketTeam[];
  playoffTeamCount: number;
  championshipWeek: number;
  twoWeekChampionship?: boolean;
  enabled?: boolean;
}): PlayoffBracket | null {
  if (input.enabled === false) {
    return null;
  }

  const playoffTeamCount = input.playoffTeamCount;
  if (![4, 6, 8].includes(playoffTeamCount)) {
    return null;
  }

  const options: PlayoffCalendarOptions = {
    enabled: true,
    twoWeekChampionship: Boolean(input.twoWeekChampionship),
  };
  const labels = weekLabels(
    input.championshipWeek,
    playoffTeamCount,
    options,
  );
  if (labels.length === 0) {
    return null;
  }

  const seeded = [...input.teams]
    .filter((team) => team.seed >= 1 && team.seed <= playoffTeamCount)
    .sort((a, b) => a.seed - b.seed);
  const map = bySeed(seeded);
  const firstRoundByes = getFirstRoundByes(playoffTeamCount);

  const rounds: BracketRound[] = [];

  if (playoffTeamCount === 4) {
    rounds.push({
      id: "semifinals",
      name: "Semifinals",
      weekLabel: labels[0]!,
      matchups: [
        {
          id: "sf-1",
          top: teamSlot(requireSeed(map, 1)),
          bottom: teamSlot(requireSeed(map, 4)),
        },
        {
          id: "sf-2",
          top: teamSlot(requireSeed(map, 2)),
          bottom: teamSlot(requireSeed(map, 3)),
        },
      ],
    });
  } else if (playoffTeamCount === 6) {
    rounds.push({
      id: "quarterfinals",
      name: "Quarterfinals",
      weekLabel: labels[0]!,
      matchups: [
        {
          id: "qf-1",
          top: teamSlot(requireSeed(map, 3)),
          bottom: teamSlot(requireSeed(map, 6)),
        },
        {
          id: "qf-2",
          top: teamSlot(requireSeed(map, 4)),
          bottom: teamSlot(requireSeed(map, 5)),
        },
      ],
    });
    rounds.push({
      id: "semifinals",
      name: "Semifinals",
      weekLabel: labels[1]!,
      matchups: [
        {
          id: "sf-1",
          top: byeSlot(requireSeed(map, 1)),
          bottom: tbd("Winner QF"),
        },
        {
          id: "sf-2",
          top: byeSlot(requireSeed(map, 2)),
          bottom: tbd("Winner QF"),
        },
      ],
    });
  } else {
    // 8 teams
    rounds.push({
      id: "quarterfinals",
      name: "Quarterfinals",
      weekLabel: labels[0]!,
      matchups: [
        {
          id: "qf-1",
          top: teamSlot(requireSeed(map, 1)),
          bottom: teamSlot(requireSeed(map, 8)),
        },
        {
          id: "qf-2",
          top: teamSlot(requireSeed(map, 4)),
          bottom: teamSlot(requireSeed(map, 5)),
        },
        {
          id: "qf-3",
          top: teamSlot(requireSeed(map, 2)),
          bottom: teamSlot(requireSeed(map, 7)),
        },
        {
          id: "qf-4",
          top: teamSlot(requireSeed(map, 3)),
          bottom: teamSlot(requireSeed(map, 6)),
        },
      ],
    });
    rounds.push({
      id: "semifinals",
      name: "Semifinals",
      weekLabel: labels[1]!,
      matchups: [
        {
          id: "sf-1",
          top: tbd("Winner QF"),
          bottom: tbd("Winner QF"),
        },
        {
          id: "sf-2",
          top: tbd("Winner QF"),
          bottom: tbd("Winner QF"),
        },
      ],
    });
  }

  const champStartIndex = rounds.length;
  rounds.push({
    id: "championship",
    name: input.twoWeekChampionship
      ? "Championship · Game 1"
      : "Championship",
    weekLabel: labels[champStartIndex]!,
    matchups: [
      {
        id: "champ-1",
        top: tbd("Winner SF"),
        bottom: tbd("Winner SF"),
      },
    ],
  });

  if (input.twoWeekChampionship && labels[champStartIndex + 1]) {
    rounds.push({
      id: "championship-g2",
      name: "Championship · Game 2",
      weekLabel: labels[champStartIndex + 1]!,
      matchups: [
        {
          id: "champ-2",
          top: tbd("Game 1 home"),
          bottom: tbd("Game 1 away"),
        },
      ],
    });
  }

  return {
    rounds,
    playoffTeamCount,
    firstRoundByes,
    championshipWeekLabel: labels[labels.length - 1]!,
  };
}

export function bracketTeamsFromStandings(
  rows: Array<{
    seed: number;
    teamId: string | null;
    teamPublicId: string | null;
    teamName: string;
    logoUrl: string | null;
    claimed: boolean;
  }>,
  playoffTeamCount: number,
): BracketTeam[] {
  return rows
    .filter((row) => row.seed >= 1 && row.seed <= playoffTeamCount)
    .map((row) => ({
      seed: row.seed,
      teamId: row.teamId,
      teamPublicId: row.teamPublicId,
      teamName: row.claimed ? row.teamName : `Seed ${row.seed}`,
      logoUrl: row.claimed ? row.logoUrl : null,
    }));
}
