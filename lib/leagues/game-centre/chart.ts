import type { ScheduleGame } from "@/lib/espn/scoreboard";
import { normalizeNflTeamAbbrev } from "@/lib/nfl/matchups";

export type ScoreChartPoint = {
  /** ISO kickoff used as x key */
  at: string;
  label: string;
  away: number;
  home: number;
};

type ChartStarter = {
  nflTeam: string | null;
  actualPts: number | null;
  kickoff: string | null;
  gameStatus: ScheduleGame["status"] | null;
};

function kickoffMs(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function playerCountsAt(
  player: ChartStarter,
  atMs: number,
  nowMs: number,
): number {
  const ko = kickoffMs(player.kickoff);
  if (ko == null) return 0;
  if (ko > atMs) return 0;

  const started =
    player.gameStatus === "in" ||
    player.gameStatus === "post" ||
    ko <= nowMs;
  if (!started) return 0;
  return player.actualPts ?? 0;
}

function formatChartTick(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Cumulative actual fantasy points after each unique starter kickoff.
 */
export function buildScoreChartSeries(input: {
  awayStarters: ChartStarter[];
  homeStarters: ChartStarter[];
  now?: Date;
}): ScoreChartPoint[] {
  const nowMs = (input.now ?? new Date()).getTime();
  const kickoffs = new Set<string>();

  for (const player of [...input.awayStarters, ...input.homeStarters]) {
    if (player.kickoff) kickoffs.add(player.kickoff);
  }

  const sorted = [...kickoffs].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );

  if (sorted.length === 0) {
    return [];
  }

  return sorted.map((at) => {
    const atMs = new Date(at).getTime();
    const away = input.awayStarters.reduce(
      (sum, player) => sum + playerCountsAt(player, atMs, nowMs),
      0,
    );
    const home = input.homeStarters.reduce(
      (sum, player) => sum + playerCountsAt(player, atMs, nowMs),
      0,
    );
    return {
      at,
      label: formatChartTick(at),
      away: Math.round(away * 100) / 100,
      home: Math.round(home * 100) / 100,
    };
  });
}

/** Kickoff ISO for an NFL team from the week's scoreboard games. */
export function kickoffForNflTeam(
  nflTeam: string | null | undefined,
  games: ScheduleGame[],
): string | null {
  const abbrev = normalizeNflTeamAbbrev(nflTeam);
  if (!abbrev) return null;
  for (const game of games) {
    const home = normalizeNflTeamAbbrev(game.home.abbreviation);
    const away = normalizeNflTeamAbbrev(game.away.abbreviation);
    if (home === abbrev || away === abbrev) {
      return game.kickoff;
    }
  }
  return null;
}
