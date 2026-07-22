import type { ScheduleGame } from "@/lib/espn/scoreboard";

/** ESPN uses WSH; players/Sleeper often use WAS. */
const TEAM_ALIASES: Record<string, string> = {
  WSH: "WAS",
};

const NFL_TZ = "America/New_York";

export function normalizeNflTeamAbbrev(
  abbreviation: string | null | undefined,
): string | null {
  if (!abbreviation) {
    return null;
  }
  const upper = abbreviation.trim().toUpperCase();
  if (!upper) {
    return null;
  }
  return TEAM_ALIASES[upper] ?? upper;
}

export type TeamMatchup = {
  label: string;
  opponent: string;
  isHome: boolean;
  kickoff: string;
  gameStatus: ScheduleGame["status"];
  /** Secondary Opp line: kickoff time, or live/final score. */
  detailLabel: string | null;
};

export type PlayerOpponent = {
  label: string;
  /** e.g. "Sun 1pm" or "24-17" — null for BYE */
  kickoffLabel: string | null;
  gameStatus: ScheduleGame["status"] | null;
};

/** Compact kickoff for roster Opp cells: "Sun 1pm" (ET). */
export function formatMatchupKickoff(kickoffIso: string): string {
  const date = new Date(kickoffIso);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: NFL_TZ,
    weekday: "short",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: NFL_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  // "1:00 PM" → "1pm"; keep minutes when not :00
  const compact = time
    .replace(/\s/g, "")
    .replace(/:00/i, "")
    .toLowerCase();

  return `${weekday} ${compact}`;
}

/** Kickoff before kickoff; score once the game is live/final. */
function formatMatchupDetail(game: ScheduleGame): string {
  if (
    (game.status === "in" || game.status === "post") &&
    game.away.score != null &&
    game.home.score != null
  ) {
    return `${game.away.score}-${game.home.score}`;
  }
  return formatMatchupKickoff(game.kickoff);
}

/** Map NFL team abbrev → this week's matchup label ("@ BUF" / "vs KC"). */
export function buildOpponentByTeam(
  games: ScheduleGame[],
): Map<string, TeamMatchup> {
  const map = new Map<string, TeamMatchup>();

  for (const game of games) {
    const home = normalizeNflTeamAbbrev(game.home.abbreviation);
    const away = normalizeNflTeamAbbrev(game.away.abbreviation);
    if (!home || !away) {
      continue;
    }

    const detailLabel = formatMatchupDetail(game);

    map.set(home, {
      label: `vs ${away}`,
      opponent: away,
      isHome: true,
      kickoff: game.kickoff,
      gameStatus: game.status,
      detailLabel,
    });
    map.set(away, {
      label: `@ ${home}`,
      opponent: home,
      isHome: false,
      kickoff: game.kickoff,
      gameStatus: game.status,
      detailLabel,
    });
  }

  return map;
}

/** Forthcoming matchup for a player's NFL team this week, or BYE / null. */
export function resolvePlayerOpponent(input: {
  nflTeam: string | null | undefined;
  byeWeek?: number | null;
  week: number;
  opponentsByTeam: Map<string, TeamMatchup>;
}): PlayerOpponent | null {
  const team = normalizeNflTeamAbbrev(input.nflTeam);
  if (!team) {
    return null;
  }

  if (input.byeWeek != null && input.byeWeek === input.week) {
    return { label: "BYE", kickoffLabel: null, gameStatus: null };
  }

  const matchup = input.opponentsByTeam.get(team);
  if (!matchup) {
    return null;
  }

  return {
    label: matchup.label,
    kickoffLabel: matchup.detailLabel,
    gameStatus: matchup.gameStatus,
  };
}
