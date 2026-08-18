import "server-only";

import { leagueSeasons } from "@/db/schema";
import { resolvePlayoffSettings } from "@/lib/leagues/playoff-settings";
import { isRegularSeasonFinishedByNfl } from "@/lib/leagues/season-calendar";
import {
  canStartNewDynastySeason,
  denialForSeasonRoll,
  type SeasonRollFinishTeam,
} from "@/lib/leagues/season-roll";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";
import {
  getLeagueHomeStandingsBundle,
  loadHydratedPlayoffBracket,
} from "@/lib/queries/league-home-standings";
import { getLeagueSeasonByYear } from "@/lib/queries/leagues";
import { getNflState } from "@/lib/sleeper/api";

type SeasonRow = typeof leagueSeasons.$inferSelect;

export type SeasonRollEvaluation = {
  nextSeasonYear: number;
  eligible: boolean;
  error: string | null;
  rankedTeams: SeasonRollFinishTeam[];
};

export async function evaluateSeasonRoll(
  season: SeasonRow,
  standingsTeams: LeagueStandingsMember[],
): Promise<SeasonRollEvaluation> {
  const nextSeasonYear = season.seasonYear + 1;
  const next = await getLeagueSeasonByYear(season.leagueId, nextSeasonYear);
  const playoffs = resolvePlayoffSettings(season.settings.playoffs);

  const bundle = await getLeagueHomeStandingsBundle({
    leagueSeasonId: season.id,
    standingsTeams,
    teamCount: season.teamCount,
    showFaabBudget: false,
    faabBudget: season.faabBudget,
    regularSeasonEndWeek: season.regularSeasonEndWeek,
    tiebreakers: season.settings.tiebreakers,
    seasonYear: season.seasonYear,
    scoringPreset: null,
    scoringRules: season.settings.scoringRules,
    rosterSlots: season.settings.rosterSlots ?? [],
    benchSlots: season.benchSlots,
    irEnabled: season.irEnabled,
    irSlots: season.irSlots,
    irEligibleStatuses: season.settings.irEligibleStatuses,
    taxiEnabled: season.taxiEnabled,
    taxiSlots: season.taxiSlots,
    playoffTeamCount: season.playoffTeamCount,
    championshipWeek: season.championshipWeek,
    playoffs: season.settings.playoffs,
    schedule: season.settings.schedule,
  });

  const rankedTeams: SeasonRollFinishTeam[] = bundle.standings.flatMap(
    (row) => (row.teamId ? [{ teamId: row.teamId, rank: row.rank }] : []),
  );

  let championTeamId: string | null = null;
  if (playoffs.enabled) {
    const bracket = await loadHydratedPlayoffBracket({
      leagueSeasonId: season.id,
      playoffStandings: bundle.playoffStandings,
      playoffTeamCount: bundle.playoffTeamCount,
      championshipWeek: season.championshipWeek,
      playoffSettings: playoffs,
    });
    championTeamId = bracket?.champion?.teamId ?? null;
  }

  let regularSeasonFinished = false;
  if (!playoffs.enabled) {
    const nfl = await getNflState().catch(() => null);
    regularSeasonFinished = isRegularSeasonFinishedByNfl(
      season.seasonYear,
      season.regularSeasonEndWeek,
      nfl,
    );
  }

  const gate = {
    leagueType: season.leagueType,
    seasonStatus: season.status,
    nextSeasonExists: Boolean(next),
    playoffsEnabled: playoffs.enabled,
    championTeamId,
    regularSeasonFinished,
  };

  return {
    nextSeasonYear,
    eligible: canStartNewDynastySeason(gate),
    error: denialForSeasonRoll(gate),
    rankedTeams,
  };
}
