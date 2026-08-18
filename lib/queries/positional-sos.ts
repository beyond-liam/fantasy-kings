import { cache } from "react";

import { getNflTeamSchedule, type NflTeamScheduleWeek } from "@/lib/espn/team-schedule";
import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { NFL_TEAMS } from "@/lib/nfl/teams";
import { normalizeNflTeamAbbrev } from "@/lib/nfl/matchups";
import {
  parseOpponentMeta,
} from "@/lib/players/overview-metrics";
import {
  type PositionalSosMatchup,
  type PositionalSosTable,
} from "@/lib/players/matchup-difficulty";
import {
  blendSosRate,
  difficultyFromPositionSosRank,
  rankTeamsBySosRate,
  sosBlendWeights,
  sosHigherRateIsEasier,
  sosTopNForPosition,
  sosWeeklyAllowedRate,
} from "@/lib/players/sos-thresholds";
import { loadScoreRows } from "@/lib/queries/score-rows";
import { getNflState } from "@/lib/sleeper/api";

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
        columns: "pts",
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
      if (fantasyPts == null || !Number.isFinite(fantasyPts)) continue;
      const team = normalizeNflTeamAbbrev(row.nflTeam);
      if (!team) continue;
      const opponent = opponentByTeamWeek.get(`${team}|${week}`);
      if (!opponent) continue;
      const byWeek =
        weekScoresByTeam.get(opponent) ?? new Map<number, number[]>();
      const list = byWeek.get(week) ?? [];
      list.push(fantasyPts);
      byWeek.set(week, list);
      weekScoresByTeam.set(opponent, byWeek);
    }
  });

  return collapseScoresToWeeklyAllowedRate(
    weekScoresByTeam,
    input.positionId,
  );
}

const getPositionalSosByTeamCached = cache(
  async (
    season: string,
    positionId: string,
    rulesJson: string,
  ): Promise<Map<string, PositionalSosMatchup>> => {
    const rules = JSON.parse(rulesJson) as ScoringRuleDefinition[];
    try {
      const [nflState, currentTotals] = await Promise.all([
        getNflState().catch(() => null),
        loadPtsAllowedWeekTotals({ season, positionId, rules }),
      ]);

      const currentAvgByTeam = avgPtsAllowedByTeam(
        new Map(
          [...currentTotals.entries()].map(([team, byWeek]) => [
            team,
            [...byWeek.values()],
          ]),
        ),
      );

      const isLiveSeason =
        nflState != null && String(nflState.season) === String(season);
      const seasonType = nflState?.season_type ?? "";

      let scoredThroughWeek = maxScoredWeek(currentTotals);
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
          String(Number.parseInt(season, 10) - 1);
        if (priorSeason && priorSeason !== season) {
          const priorTotals = await loadPtsAllowedWeekTotals({
            season: priorSeason,
            positionId,
            rules,
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

      const ranked = rankTeamsBySosRate(
        blendedAvg,
        sosHigherRateIsEasier(positionId),
      );
      const teamCount = ranked.rankByTeam.size;
      const byTeam = new Map<string, PositionalSosMatchup>();
      for (const [team, rank] of ranked.rankByTeam) {
        const ptsAllowed = ranked.avgByTeam.get(team);
        const difficulty = difficultyFromPositionSosRank(
          positionId,
          rank,
          teamCount,
        );
        if (ptsAllowed == null || !difficulty) continue;
        byTeam.set(team, {
          positionId,
          rank,
          ptsAllowed: Math.round(ptsAllowed * 10) / 10,
          difficulty,
          teamCount,
        });
      }
      return byTeam;
    } catch {
      return new Map();
    }
  },
);

export async function getPositionalSosTable(input: {
  season: string;
  positionIds: Iterable<string>;
  rules: ScoringRuleDefinition[];
}): Promise<PositionalSosTable> {
  const unique = [
    ...new Set(
      [...input.positionIds].map((id) => id.trim()).filter(Boolean),
    ),
  ];
  if (unique.length === 0) return new Map();

  const rulesJson = JSON.stringify(input.rules);
  const entries = await Promise.all(
    unique.map(async (positionId) => {
      const byTeam = await getPositionalSosByTeamCached(
        input.season,
        positionId,
        rulesJson,
      );
      return [positionId, byTeam] as const;
    }),
  );
  return new Map(entries);
}
