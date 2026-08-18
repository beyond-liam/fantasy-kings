import "server-only";

import { getNflScoreboard } from "@/lib/espn/scoreboard";
import type {
  MatchupBoardLivePatch,
  MatchupBoardLiveSidePatch,
} from "@/lib/leagues/matchups/board-live-patch";
import {
  getFinalMatchupsForSeason,
  recordsFromFinalMatchups,
} from "@/lib/leagues/matchups/finals";
import { resolveFantasyMatchupWeek } from "@/lib/leagues/matchup-week";
import {
  espnSeasonTypeForNfl,
  fantasyWeekToNfl,
} from "@/lib/leagues/schedule/fantasy-week-map";
import { resolveScheduleSettings } from "@/lib/leagues/schedule/settings";
import { resolveScoringRuleDefinitions } from "@/lib/leagues/scoring/rules";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";
import {
  getLeagueBySlug,
  getLeagueSeasonByYear,
  getLeagueSeasonYears,
} from "@/lib/queries/leagues";
import { getWeekMatchups } from "@/lib/queries/matchups";
import { getPlayerScoresFreshness } from "@/lib/queries/score-freshness";
import {
  enrichWeekMatchupBoard,
  type MatchupBoardGame,
} from "@/lib/queries/week-matchup-board";

export type {
  MatchupBoardLiveGamePatch,
  MatchupBoardLivePatch,
  MatchupBoardLiveSidePatch,
} from "@/lib/leagues/matchups/board-live-patch";

function toSidePatch(side: MatchupBoardGame["away"]): MatchupBoardLiveSidePatch {
  return {
    actualPts: side.actualPts,
    projectedPts: side.projectedPts,
    winChance: side.winChance,
    isLoser: side.isLoser,
  };
}

/**
 * Slim live board snapshot for soft client updates (no full RSC reload).
 */
export async function getLeagueMatchupBoardLivePatch(input: {
  leagueSlug: string;
  week?: number;
  year?: number;
}): Promise<MatchupBoardLivePatch | null> {
  const league = await getLeagueBySlug(input.leagueSlug);
  if (!league) {
    return null;
  }

  const years = await getLeagueSeasonYears(league.id);
  const year =
    input.year != null && years.includes(input.year)
      ? input.year
      : (years[0] ?? null);
  if (year == null) {
    return null;
  }

  const season = await getLeagueSeasonByYear(league.id, year);
  if (!season) {
    return null;
  }

  const schedule = resolveScheduleSettings(season.settings.schedule);
  const resolved = await resolveFantasyMatchupWeek({
    seasonYear: season.seasonYear,
    nflRegularSeasonEndWeek: season.regularSeasonEndWeek,
    schedule,
    requestedWeek: input.week,
  });

  const week = resolved.week;
  const nflWeek = fantasyWeekToNfl(week, schedule);
  const scoringWeek = nflWeek?.week ?? week;
  const scoringSeasonType = nflWeek?.seasonType ?? "regular";
  const scoringRules = resolveScoringRuleDefinitions(
    season.scoringPreset as ScoringPreset,
    season.settings.scoringRules,
  );

  const [matchups, scoreboard, freshness, finals] = await Promise.all([
    getWeekMatchups(season.id, week),
    getNflScoreboard({
      season: season.seasonYear,
      week: scoringWeek,
      seasonType: espnSeasonTypeForNfl(scoringSeasonType),
    }).catch(() => null),
    getPlayerScoresFreshness({
      season: String(season.seasonYear),
      week: scoringWeek,
      kind: "stats",
      seasonType: scoringSeasonType,
    }).catch(() => null),
    getFinalMatchupsForSeason(season.id).catch(() => []),
  ]);

  const scoreboardGames = scoreboard?.games ?? [];
  const games = await enrichWeekMatchupBoard({
    leagueSeasonId: season.id,
    matchups,
    week,
    currentWeek: resolved.currentWeek,
    seasonYear: String(season.seasonYear),
    scoringWeek,
    scoringSeasonType,
    scoringRules,
    rosterSlots: season.settings.rosterSlots,
    benchSlots: season.benchSlots,
    irEnabled: season.irEnabled,
    irSlots: season.irSlots,
    irEligibleStatuses: season.settings.irEligibleStatuses,
    taxiEnabled: season.taxiEnabled,
    taxiSlots: season.taxiSlots,
    scoreboardGames,
    recordsByTeamId: recordsFromFinalMatchups(finals),
  });

  return {
    updatedAt: freshness?.toISOString() ?? null,
    week,
    hasLiveNflGames: scoreboardGames.some((game) => game.status === "in"),
    games: games.map((game) => ({
      id: game.id,
      status: game.status,
      resultFinal: game.resultFinal,
      away: toSidePatch(game.away),
      home: toSidePatch(game.home),
    })),
  };
}
