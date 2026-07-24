import type { GameTiebreakerId } from "@/db/schema/league-seasons";

export type TeamGameTieMetrics = {
  /** Starter offensive + special teams TDs (pass/rush/rec/fum_rec + ST). */
  offensiveSpecialTds: number;
  highestStarterPts: number;
  benchPts: number;
};

const PTS_EPS = 0.05;

function num(stats: Record<string, unknown>, key: string): number {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Sum offensive + special-teams TDs from a player_scores stats blob. */
export function offensiveSpecialTdsFromStats(
  stats: Record<string, unknown> | null | undefined,
): number {
  if (!stats) return 0;
  return (
    num(stats, "pass_td") +
    num(stats, "rush_td") +
    num(stats, "rec_td") +
    num(stats, "fum_rec_td") +
    num(stats, "st_td") +
    num(stats, "kr_td") +
    num(stats, "pr_td")
  );
}

export function emptyTeamGameTieMetrics(): TeamGameTieMetrics {
  return {
    offensiveSpecialTds: 0,
    highestStarterPts: 0,
    benchPts: 0,
  };
}

export function accumulatePlayerIntoMetrics(
  metrics: TeamGameTieMetrics,
  input: {
    isStarter: boolean;
    fantasyPts: number;
    stats?: Record<string, unknown> | null;
  },
): void {
  const pts = Number.isFinite(input.fantasyPts) ? input.fantasyPts : 0;
  if (input.isStarter) {
    metrics.offensiveSpecialTds += offensiveSpecialTdsFromStats(input.stats);
    if (pts > metrics.highestStarterPts) {
      metrics.highestStarterPts = pts;
    }
  } else {
    metrics.benchPts += pts;
  }
}

function metricValue(
  metrics: TeamGameTieMetrics,
  id: GameTiebreakerId,
): number {
  switch (id) {
    case "offensive_special_tds":
      return metrics.offensiveSpecialTds;
    case "highest_starter":
      return metrics.highestStarterPts;
    case "bench_points":
      return metrics.benchPts;
    default:
      return 0;
  }
}

/**
 * When fantasy points are tied, walk ordered game tiebreakers.
 * Returns home team id, away team id, or null if still tied (caller uses seed).
 */
export function resolveGameTiebreakerWinner(input: {
  homeTeamId: string;
  awayTeamId: string;
  home: TeamGameTieMetrics;
  away: TeamGameTieMetrics;
  order: GameTiebreakerId[];
}): string | null {
  for (const id of input.order) {
    const homeVal = metricValue(input.home, id);
    const awayVal = metricValue(input.away, id);
    if (Math.abs(homeVal - awayVal) <= PTS_EPS) continue;
    return homeVal > awayVal ? input.homeTeamId : input.awayTeamId;
  }
  return null;
}
