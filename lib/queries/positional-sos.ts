import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { createProcessCache } from "@/lib/cache/process-cache";
import { normalizeNflTeamAbbrev } from "@/lib/nfl/matchups";
import { getNflSeasonOpponentByTeamWeek } from "@/lib/queries/nfl-season-opponents";
import {
  loadScoreRowsForWeeks,
} from "@/lib/queries/score-rows";
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
import { getNflState } from "@/lib/sleeper/api";

export type PositionalSosTableError = { message: string };

export type PositionalSosTableResult =
  | { ok: true; table: PositionalSosTable }
  | { ok: false; error: PositionalSosTableError };

export type PositionalSosDeps = {
  getNflState: typeof getNflState;
  loadPtsAllowedWeekTotals: typeof loadPtsAllowedWeekTotals;
};

const REGULAR_SEASON_WEEKS = Array.from({ length: 18 }, (_, index) => index + 1);

type WeekTotalsByTeam = Map<string, Map<number, number>>;
type SerializedWeekTotals = Array<[string, Array<[number, number]>]>;

const defaultPositionalSosDeps: PositionalSosDeps = {
  getNflState,
  loadPtsAllowedWeekTotals,
};

function serializeWeekTotals(map: WeekTotalsByTeam): SerializedWeekTotals {
  return [...map.entries()].map(([team, byWeek]) => [
    team,
    [...byWeek.entries()],
  ]);
}

function deserializeWeekTotals(entries: SerializedWeekTotals): WeekTotalsByTeam {
  return new Map(
    entries.map(([team, weeks]) => [team, new Map(weeks)]),
  );
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
): WeekTotalsByTeam {
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

async function loadPtsAllowedWeekTotalsUncached(input: {
  season: string;
  positionId: string;
  rules: ScoringRuleDefinition[];
  opponentByTeamWeek?: Map<string, string>;
}): Promise<WeekTotalsByTeam> {
  const opponentByTeamWeek =
    input.opponentByTeamWeek ??
    (await getNflSeasonOpponentByTeamWeek(input.season));

  const rowsByWeek = await loadScoreRowsForWeeks({
    season: input.season,
    weeks: REGULAR_SEASON_WEEKS,
    kind: "stats",
    position: input.positionId,
    columns: "pts",
  });

  const weekScoresByTeam = new Map<string, Map<number, number[]>>();

  for (const week of REGULAR_SEASON_WEEKS) {
    const rows = rowsByWeek.get(week) ?? [];
    if (rows.length === 0) continue;

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
  }

  return collapseScoresToWeeklyAllowedRate(
    weekScoresByTeam,
    input.positionId,
  );
}

const getCachedPtsAllowedWeekTotalsEntries = createProcessCache<
  SerializedWeekTotals
>({
  ttlMs: 60 * 60 * 1000,
  maxEntries: 64,
});

async function loadPtsAllowedWeekTotals(input: {
  season: string;
  positionId: string;
  rules: ScoringRuleDefinition[];
  opponentByTeamWeek?: Map<string, string>;
}): Promise<WeekTotalsByTeam> {
  if (input.opponentByTeamWeek) {
    return loadPtsAllowedWeekTotalsUncached(input);
  }

  const rulesJson = JSON.stringify(input.rules);
  const entries = await getCachedPtsAllowedWeekTotalsEntries(
    `${input.season}|${input.positionId}|${rulesJson}`,
    async () => {
      const totals = await loadPtsAllowedWeekTotalsUncached({
        season: input.season,
        positionId: input.positionId,
        rules: input.rules,
      });
      return serializeWeekTotals(totals);
    },
  );
  return deserializeWeekTotals(entries);
}

function priorSeasonFor(season: string): string | null {
  const year = Number.parseInt(season, 10);
  if (!Number.isFinite(year)) return null;
  const prior = String(year - 1);
  return prior === season ? null : prior;
}

async function computePositionalSosByTeam(
  input: {
    season: string;
    positionId: string;
    rules: ScoringRuleDefinition[];
  },
  deps: PositionalSosDeps = defaultPositionalSosDeps,
): Promise<Map<string, PositionalSosMatchup>> {
  const { season, positionId, rules } = input;
  const priorSeason = priorSeasonFor(season);
  const [nflState, currentTotals, priorTotals] = await Promise.all([
    deps.getNflState().catch(() => null),
    deps.loadPtsAllowedWeekTotals({ season, positionId, rules }),
    priorSeason
      ? deps.loadPtsAllowedWeekTotals({
          season: priorSeason,
          positionId,
          rules,
        })
      : Promise.resolve(new Map<string, Map<number, number>>()),
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
  if (weights.prior > 0 && priorSeason) {
    priorAvgByTeam = avgPtsAllowedByTeam(
      new Map(
        [...priorTotals.entries()].map(([team, byWeek]) => [
          team,
          [...byWeek.values()],
        ]),
      ),
    );
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
}

function normalizePositionalSosInput(input: {
  season: string;
  positionIds: Iterable<string>;
  rules: ScoringRuleDefinition[];
}): string[] {
  return [
    ...new Set(
      [...input.positionIds].map((id) => id.trim()).filter(Boolean),
    ),
  ];
}

function toPositionalSosTableError(error: unknown): PositionalSosTableError {
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: "Positional SOS computation failed" };
}

async function buildPositionalSosTableResult(
  input: {
    season: string;
    positionIds: Iterable<string>;
    rules: ScoringRuleDefinition[];
  },
  loadByTeam: (
    positionId: string,
  ) => Promise<Map<string, PositionalSosMatchup>>,
): Promise<PositionalSosTableResult> {
  const unique = normalizePositionalSosInput(input);
  if (unique.length === 0) {
    return { ok: true, table: new Map() };
  }

  try {
    const entries = await Promise.all(
      unique.map(async (positionId) => {
        const byTeam = await loadByTeam(positionId);
        return [positionId, byTeam] as const;
      }),
    );
    return { ok: true, table: new Map(entries) };
  } catch (error) {
    return { ok: false, error: toPositionalSosTableError(error) };
  }
}

export async function getPositionalSosTableResult(
  input: {
    season: string;
    positionIds: Iterable<string>;
    rules: ScoringRuleDefinition[];
  },
  deps?: PositionalSosDeps,
): Promise<PositionalSosTableResult> {
  if (deps) {
    const { season, rules } = input;
    return buildPositionalSosTableResult(input, (positionId) =>
      computePositionalSosByTeam({ season, positionId, rules }, deps),
    );
  }

  return buildPositionalSosTableResult(input, (positionId) =>
    computePositionalSosByTeam({
      season: input.season,
      positionId,
      rules: input.rules,
    }),
  );
}

export async function getPositionalSosTable(input: {
  season: string;
  positionIds: Iterable<string>;
  rules: ScoringRuleDefinition[];
}): Promise<PositionalSosTable> {
  const result = await getPositionalSosTableResult(input);
  if (result.ok) {
    return result.table;
  }

  const positionCount = normalizePositionalSosInput(input).length;
  console.warn(
    `[getPositionalSosTable] positional SOS unavailable for season=${input.season} positions=${positionCount}: ${result.error.message}`,
  );
  return new Map();
}
