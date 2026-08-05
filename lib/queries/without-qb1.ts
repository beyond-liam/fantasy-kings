import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { playerScores, playerExternalIds, players } from "@/db/schema";
import { db } from "@/lib/db";
import { normalizePlayerStats } from "@/lib/leagues/scoring/normalize-stats";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { normalizeNflTeamAbbrev } from "@/lib/nfl/matchups";
import {
  buildTeammateQbCandidates,
  isWithoutQb1Position,
  offenseSnapByWeekFromLogs,
  qbLastName,
  qbPlayedFromStats,
  selectTeamQb1,
  sumWeeklyStatBags,
  withoutQb1ScoredWeeks,
  type QbWeekStatRow,
  type TeamQb1Selection,
} from "@/lib/players/team-qb1";
import { getNflState } from "@/lib/sleeper/api";

export type WithoutQb1Context = {
  qbPlayerId: string;
  qbFullName: string;
  qbLastName: string;
  qbSleeperId: string | null;
  qbNflTeam: string | null;
  /** Weeks QB1 participated on this offense. */
  qbPlayedWeeks: number[];
  /** Player scored weeks without QB1 (may be empty). */
  withoutWeeks: number[];
  source: "depth_chart" | "pass_att";
};

function teamSpellingsFor(team: string): string[] {
  return team === "WAS" ? ["WAS", "WSH"] : [team];
}

async function loadSeasonQbWeekRows(season: string): Promise<QbWeekStatRow[]> {
  const rows = await db
    .select({
      playerId: playerScores.playerId,
      fullName: players.fullName,
      depthChartOrder: players.depthChartOrder,
      week: playerScores.week,
      stats: playerScores.stats,
    })
    .from(playerScores)
    .innerJoin(players, eq(playerScores.playerId, players.id))
    .where(
      and(
        eq(playerScores.season, season),
        eq(playerScores.kind, "stats"),
        eq(playerScores.seasonType, "regular"),
        eq(players.primaryPositionId, "QB"),
        gte(playerScores.week, 1),
        lte(playerScores.week, 18),
      ),
    )
    .orderBy(asc(playerScores.week));

  return rows.map((row) => ({
    playerId: row.playerId,
    fullName: row.fullName,
    depthChartOrder: row.depthChartOrder,
    week: row.week,
    stats: normalizePlayerStats(
      (row.stats ?? {}) as Record<string, number | null>,
    ) as Record<string, number | null>,
  }));
}

/**
 * Kickers (and sparse bags) don't share reliable offense snap counts with the
 * QB. Borrow weekly `tm_off_snp` from the team's highest-usage RB/WR.
 */
async function loadProxyOffenseSnapByWeek(input: {
  nflTeam: string;
  season: string;
  excludePlayerId?: string;
}): Promise<Map<number, number>> {
  const teamSpellings = teamSpellingsFor(input.nflTeam);

  const teammates = await db
    .select({
      id: players.id,
      rushAtt: sql<number>`coalesce((${playerScores.stats}->>'rush_att')::float, 0)`,
      recTgt: sql<number>`coalesce((${playerScores.stats}->>'rec_tgt')::float, 0)`,
    })
    .from(players)
    .innerJoin(playerScores, eq(playerScores.playerId, players.id))
    .where(
      and(
        inArray(players.nflTeam, teamSpellings),
        inArray(players.primaryPositionId, ["RB", "WR"]),
        eq(playerScores.season, input.season),
        eq(playerScores.kind, "stats"),
        eq(playerScores.seasonType, "regular"),
        eq(playerScores.week, 0),
      ),
    );

  const ranked = teammates
    .filter((row) => row.id !== input.excludePlayerId)
    .toSorted((a, b) => b.rushAtt + b.recTgt - (a.rushAtt + a.recTgt));
  const proxyId = ranked[0]?.id;
  if (!proxyId) return new Map();

  const weeks = await db
    .select({
      week: playerScores.week,
      stats: playerScores.stats,
    })
    .from(playerScores)
    .where(
      and(
        eq(playerScores.playerId, proxyId),
        eq(playerScores.season, input.season),
        eq(playerScores.kind, "stats"),
        eq(playerScores.seasonType, "regular"),
        gte(playerScores.week, 1),
        lte(playerScores.week, 18),
      ),
    );

  return offenseSnapByWeekFromLogs(
    weeks.map((row) => ({
      week: row.week,
      stats: normalizePlayerStats(
        (row.stats ?? {}) as Record<string, number | null>,
      ) as Record<string, number | null>,
    })),
  );
}

/** Live / preseason: QB1 from current team depth chart (order 1). */
async function loadDepthChartQb1(
  nflTeam: string,
): Promise<TeamQb1Selection | null> {
  const rows = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      depthChartOrder: players.depthChartOrder,
    })
    .from(players)
    .where(
      and(
        eq(players.primaryPositionId, "QB"),
        inArray(players.nflTeam, teamSpellingsFor(nflTeam)),
      ),
    );

  const starters = rows.filter((row) => row.depthChartOrder === 1);
  const pool =
    starters.length > 0
      ? starters
      : rows.filter((row) => row.depthChartOrder != null);
  if (pool.length === 0) return null;

  const qb = pool.toSorted(
    (a, b) =>
      (a.depthChartOrder ?? 99) - (b.depthChartOrder ?? 99) ||
      a.fullName.localeCompare(b.fullName),
  )[0]!;

  return {
    playerId: qb.id,
    fullName: qb.fullName,
    lastName: qbLastName(qb.fullName),
    playedWeeks: [],
    source: "depth_chart",
  };
}

/**
 * Resolve season QB1 for the viewed player's offense + weeks they scored
 * without that QB. Returns for every RB/WR/TE/K when a QB1 can be resolved.
 *
 * When the season has no weekly sample yet (e.g. 2026 preseason), falls back
 * to the live team depth-chart QB1 so the toggle can still show (disabled at 0g).
 */
export async function loadWithoutQb1Context(input: {
  playerId?: string;
  nflTeam: string | null | undefined;
  season: string;
  positionId: string;
  playerGameLog: Array<{
    week: number;
    fantasyPts: number | null;
    stats?: Record<string, number | null>;
  }>;
}): Promise<WithoutQb1Context | null> {
  if (!isWithoutQb1Position(input.positionId)) return null;

  const team = normalizeNflTeamAbbrev(input.nflTeam);
  const nflState = await getNflState().catch(() => null);
  const isLiveSeason =
    nflState != null && String(nflState.season) === String(input.season);

  let offenseSnapByWeek = offenseSnapByWeekFromLogs(input.playerGameLog);

  /** Kickers' tm_off_snp doesn't track the offense; always use a skill proxy. */
  const needsProxy =
    input.positionId === "K" || offenseSnapByWeek.size === 0;

  if (needsProxy && team) {
    const proxy = await loadProxyOffenseSnapByWeek({
      nflTeam: team,
      season: input.season,
      excludePlayerId: input.playerId,
    });
    if (proxy.size > 0) {
      offenseSnapByWeek = proxy;
    }
  }

  let qb1: TeamQb1Selection | null = null;
  let qbWeeks: QbWeekStatRow[] = [];

  if (offenseSnapByWeek.size > 0) {
    qbWeeks = await loadSeasonQbWeekRows(input.season);
    const candidates = buildTeammateQbCandidates({
      offenseSnapByWeek,
      qbWeeks,
    });
    if (candidates.length > 0) {
      // Season sample wins over live depth tags (which can be wrong mid-rebuild).
      qb1 = selectTeamQb1(candidates, { preferDepthChart: false });
    }
  }

  if (!qb1 && isLiveSeason && team) {
    qb1 = await loadDepthChartQb1(team);
  }

  if (!qb1) return null;

  /**
   * Snap matching identifies who QB1 was. Missed weeks use raw pass attempts:
   * a bye (no player score) never counts, and weeks the QB threw still count
   * even if tm_off_snp is missing (e.g. week 18 stubs).
   */
  if (qbWeeks.length === 0) {
    qbWeeks = await loadSeasonQbWeekRows(input.season);
  }
  const qbPlayedWeeks = [
    ...new Set(
      qbWeeks
        .filter(
          (row) =>
            row.playerId === qb1.playerId && qbPlayedFromStats(row.stats),
        )
        .map((row) => row.week),
    ),
  ].toSorted((a, b) => a - b);

  const playerScoredWeeks = input.playerGameLog
    .filter((row) => row.fantasyPts != null && Number.isFinite(row.fantasyPts))
    .map((row) => row.week);

  const withoutWeeks = withoutQb1ScoredWeeks(
    playerScoredWeeks,
    qbPlayedWeeks,
  );

  const [qbMeta] = await db
    .select({
      nflTeam: players.nflTeam,
      sleeperId: playerExternalIds.externalId,
    })
    .from(players)
    .leftJoin(
      playerExternalIds,
      and(
        eq(playerExternalIds.playerId, players.id),
        eq(playerExternalIds.provider, "sleeper"),
      ),
    )
    .where(eq(players.id, qb1.playerId))
    .limit(1);

  return {
    qbPlayerId: qb1.playerId,
    qbFullName: qb1.fullName,
    qbLastName: qb1.lastName,
    qbSleeperId: qbMeta?.sleeperId ?? null,
    qbNflTeam: qbMeta?.nflTeam ?? null,
    qbPlayedWeeks,
    withoutWeeks,
    source: qb1.source,
  };
}

/** Build seasonStats bag from weekly rows in `withoutWeeks`. */
export function seasonStatsWithoutWeeks(input: {
  gameLog: Array<{
    week: number;
    fantasyPts: number | null;
    stats?: Record<string, number | null>;
  }>;
  withoutWeeks: number[];
  /** Kept for call-site compatibility; fantasy pts are summed from weekly scores. */
  positionId: string;
  rules: ScoringRuleDefinition[];
}): {
  fantasyPts: number | null;
  stats: Record<string, number | null>;
} | null {
  void input.positionId;
  void input.rules;
  const weekSet = new Set(input.withoutWeeks);
  const rows = input.gameLog.filter(
    (row) =>
      weekSet.has(row.week) &&
      row.fantasyPts != null &&
      Number.isFinite(row.fantasyPts),
  );
  if (rows.length === 0) return null;

  const stats = sumWeeklyStatBags(rows.map((r) => r.stats));
  stats.gp = rows.length;
  /** Sum weekly scores — never re-score the aggregated bag (thresholds are per-game). */
  const fantasyPts =
    Math.round(
      rows.reduce((sum, row) => sum + (row.fantasyPts ?? 0), 0) * 100,
    ) / 100;
  return { fantasyPts, stats };
}
