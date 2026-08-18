import "server-only";

import { and, count, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { cache } from "react";

import { leagueActivity, playerExternalIds, players } from "@/db/schema";
import { db } from "@/lib/db";
import {
  pickStandardTeamOfTheWeek,
  pickStatLeader,
  type DashboardNflPlayer,
  type StandardTotwRow,
} from "@/lib/leagues/dashboard-nfl";
import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import { getDefaultScoringRuleDefinitions } from "@/lib/leagues/scoring/defaults";
import { normalizePlayerStats } from "@/lib/leagues/scoring/normalize-stats";
import { getGameWeekCloseState } from "@/lib/nfl/current-week-board";
import { getPlayerRosterRatesMap } from "@/lib/queries/player-roster-rates";
import { loadScoreRows } from "@/lib/queries/score-rows";

export type DashboardNflData = {
  passing: DashboardNflPlayer | null;
  rushing: DashboardNflPlayer | null;
  receiving: DashboardNflPlayer | null;
  totwWeek: number | null;
  totw: StandardTotwRow[];
  trendingUp: DashboardNflPlayer | null;
  trendingDown: DashboardNflPlayer | null;
};

function formatYards(value: number) {
  return `${Math.round(value).toLocaleString("en-US")} yds`;
}

function emptyDashboardNfl(): DashboardNflData {
  return {
    passing: null,
    rushing: null,
    receiving: null,
    totwWeek: null,
    totw: [],
    trendingUp: null,
    trendingDown: null,
  };
}

async function loadTrendingPlayer(
  types: Array<"player_added" | "waiver_awarded" | "player_dropped">,
  line: (value: number) => string,
): Promise<DashboardNflPlayer | null> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({
      playerId: leagueActivity.playerId,
      total: count(),
    })
    .from(leagueActivity)
    .where(
      and(
        inArray(leagueActivity.type, types),
        gte(leagueActivity.createdAt, since),
        isNotNull(leagueActivity.playerId),
      ),
    )
    .groupBy(leagueActivity.playerId)
    .orderBy(desc(count()))
    .limit(1)
    .catch(() => []);

  if (!row?.playerId || row.total <= 0) return null;

  const [player] = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      primaryPositionId: players.primaryPositionId,
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
    .where(eq(players.id, row.playerId))
    .limit(1)
    .catch(() => []);

  if (!player) return null;

  return {
    id: player.id,
    fullName: player.fullName,
    sleeperId: player.sleeperId,
    primaryPositionId: player.primaryPositionId,
    nflTeam: player.nflTeam,
    value: Number(row.total),
    line: line(Number(row.total)),
  };
}

export const loadDashboardNfl = cache(async (): Promise<DashboardNflData> => {
  const close = await getGameWeekCloseState().catch(() => null);
  if (!close) return emptyDashboardNfl();

  const season = String(close.nflSeason);
  const seasonType = close.seasonType;
  const totwWeek = close.weekFinalized
    ? close.nflWeek
    : Math.max(1, close.nflWeek - 1);
  const scoringRules = getDefaultScoringRuleDefinitions("standard");

  const [seasonRows, weekRows, trendingUp, trendingDown] = await Promise.all([
    loadScoreRows({
      season,
      week: 0,
      kind: "stats",
      seasonType,
    }).catch(() => []),
    loadScoreRows({
      season,
      week: totwWeek,
      kind: "stats",
      seasonType,
    }).catch(() => []),
    loadTrendingPlayer(["player_added", "waiver_awarded"], String),
    loadTrendingPlayer(["player_dropped"], String),
  ]);

  const rates = await getPlayerRosterRatesMap(
    [trendingUp?.id, trendingDown?.id].filter((id): id is string => Boolean(id)),
  ).catch(() => new Map());

  const withOwnedPct = (
    player: DashboardNflPlayer | null,
  ): DashboardNflPlayer | null => {
    if (!player) return null;
    return {
      ...player,
      ownedPct: rates.get(player.id)?.ownedPct ?? null,
    };
  };

  const totwPlayers = weekRows.flatMap((row) => {
    const stats = normalizePlayerStats(row.stats, { fillOmittedZeros: true });
    const points = calculatePlayerPoints(
      stats,
      row.primaryPositionId,
      scoringRules,
    );
    if (points <= 0) return [];
    return [
      {
        id: row.id,
        fullName: row.fullName,
        sleeperId: row.sleeperId,
        primaryPositionId: row.primaryPositionId,
        nflTeam: row.nflTeam,
        points,
      },
    ];
  });

  return {
    passing: pickStatLeader(seasonRows, "pass_yd", formatYards),
    rushing: pickStatLeader(seasonRows, "rush_yd", formatYards),
    receiving: pickStatLeader(seasonRows, "rec_yd", formatYards),
    totwWeek,
    totw: pickStandardTeamOfTheWeek(totwPlayers),
    trendingUp: withOwnedPct(trendingUp),
    trendingDown: withOwnedPct(trendingDown),
  };
});
