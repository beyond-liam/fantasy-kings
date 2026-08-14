import { and, asc, eq, gte, inArray } from "drizzle-orm";

import { playerScores, players } from "@/db/schema";
import { getNflTeamSchedule, type NflTeamScheduleWeek } from "@/lib/espn/team-schedule";
import { db } from "@/lib/db";
import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import { normalizePlayerStats } from "@/lib/leagues/scoring/normalize-stats";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import {
  defaultLeagueSeasonCalendar,
  resolveLeagueSeasonMaxWeek,
} from "@/lib/leagues/season-calendar";
import { NFL_TEAMS } from "@/lib/nfl/teams";
import { normalizeNflTeamAbbrev } from "@/lib/nfl/matchups";
import { resolvePlayerByeWeek } from "@/lib/nfl/bye-weeks";
import {
  buildScoringConsistency,
  parseOpponentMeta,
  positionStartableThreshold,
  type OverviewExtrasSeed,
  type OverviewMultiYearRow,
  type OverviewRosterCompareSeedRow,
} from "@/lib/players/overview-metrics";
import {
  blendSosRate,
  difficultyFromPositionSosRank,
  rankTeamsBySosRate,
  sosBlendWeights,
  sosHigherRateIsHarder,
  sosTopNForPosition,
  sosWeeklyAllowedRate,
} from "@/lib/players/sos-thresholds";
import { buildTeamOpportunityShare } from "@/lib/players/team-opportunity-share";
import type { PlayerProfileGameLogRow } from "@/lib/queries/player-profile";
import { getTeamRosterPlayers } from "@/lib/queries/team-roster";
import { loadScoreRows } from "@/lib/queries/score-rows";
import { buildFantasyPositionRankById } from "@/lib/rankings/attach-position-ranks";
import { getNflState } from "@/lib/sleeper/api";

function numStat(
  bag: Record<string, number | null> | null | undefined,
  key: string,
): number | null {
  const value = bag?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

function pickPositionRank(
  stats: Record<string, number | null>,
): number | null {
  const rank =
    stats.pos_rank_ppr ??
    stats.pos_rank_std ??
    stats.pos_adp_dd_ppr ??
    stats.pos_rank_half_ppr;
  if (rank == null || !Number.isFinite(rank) || rank <= 0 || rank >= 999) {
    return null;
  }
  return Math.round(rank);
}

function defaultLeagueCalendar(): {
  regularSeasonEndWeek: number;
  playoffWeeks: number[];
} {
  const calendar = defaultLeagueSeasonCalendar();
  return {
    regularSeasonEndWeek: calendar.regularSeasonEndWeek,
    playoffWeeks: calendar.playoffWeeks,
  };
}

async function loadTeamWeekZeroBags(input: {
  nflTeam: string;
  season: string;
}): Promise<Array<Record<string, number | null>>> {
  const rows = await db
    .select({ stats: playerScores.stats })
    .from(playerScores)
    .innerJoin(players, eq(playerScores.playerId, players.id))
    .where(
      and(
        eq(players.nflTeam, input.nflTeam),
        eq(playerScores.season, input.season),
        eq(playerScores.week, 0),
        eq(playerScores.kind, "stats"),
        eq(playerScores.seasonType, "regular"),
      ),
    );

  return rows.map(
    (row) =>
      normalizePlayerStats(
        (row.stats ?? {}) as Record<string, number | null>,
      ) as Record<string, number | null>,
  );
}

async function loadOpportunityShare(input: {
  positionId: string;
  nflTeam: string | null;
  season: string;
  playerStats: Record<string, number | null> | null | undefined;
}): Promise<OverviewExtrasSeed["share"]> {
  const team = normalizeNflTeamAbbrev(input.nflTeam);
  if (!team || !input.playerStats) return null;

  const teamBags = await loadTeamWeekZeroBags({
    nflTeam: team,
    season: input.season,
  });
  return buildTeamOpportunityShare({
    positionId: input.positionId,
    playerStats: input.playerStats,
    teamStatsBags: teamBags,
  });
}

/** Team opportunity bags for specific weeks (all teammates, those weeks only). */
async function loadTeamWeekBagsForWeeks(input: {
  nflTeam: string;
  season: string;
  weeks: number[];
}): Promise<Array<Record<string, number | null>>> {
  if (input.weeks.length === 0) return [];

  const rows = await db
    .select({ stats: playerScores.stats })
    .from(playerScores)
    .innerJoin(players, eq(playerScores.playerId, players.id))
    .where(
      and(
        eq(players.nflTeam, input.nflTeam),
        eq(playerScores.season, input.season),
        inArray(playerScores.week, input.weeks),
        eq(playerScores.kind, "stats"),
        eq(playerScores.seasonType, "regular"),
      ),
    );

  return rows.map(
    (row) =>
      normalizePlayerStats(
        (row.stats ?? {}) as Record<string, number | null>,
      ) as Record<string, number | null>,
  );
}

/**
 * Opportunity share for a subset of weeks (e.g. without-QB1 sample).
 * Player bag should already be summed for those weeks.
 */
export async function loadOpportunityShareForWeeks(input: {
  positionId: string;
  nflTeam: string | null;
  season: string;
  weeks: number[];
  playerStats: Record<string, number | null> | null | undefined;
}): Promise<OverviewExtrasSeed["share"]> {
  const team = normalizeNflTeamAbbrev(input.nflTeam);
  if (!team || !input.playerStats || input.weeks.length === 0) return null;

  const teamBags = await loadTeamWeekBagsForWeeks({
    nflTeam: team,
    season: input.season,
    weeks: input.weeks,
  });
  return buildTeamOpportunityShare({
    positionId: input.positionId,
    playerStats: input.playerStats,
    teamStatsBags: teamBags,
  });
}

async function loadMultiYear(input: {
  playerId: string;
  positionId: string;
  seasons: string[];
  rules: ScoringRuleDefinition[];
}): Promise<OverviewMultiYearRow[]> {
  if (input.seasons.length === 0) return [];

  const rows = await db
    .select({
      season: playerScores.season,
      week: playerScores.week,
      stats: playerScores.stats,
    })
    .from(playerScores)
    .where(
      and(
        eq(playerScores.playerId, input.playerId),
        eq(playerScores.kind, "stats"),
        eq(playerScores.seasonType, "regular"),
        inArray(playerScores.season, input.seasons),
        gte(playerScores.week, 0),
      ),
    )
    .orderBy(asc(playerScores.season), asc(playerScores.week));

  const bySeason = new Map<
    string,
    {
      week0: Record<string, number | null> | null;
      weeklyPts: number[];
    }
  >();

  for (const season of input.seasons) {
    bySeason.set(season, { week0: null, weeklyPts: [] });
  }

  for (const row of rows) {
    const bucket = bySeason.get(row.season);
    if (!bucket) continue;
    const stats = normalizePlayerStats(
      (row.stats ?? {}) as Record<string, number | null>,
    ) as Record<string, number | null>;
    if (row.week === 0) {
      bucket.week0 = stats;
      continue;
    }
    if (row.week >= 1 && row.week <= 18) {
      const pts = calculatePlayerPoints(stats, input.positionId, input.rules);
      if (pts != null && Number.isFinite(pts)) {
        bucket.weeklyPts.push(pts);
      }
    }
  }

  const result: OverviewMultiYearRow[] = [];
  for (const season of [...input.seasons].toSorted(
    (a, b) => Number(b) - Number(a),
  )) {
    const bucket = bySeason.get(season);
    if (!bucket) continue;
    const games =
      bucket.weeklyPts.length > 0
        ? bucket.weeklyPts.length
        : Math.round(numStat(bucket.week0, "gp") ?? 0);
    if (games <= 0) continue;

    const totalPts =
      bucket.weeklyPts.length > 0
        ? bucket.weeklyPts.reduce((a, b) => a + b, 0)
        : calculatePlayerPoints(
            bucket.week0 ?? {},
            input.positionId,
            input.rules,
          ) ?? 0;

    result.push({
      season,
      games,
      fptsPerGame: totalPts / games,
      positionRank: bucket.week0 ? pickPositionRank(bucket.week0) : null,
    });
  }

  return result;
}

function buildOpponentByTeamWeek(
  schedules: Array<{ team: string; weeks: NflTeamScheduleWeek[] }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const { team, weeks } of schedules) {
    for (const week of weeks) {
      const meta = parseOpponentMeta(week.opponent);
      if (meta.isBye || !meta.abbrev) continue;
      map.set(`${team}|${week.week}`, meta.abbrev);
    }
  }
  return map;
}

function avgPtsAllowedByTeam(
  weeklyTotalsByTeam: Map<string, number[]>,
): Map<string, number> {
  const avgByTeam = new Map<string, number>();
  for (const [team, weeks] of weeklyTotalsByTeam) {
    if (weeks.length === 0) continue;
    avgByTeam.set(
      team,
      weeks.reduce((sum, n) => sum + n, 0) / weeks.length,
    );
  }
  return avgByTeam;
}

function maxScoredWeek(
  weekTotalsByTeam: Map<string, Map<number, number>>,
): number {
  let max = 0;
  for (const byWeek of weekTotalsByTeam.values()) {
    for (const week of byWeek.keys()) {
      if (week > max) max = week;
    }
  }
  return max;
}

/**
 * Collapse per-player scores vs a defense into a top-scorer weekly allowed rate.
 * Defense → week → rate (near typical starter FPTS/G).
 */
function collapseScoresToWeeklyAllowedRate(
  scoresByTeamWeek: Map<string, Map<number, number[]>>,
  positionId: string,
): Map<string, Map<number, number>> {
  const topN = sosTopNForPosition(positionId);
  const weekRatesByTeam = new Map<string, Map<number, number>>();
  for (const [team, byWeek] of scoresByTeamWeek) {
    const rates = new Map<number, number>();
    for (const [week, scores] of byWeek) {
      const rate = sosWeeklyAllowedRate(scores, topN);
      if (rate != null) rates.set(week, rate);
    }
    if (rates.size > 0) weekRatesByTeam.set(team, rates);
  }
  return weekRatesByTeam;
}

/** Append a weekly rate sample to offense/defense → week → scores[]. */
function pushAllowedScore(
  scoresByTeamWeek: Map<string, Map<number, number[]>>,
  defense: string,
  week: number,
  fantasyPts: number,
) {
  const byWeek = scoresByTeamWeek.get(defense) ?? new Map<number, number[]>();
  const list = byWeek.get(week) ?? [];
  list.push(fantasyPts);
  byWeek.set(week, list);
  scoresByTeamWeek.set(defense, byWeek);
}

/**
 * Skill positions: top fantasy scorer vs that defense.
 * DEF: NFL points the offense scored (pts_allow on the facing DEF bag).
 */
function sosWeekRateFromRow(input: {
  positionId: string;
  fantasyPts: number | null;
  stats: Record<string, number | null>;
}): number | null {
  if (input.positionId === "DEF") {
    const ptsAllow = numStat(input.stats, "pts_allow");
    return ptsAllow != null && Number.isFinite(ptsAllow) ? ptsAllow : null;
  }
  return input.fantasyPts != null && Number.isFinite(input.fantasyPts)
    ? input.fantasyPts
    : null;
}

/**
 * Load per-opponent weekly SoS rates for a position.
 * Bye weeks are excluded (no opponent → week omitted from sample).
 */
async function loadPtsAllowedWeekTotals(input: {
  season: string;
  positionId: string;
  rules: ScoringRuleDefinition[];
}): Promise<Map<string, Map<number, number>>> {
  const scheduleResults = await Promise.all(
    NFL_TEAMS.map(async (team) => ({
      team,
      weeks: await getNflTeamSchedule({
        nflTeam: team,
        season: input.season,
      }),
    })),
  );
  const opponentByTeamWeek = buildOpponentByTeamWeek(scheduleResults);

  const weekNumbers = Array.from({ length: 18 }, (_, i) => i + 1);
  const weekRows = await Promise.all(
    weekNumbers.map((week) =>
      loadScoreRows({
        season: input.season,
        week,
        kind: "stats",
        position: input.positionId,
      }),
    ),
  );

  const weekScoresByTeam = new Map<string, Map<number, number[]>>();

  weekNumbers.forEach((week, index) => {
    const rows = weekRows[index] ?? [];
    if (rows.length === 0) return;

    for (const row of rows) {
      const fantasyPts = calculatePlayerPoints(
        row.stats,
        row.primaryPositionId,
        input.rules,
      );
      const rate = sosWeekRateFromRow({
        positionId: input.positionId,
        fantasyPts,
        stats: row.stats,
      });
      if (rate == null) continue;
      const team = normalizeNflTeamAbbrev(row.nflTeam);
      if (!team) continue;
      const opponent = opponentByTeamWeek.get(`${team}|${week}`);
      // No opponent = bye (or missing schedule) — exclude from sample.
      if (!opponent) continue;
      pushAllowedScore(weekScoresByTeam, opponent, week, rate);
    }
  });

  return collapseScoresToWeeklyAllowedRate(weekScoresByTeam, input.positionId);
}

async function loadWeeklyFinishesAndSos(input: {
  playerId: string;
  positionId: string;
  season: string;
  schedule: NflTeamScheduleWeek[];
  rules: ScoringRuleDefinition[];
  /** Inclusive last league week (championship). */
  seasonMaxWeek: number;
}): Promise<{
  weeklyFinishesByWeek: Record<number, number>;
  /** Max week that had any ingested position score rows. */
  scoresThroughWeek: number;
  matchupDifficultyByWeek: Record<number, "easy" | "mid" | "hard">;
  matchupRanksByWeek: Record<number, number>;
  ptsAllowedByWeek: Record<number, number>;
  /** Rank / avg by opposing team for roster-mate SOS. */
  sosByTeam: {
    rankByTeam: Map<string, number>;
    avgByTeam: Map<string, number>;
  };
  /** Per-player finishes for roster mates at this position. */
  finishesByPlayerWeek: Map<string, Record<number, number>>;
}> {
  const maxWeek = Math.max(1, Math.min(18, input.seasonMaxWeek));
  const weekNumbers = Array.from({ length: maxWeek }, (_, i) => i + 1);
  const [nflState, scheduleResults, weekRows] = await Promise.all([
    getNflState().catch(() => null),
    Promise.all(
      NFL_TEAMS.map(async (team) => ({
        team,
        weeks: await getNflTeamSchedule({
          nflTeam: team,
          season: input.season,
        }),
      })),
    ),
    Promise.all(
      weekNumbers.map((week) =>
        loadScoreRows({
          season: input.season,
          week,
          kind: "stats",
          position: input.positionId,
        }),
      ),
    ),
  ]);

  const opponentByTeamWeek = buildOpponentByTeamWeek(scheduleResults);
  const weeklyFinishesByWeek: Record<number, number> = {};
  const finishesByPlayerWeek = new Map<string, Record<number, number>>();
  /** Defense → week → FPts from each opposing player at this position. */
  const weekScoresByTeam = new Map<string, Map<number, number[]>>();
  let scoresThroughWeek = 0;

  weekNumbers.forEach((week, index) => {
    const rows = weekRows[index] ?? [];
    if (rows.length === 0) return;
    scoresThroughWeek = Math.max(scoresThroughWeek, week);

    const scored = rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      nflTeam: row.nflTeam,
      primaryPositionId: row.primaryPositionId,
      stats: row.stats,
      fantasyPts: calculatePlayerPoints(
        row.stats,
        row.primaryPositionId,
        input.rules,
      ),
    }));

    const ranks = buildFantasyPositionRankById(scored);
    for (const [playerId, finish] of ranks) {
      const bag = finishesByPlayerWeek.get(playerId) ?? {};
      bag[week] = finish;
      finishesByPlayerWeek.set(playerId, bag);
    }
    const subjectFinish = ranks.get(input.playerId);
    if (subjectFinish != null) {
      weeklyFinishesByWeek[week] = subjectFinish;
    }

    for (const row of scored) {
      const rate = sosWeekRateFromRow({
        positionId: input.positionId,
        fantasyPts: row.fantasyPts,
        stats: row.stats,
      });
      if (rate == null) continue;
      const team = normalizeNflTeamAbbrev(row.nflTeam);
      if (!team) continue;
      const opponent = opponentByTeamWeek.get(`${team}|${week}`);
      if (!opponent) continue;
      pushAllowedScore(weekScoresByTeam, opponent, week, rate);
    }
  });

  const weekTotalsByTeam = collapseScoresToWeeklyAllowedRate(
    weekScoresByTeam,
    input.positionId,
  );

  const currentAvgByTeam = avgPtsAllowedByTeam(
    new Map(
      [...weekTotalsByTeam.entries()].map(([team, byWeek]) => [
        team,
        [...byWeek.values()],
      ]),
    ),
  );

  const isLiveSeason =
    nflState != null && String(nflState.season) === String(input.season);
  const seasonType = nflState?.season_type ?? "";

  /**
   * Prior seasons are complete: any week without a player score is DNP/bye,
   * not "upcoming". Don't rely on ESPN result flags (often missing historically).
   * Same once the live calendar season is in postseason / offseason / preseason
   * after scores exist — the regular slate is done.
   */
  if (
    scoresThroughWeek > 0 &&
    (!isLiveSeason ||
      seasonType === "pre" ||
      seasonType === "off" ||
      seasonType === "post")
  ) {
    scoresThroughWeek = maxWeek;
  }

  // Archive seasons use that season only. Live preseason/offseason → prior only.
  let scoredThroughWeek = maxScoredWeek(weekTotalsByTeam);
  if (!isLiveSeason) {
    scoredThroughWeek = 99;
  } else if (seasonType === "pre" || seasonType === "off") {
    scoredThroughWeek = 0;
  }

  const weights = sosBlendWeights(scoredThroughWeek);
  let priorAvgByTeam = new Map<string, number>();
  if (weights.prior > 0) {
    const priorSeason =
      nflState?.previous_season ??
      String(Number.parseInt(input.season, 10) - 1);
    if (priorSeason && priorSeason !== input.season) {
      const priorTotals = await loadPtsAllowedWeekTotals({
        season: priorSeason,
        positionId: input.positionId,
        rules: input.rules,
      });
      priorAvgByTeam = avgPtsAllowedByTeam(
        new Map(
          [...priorTotals.entries()].map(([team, byWeek]) => [
            team,
            [...byWeek.values()],
          ]),
        ),
      );
    }
  }

  const blendedAvg = new Map<string, number>();
  const teams = new Set([
    ...currentAvgByTeam.keys(),
    ...priorAvgByTeam.keys(),
  ]);
  for (const team of teams) {
    const blended = blendSosRate(
      priorAvgByTeam.get(team),
      currentAvgByTeam.get(team),
      weights,
    );
    if (blended != null) blendedAvg.set(team, blended);
  }

  const sosByTeam = rankTeamsBySosRate(
    blendedAvg,
    sosHigherRateIsHarder(input.positionId),
  );
  const teamCount = sosByTeam.rankByTeam.size;
  const matchupRanksByWeek: Record<number, number> = {};
  const ptsAllowedByWeek: Record<number, number> = {};
  const matchupDifficultyByWeek: Record<number, "easy" | "mid" | "hard"> = {};

  for (const week of input.schedule) {
    const meta = parseOpponentMeta(week.opponent);
    if (meta.isBye || !meta.abbrev) continue;
    const rank = sosByTeam.rankByTeam.get(meta.abbrev);
    const avg = sosByTeam.avgByTeam.get(meta.abbrev);
    if (avg != null) {
      ptsAllowedByWeek[week.week] = Math.round(avg * 10) / 10;
    }
    if (rank != null) {
      matchupRanksByWeek[week.week] = rank;
    }
    const difficulty =
      rank != null
        ? difficultyFromPositionSosRank(input.positionId, rank, teamCount)
        : null;
    if (difficulty) matchupDifficultyByWeek[week.week] = difficulty;
  }

  return {
    weeklyFinishesByWeek,
    scoresThroughWeek,
    matchupDifficultyByWeek,
    matchupRanksByWeek,
    ptsAllowedByWeek,
    sosByTeam,
    finishesByPlayerWeek,
  };
}

function mergeGameLogWithSchedule(input: {
  gameLog: Array<{
    week: number;
    fantasyPts: number | null;
    stats: Record<string, number | null>;
  }>;
  schedule: NflTeamScheduleWeek[];
}): PlayerProfileGameLogRow[] {
  const byWeek = new Map(input.gameLog.map((row) => [row.week, row]));
  if (input.schedule.length === 0) {
    return input.gameLog.map((row) => ({
      week: row.week,
      opponent: null,
      result: null,
      fantasyPts: row.fantasyPts,
      stats: row.stats,
    }));
  }

  return input.schedule.map((slot) => {
    const row = byWeek.get(slot.week);
    return {
      week: slot.week,
      opponent: slot.opponent,
      result: slot.result,
      fantasyPts: row?.fantasyPts ?? null,
      stats: row?.stats ?? {},
    };
  });
}

function buildCompareRowFromLog(input: {
  id: string;
  name: string;
  nflTeam: string | null;
  sleeperId: string | null;
  primaryPositionId: string;
  slotLabel: string | null;
  gameLog: PlayerProfileGameLogRow[];
  finishesByWeek: Record<number, number>;
  sosByTeam: {
    rankByTeam: Map<string, number>;
    avgByTeam: Map<string, number>;
  };
}): OverviewRosterCompareSeedRow | null {
  const scored = input.gameLog.filter(
    (row) =>
      row.fantasyPts != null &&
      Number.isFinite(row.fantasyPts) &&
      !parseOpponentMeta(row.opponent).isBye,
  );
  if (scored.length === 0) return null;

  const values = scored.map((row) => row.fantasyPts!);
  const sorted = values.toSorted((a, b) => a - b);
  const totalFpts = values.reduce((a, b) => a + b, 0);
  const fptsPerGame = totalFpts / values.length;

  const homeVals = scored
    .filter((row) => parseOpponentMeta(row.opponent).venue === "home")
    .map((row) => row.fantasyPts!);
  const awayVals = scored
    .filter((row) => parseOpponentMeta(row.opponent).venue === "away")
    .map((row) => row.fantasyPts!);

  const finishes = scored
    .map((row) => input.finishesByWeek[row.week])
    .filter((n): n is number => n != null);
  const startableThreshold = positionStartableThreshold(
    input.primaryPositionId,
  );
  const startableFinishes = finishes.filter(
    (finish) => finish <= startableThreshold,
  ).length;

  const lastScoredWeek = Math.max(...scored.map((row) => row.week));
  const remainingRanks: number[] = [];
  for (const row of input.gameLog) {
    if (row.week <= lastScoredWeek) continue;
    const meta = parseOpponentMeta(row.opponent);
    if (meta.isBye || !meta.abbrev) continue;
    const rank = input.sosByTeam.rankByTeam.get(meta.abbrev);
    if (rank != null) remainingRanks.push(rank);
  }

  const carrySharePct: number | null = null;
  let ypc: number | null = null;
  if (input.primaryPositionId === "RB") {
    const rushAtt = scored.reduce(
      (sum, row) => sum + (numStat(row.stats, "rush_att") ?? 0),
      0,
    );
    const rushYd = scored.reduce(
      (sum, row) => sum + (numStat(row.stats, "rush_yd") ?? 0),
      0,
    );
    if (rushAtt > 0) ypc = rushYd / rushAtt;
  }

  const consistency = buildScoringConsistency(values);

  return {
    id: input.id,
    name: input.name,
    nflTeam: input.nflTeam,
    sleeperId: input.sleeperId,
    primaryPositionId: input.primaryPositionId,
    slotLabel: input.slotLabel,
    gamesPlayed: scored.length,
    carrySharePct,
    ypc,
    fptsPerGame,
    totalFpts,
    homeAvg: mean(homeVals),
    awayAvg: mean(awayVals),
    floor: percentile(sorted, 0.15),
    median: percentile(sorted, 0.5),
    ceiling: percentile(sorted, 0.85),
    consistencyScore: consistency?.score ?? null,
    avgWeeklyFinish: mean(finishes),
    startablePct:
      finishes.length > 0
        ? (startableFinishes / finishes.length) * 100
        : null,
    remainingSosRank: mean(remainingRanks),
  };
}

async function loadMateGameLogs(input: {
  playerIds: string[];
  season: string;
  positionId: string;
  rules: ScoringRuleDefinition[];
  seasonMaxWeek: number;
}): Promise<
  Map<
    string,
    Array<{
      week: number;
      fantasyPts: number | null;
      stats: Record<string, number | null>;
    }>
  >
> {
  const map = new Map<
    string,
    Array<{
      week: number;
      fantasyPts: number | null;
      stats: Record<string, number | null>;
    }>
  >();
  if (input.playerIds.length === 0) return map;
  const maxWeek = Math.max(1, Math.min(18, input.seasonMaxWeek));

  const rows = await db
    .select({
      playerId: playerScores.playerId,
      week: playerScores.week,
      stats: playerScores.stats,
    })
    .from(playerScores)
    .where(
      and(
        inArray(playerScores.playerId, input.playerIds),
        eq(playerScores.season, input.season),
        eq(playerScores.kind, "stats"),
        eq(playerScores.seasonType, "regular"),
        gte(playerScores.week, 1),
      ),
    )
    .orderBy(asc(playerScores.week));

  for (const row of rows) {
    if (row.week < 1 || row.week > maxWeek) continue;
    const stats = normalizePlayerStats(
      (row.stats ?? {}) as Record<string, number | null>,
    ) as Record<string, number | null>;
    const fantasyPts = calculatePlayerPoints(
      stats,
      input.positionId,
      input.rules,
    );
    const list = map.get(row.playerId) ?? [];
    list.push({ week: row.week, fantasyPts, stats });
    map.set(row.playerId, list);
  }

  return map;
}

async function loadRosterCompare(input: {
  userTeamId: string | null;
  subjectPlayerId: string;
  positionId: string;
  season: string;
  rules: ScoringRuleDefinition[];
  seasonMaxWeek: number;
  finishesByPlayerWeek: Map<string, Record<number, number>>;
  sosByTeam: {
    rankByTeam: Map<string, number>;
    avgByTeam: Map<string, number>;
  };
}): Promise<OverviewRosterCompareSeedRow[]> {
  if (!input.userTeamId) return [];

  const roster = await getTeamRosterPlayers(input.userTeamId);
  const mates = roster.filter(
    (row) =>
      row.id !== input.subjectPlayerId &&
      row.primaryPositionId === input.positionId,
  );
  if (mates.length === 0) return [];

  const gameLogs = await loadMateGameLogs({
    playerIds: mates.map((mate) => mate.id),
    season: input.season,
    positionId: input.positionId,
    rules: input.rules,
    seasonMaxWeek: input.seasonMaxWeek,
  });

  const schedules = await Promise.all(
    mates.map(async (mate) => ({
      id: mate.id,
      schedule: await getNflTeamSchedule({
        nflTeam: mate.nflTeam,
        season: input.season,
        byeWeek: resolvePlayerByeWeek({
          byeWeek: mate.byeWeek,
          nflTeam: mate.nflTeam,
          seasonYear: Number(input.season) || undefined,
        }),
      }),
    })),
  );
  const scheduleById = new Map(
    schedules.map((row) => [row.id, row.schedule] as const),
  );

  const rows: OverviewRosterCompareSeedRow[] = [];
  for (const mate of mates) {
    const rawLog = gameLogs.get(mate.id) ?? [];
    const gameLog = mergeGameLogWithSchedule({
      gameLog: rawLog,
      schedule: scheduleById.get(mate.id) ?? [],
    });
    const compare = buildCompareRowFromLog({
      id: mate.id,
      name: mate.fullName,
      nflTeam: mate.nflTeam,
      sleeperId: mate.sleeperId ?? null,
      primaryPositionId: mate.primaryPositionId,
      slotLabel: mate.slotPositionId,
      gameLog,
      finishesByWeek: input.finishesByPlayerWeek.get(mate.id) ?? {},
      sosByTeam: input.sosByTeam,
    });
    if (compare) rows.push(compare);
  }

  return rows;
}

export type LoadOverviewExtrasInput = {
  playerId: string;
  primaryPositionId: string;
  nflTeam: string | null;
  season: string;
  availableSeasons: string[];
  gameLog: PlayerProfileGameLogRow[];
  seasonStats: {
    fantasyPts: number | null;
    stats: Record<string, number | null>;
  } | null;
  schedule: NflTeamScheduleWeek[];
  rules: ScoringRuleDefinition[];
  leagueCalendar: {
    regularSeasonEndWeek: number;
    playoffWeeks: number[];
  } | null;
  userTeamId: string | null;
};

/** Load Overview extras (share, finishes, SOS, roster compare, multi-year). */
export async function loadOverviewExtrasSeed(
  input: LoadOverviewExtrasInput,
): Promise<OverviewExtrasSeed> {
  const calendar = input.leagueCalendar ?? defaultLeagueCalendar();
  const seasonMaxWeek = resolveLeagueSeasonMaxWeek(calendar);
  const cappedGameLog = input.gameLog.filter(
    (row) => row.seasonType !== "pre" && row.week <= seasonMaxWeek,
  );
  const cappedSchedule = input.schedule.filter(
    (row) => row.week <= seasonMaxWeek,
  );
  const scoredWeeks = cappedGameLog
    .filter(
      (row) =>
        row.fantasyPts != null &&
        Number.isFinite(row.fantasyPts) &&
        !parseOpponentMeta(row.opponent).isBye,
    )
    .map((row) => row.week);

  const [share, multiYear, weeklyAndSos] = await Promise.all([
    scoredWeeks.length > 0 && input.seasonStats?.stats
      ? loadOpportunityShareForWeeks({
          positionId: input.primaryPositionId,
          nflTeam: input.nflTeam,
          season: input.season,
          weeks: scoredWeeks,
          playerStats: input.seasonStats.stats,
        })
      : loadOpportunityShare({
          positionId: input.primaryPositionId,
          nflTeam: input.nflTeam,
          season: input.season,
          playerStats: input.seasonStats?.stats,
        }),
    loadMultiYear({
      playerId: input.playerId,
      positionId: input.primaryPositionId,
      seasons: input.availableSeasons,
      rules: input.rules,
    }),
    loadWeeklyFinishesAndSos({
      playerId: input.playerId,
      positionId: input.primaryPositionId,
      season: input.season,
      schedule: cappedSchedule,
      rules: input.rules,
      seasonMaxWeek,
    }),
  ]);

  const rosterCompare = await loadRosterCompare({
    userTeamId: input.userTeamId,
    subjectPlayerId: input.playerId,
    positionId: input.primaryPositionId,
    season: input.season,
    rules: input.rules,
    seasonMaxWeek,
    finishesByPlayerWeek: weeklyAndSos.finishesByPlayerWeek,
    sosByTeam: weeklyAndSos.sosByTeam,
  });

  return {
    share,
    weeklyFinishesByWeek: weeklyAndSos.weeklyFinishesByWeek,
    scoresThroughWeek: weeklyAndSos.scoresThroughWeek,
    matchupDifficultyByWeek: weeklyAndSos.matchupDifficultyByWeek,
    matchupRanksByWeek: weeklyAndSos.matchupRanksByWeek,
    ptsAllowedByWeek: weeklyAndSos.ptsAllowedByWeek,
    playoffWeeks: calendar.playoffWeeks,
    regularSeasonEndWeek: calendar.regularSeasonEndWeek,
    rosterCompare,
    multiYear,
  };
}
