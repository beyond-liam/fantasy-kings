import type { ScheduleGame } from "@/lib/espn/scoreboard";
import { UK_TIME_ZONE } from "@/lib/datetime/uk-time";
import { resolvePlayerByeWeek } from "@/lib/nfl/bye-weeks";

/** ESPN uses WSH; players/Sleeper often use WAS. */
const TEAM_ALIASES: Record<string, string> = {
  WSH: "WAS",
};

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
  /** Secondary Opp line: kickoff time, live down/distance, or final score. */
  detailLabel: string | null;
  hasPossession: boolean;
  inRedZone: boolean;
};

export type PlayerOpponent = {
  label: string;
  /** e.g. "Sun 1pm" or "24-17" — null for BYE */
  kickoffLabel: string | null;
  gameStatus: ScheduleGame["status"] | null;
  hasPossession: boolean;
  inRedZone: boolean;
};

function idleOpponent(label: string): PlayerOpponent {
  return {
    label,
    kickoffLabel: null,
    gameStatus: null,
    hasPossession: false,
    inRedZone: false,
  };
}

/** Compact kickoff for roster Opp cells: "Sun 1pm" (UK). */
export function formatMatchupKickoff(kickoffIso: string): string {
  const date = new Date(kickoffIso);
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    weekday: "short",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  // "1:00 pm" → "1pm"; keep minutes when not :00
  const compact = time
    .replace(/\s/g, "")
    .replace(/:00/i, "")
    .toLowerCase();

  return `${weekday} ${compact}`;
}

/** Kickoff before kickoff; score once the game is live/final. */
function formatLiveClock(game: ScheduleGame): string | null {
  if (game.status !== "in") return null;
  const named = game.statusText?.trim() || "";
  if (/halftime|end of|two.?minute/i.test(named)) return named;
  const clock = game.displayClock?.trim() || null;
  const period = game.period;
  if (period == null || !Number.isFinite(period) || period < 1) {
    return clock ?? (named || null);
  }
  const quarter =
    period <= 4 ? `Q${period}` : period === 5 ? "OT" : `OT${period - 4}`;
  return clock ? `${quarter} ${clock}` : quarter;
}

function formatMatchupDetail(game: ScheduleGame): string {
  if (game.status === "in") {
    const down = game.situation?.downDistance?.split(" • ")[0] ?? null;
    const live = [down, formatLiveClock(game)].filter(Boolean).join(" · ");
    return live || formatMatchupKickoff(game.kickoff);
  }
  if (
    game.status === "post" &&
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
    const live = game.status === "in";
    const redZone = live && game.situation?.isRedZone === true;
    const homeHasBall = live && game.possession === "home";
    const awayHasBall = live && game.possession === "away";

    map.set(home, {
      label: `vs ${away}`,
      opponent: away,
      isHome: true,
      kickoff: game.kickoff,
      gameStatus: game.status,
      detailLabel,
      hasPossession: homeHasBall,
      inRedZone: redZone,
    });
    map.set(away, {
      label: `@ ${home}`,
      opponent: home,
      isHome: false,
      kickoff: game.kickoff,
      gameStatus: game.status,
      detailLabel,
      hasPossession: awayHasBall,
      inRedZone: redZone,
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
  seasonYear?: number;
  /** Bye only applies in the regular season. */
  seasonType?: "pre" | "regular" | "post";
}): PlayerOpponent | null {
  const team = normalizeNflTeamAbbrev(input.nflTeam);
  if (!team) {
    return null;
  }

  const byeWeek = resolvePlayerByeWeek({
    byeWeek: input.byeWeek,
    nflTeam: team,
    seasonYear: input.seasonYear,
  });

  if (
    input.seasonType !== "pre" &&
    byeWeek != null &&
    byeWeek === input.week
  ) {
    return idleOpponent("BYE");
  }

  const matchup = input.opponentsByTeam.get(team);
  if (!matchup) {
    // Slate loaded but this team has no game → bye (covers null/stale player byeWeek).
    if (input.opponentsByTeam.size > 0) {
      return idleOpponent("BYE");
    }
    return null;
  }

  return {
    label: matchup.label,
    kickoffLabel: matchup.detailLabel,
    gameStatus: matchup.gameStatus,
    hasPossession: matchup.hasPossession,
    inRedZone: matchup.inRedZone,
  };
}
