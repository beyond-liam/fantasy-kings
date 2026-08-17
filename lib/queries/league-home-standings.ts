import { and, eq, gte } from "drizzle-orm";
import { cache } from "react";

import {
  type PlayoffSettings,
  type RosterSlotConfig,
  type ScheduleSettings,
  type TiebreakerSettings,
  matchups,
} from "@/db/schema";
import { db } from "@/lib/db";
import {
  bracketTeamsFromStandings,
  buildPlayoffBracket,
  type PlayoffBracket,
} from "@/lib/leagues/playoff-bracket";
import { hydratePlayoffBracket } from "@/lib/leagues/playoff-bracket-hydrate";
import {
  attachSosToStandings,
  buildPlayoffStandingsRows,
  resolvePlayoffCutoffSeed,
  type LeaguePlayoffStandingsRow,
} from "@/lib/leagues/playoff-standings";
import {
  clampPlayoffTeamCount,
  resolvePlayoffSettings,
} from "@/lib/leagues/playoff-settings";
import type { RemainingMatchup } from "@/lib/leagues/playoff-odds";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
  type ScoringRuleDefinition,
} from "@/lib/leagues/scoring";
import { getPlayoffWeekRange } from "@/lib/leagues/season-calendar";
import { resolveTeamStrengthForSos } from "@/lib/leagues/sos";
import {
  attachPreviousWeekRankDelta,
  buildLeagueStandings,
} from "@/lib/leagues/standings-from-matchups";
import type {
  FinalMatchupRecord,
  LeagueStandingsMember,
  LeagueStandingsRow,
} from "@/lib/leagues/standings";
import { getSeasonMatchups, type LeagueMatchupRow } from "@/lib/queries/matchups";
import { getTeamProjectedWeeklyPf } from "@/lib/queries/team-projected-strength";
import { getGameWeekCloseState } from "@/lib/nfl/current-week-board";
import { excludeUnfinalizedGameWeek } from "@/lib/nfl/game-week";
import { getNflState } from "@/lib/sleeper/api";

export type LeagueHomeStandingsBundleInput = {
  leagueSeasonId: string | null;
  standingsTeams: LeagueStandingsMember[];
  teamCount: number;
  showFaabBudget: boolean;
  faabBudget: number | null;
  regularSeasonEndWeek: number;
  tiebreakers?: TiebreakerSettings | null;
  seasonYear: number | null;
  scoringPreset: ScoringPreset | null;
  scoringRules?: ScoringRuleDefinition[] | null;
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  irEligibleStatuses?: string[] | null;
  taxiEnabled: boolean;
  taxiSlots: number;
  playoffTeamCount: number;
  championshipWeek: number;
  playoffs?: PlayoffSettings | null;
  schedule?: ScheduleSettings | null;
};

export type LeagueHomeStandingsBundle = {
  standings: LeagueStandingsRow[];
  playoffStandings: LeaguePlayoffStandingsRow[];
  playoffCutoffSeed: number | null;
  playoffSettings: PlayoffSettings;
  playoffTeamCount: number;
  finals: FinalMatchupRecord[];
  seasonMatchups: LeagueMatchupRow[];
  projectedWeeklyPf: Map<string, number>;
  strengthByTeamId: Map<string, number>;
  remainingMatchups: RemainingMatchup[];
};

export const getLeagueHomeStandingsBundle = cache(
  async (
    input: LeagueHomeStandingsBundleInput,
  ): Promise<LeagueHomeStandingsBundle> => {
    const seasonMatchups =
      input.leagueSeasonId != null
        ? await getSeasonMatchups(input.leagueSeasonId).catch(() => [])
        : [];
    const close = await getGameWeekCloseState(input.schedule);

    const regularSeasonEndWeek = input.regularSeasonEndWeek;
    const weekIsPlayed = (week: number, status: string) =>
      status === "final" &&
      (close.weekFinalized ||
        close.fantasyWeek == null ||
        week < close.fantasyWeek);
    const finals = excludeUnfinalizedGameWeek(
      seasonMatchups.filter(
        (row) =>
          row.status === "final" &&
          row.week <= regularSeasonEndWeek &&
          row.homePts != null &&
          row.awayPts != null,
      ),
      close.fantasyWeek,
      close.weekFinalized,
    ).map((row) => ({
      id: row.id,
      week: row.week,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      homePts: row.homePts,
      awayPts: row.awayPts,
    }));
    const sosMatchups = seasonMatchups
      .filter((row) => row.week <= regularSeasonEndWeek)
      .map((row) => ({
        week: row.week,
        homeTeamId: row.homeTeamId,
        awayTeamId: row.awayTeamId,
        played: weekIsPlayed(row.week, row.status),
      }));
    const remainingMatchups = sosMatchups
      .filter((row) => !row.played)
      .map((row) => ({
        homeTeamId: row.homeTeamId,
        awayTeamId: row.awayTeamId,
      }));

    const baseStandings = buildLeagueStandings(
      input.standingsTeams,
      {
        teamCount: input.teamCount,
        faabBudget: input.showFaabBudget ? input.faabBudget : null,
      },
      finals,
      input.tiebreakers,
    );
    const claimedTeamIds = baseStandings
      .filter((row): row is typeof row & { teamId: string } =>
        Boolean(row.claimed && row.teamId),
      )
      .map((row) => row.teamId);

    let projectedWeeklyPf = new Map<string, number>();
    if (
      input.leagueSeasonId &&
      input.seasonYear != null &&
      input.scoringPreset &&
      claimedTeamIds.length > 0
    ) {
      const scoringRules = resolveScoringRuleDefinitions(
        input.scoringPreset,
        input.scoringRules,
      );
      const nflState = await getNflState().catch(() => null);
      const projectionWeek = Math.max(1, Number(nflState?.week) || 1);
      projectedWeeklyPf = await getTeamProjectedWeeklyPf({
        teamIds: claimedTeamIds,
        seasonYear: String(input.seasonYear),
        week: projectionWeek,
        scoringRules,
        rosterSlots: input.rosterSlots,
        benchSlots: input.benchSlots,
        irEnabled: input.irEnabled,
        irSlots: input.irSlots,
        irEligibleStatuses: input.irEligibleStatuses,
        taxiEnabled: input.taxiEnabled,
        taxiSlots: input.taxiSlots,
      }).catch(() => new Map());
    }

    const strengthByTeamId = resolveTeamStrengthForSos({
      teamIds: claimedTeamIds,
      pointsForAvgByTeamId: new Map(
        baseStandings
          .filter((row) => row.teamId && row.claimed)
          .map((row) => [row.teamId!, row.pointsForAvg] as const),
      ),
      projectedWeeklyPfByTeamId: projectedWeeklyPf,
    });

    const standings = attachPreviousWeekRankDelta(
      attachSosToStandings(
        baseStandings,
        sosMatchups,
        projectedWeeklyPf,
      ),
      input.standingsTeams,
      {
        teamCount: input.teamCount,
        faabBudget: input.showFaabBudget ? input.faabBudget : null,
      },
      finals,
      input.tiebreakers,
    );
    const playoffSettings = resolvePlayoffSettings(input.playoffs);
    const playoffTeamCount =
      input.leagueSeasonId != null
        ? clampPlayoffTeamCount(input.playoffTeamCount, input.teamCount)
        : 0;
    const playoffCutoffSeed = resolvePlayoffCutoffSeed({
      enabled: playoffSettings.enabled,
      playoffTeamCount,
      teamCount: standings.length,
    });
    const playoffStandings = buildPlayoffStandingsRows(standings, {
      playoffSpots: playoffSettings.enabled ? playoffTeamCount : 0,
      remainingMatchups: playoffSettings.enabled ? remainingMatchups : [],
      strengthByTeamId,
    });

    return {
      standings,
      playoffStandings,
      playoffCutoffSeed,
      playoffSettings,
      playoffTeamCount,
      finals,
      seasonMatchups,
      projectedWeeklyPf,
      strengthByTeamId,
      remainingMatchups,
    };
  },
);

/** Build + hydrate the playoff bracket from standings (cached per season). */
export const loadHydratedPlayoffBracket = cache(
  async (input: {
    leagueSeasonId: string;
    playoffStandings: LeaguePlayoffStandingsRow[];
    playoffTeamCount: number;
    championshipWeek: number;
    playoffSettings: PlayoffSettings;
  }): Promise<PlayoffBracket | null> => {
    if (!input.playoffSettings.enabled) {
      return null;
    }

    const seedTeams = bracketTeamsFromStandings(
      input.playoffStandings,
      input.playoffTeamCount,
    );
    let playoffBracket = buildPlayoffBracket({
      teams: seedTeams,
      playoffTeamCount: input.playoffTeamCount,
      championshipWeek: input.championshipWeek,
      twoWeekChampionship: input.playoffSettings.twoWeekChampionship,
      enabled: true,
    });

    const range = getPlayoffWeekRange(
      input.championshipWeek,
      input.playoffTeamCount,
      {
        enabled: true,
        twoWeekChampionship: input.playoffSettings.twoWeekChampionship,
      },
    );
    if (!range || !playoffBracket) {
      return playoffBracket;
    }

    const playoffRows = await db
      .select({
        week: matchups.week,
        homeTeamId: matchups.homeTeamId,
        awayTeamId: matchups.awayTeamId,
        homePts: matchups.homePts,
        awayPts: matchups.awayPts,
        status: matchups.status,
      })
      .from(matchups)
      .where(
        and(
          eq(matchups.leagueSeasonId, input.leagueSeasonId),
          gte(matchups.week, range.startWeek),
        ),
      )
      .catch(() => []);

    if (playoffRows.length > 0) {
      playoffBracket = hydratePlayoffBracket(
        playoffBracket,
        playoffRows,
        seedTeams,
      );
    }

    return playoffBracket;
  },
);
