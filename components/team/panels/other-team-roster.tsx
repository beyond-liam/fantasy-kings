import { TeamRosterSections } from "@/components/team/roster-sections";
import {
  loadMyTeamNflContext,
  withPlayerOpponent,
} from "@/components/team/panels/load-my-team-nfl-context";
import type { RosterSlotConfig, ScheduleSettings } from "@/db/schema/league-seasons";
import { overlayPlanSlots } from "@/lib/leagues/lineup-plans";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import {
  formatWaiverPriority,
  resolveTeamSummaryMatchups,
  type TeamSummaryScheduleRow,
} from "@/lib/leagues/team-summary";
import {
  resolveFantasyMatchupWeek,
  type FantasyMatchupWeekResolution,
} from "@/lib/leagues/matchup-week";
import type { TeamRosterPlayer } from "@/lib/leagues/roster-fill";
import { getTeamSchedule } from "@/lib/queries/matchups";
import { getTeamLineupPlanSlots } from "@/lib/queries/lineup-plans";
import {
  ensureTeamRosterSlotsAssignedForWeek,
  getTeamRosterPlayers,
} from "@/lib/queries/team-roster";
import { applyRosterPlayerEnrichment } from "@/lib/roster-enrichment/apply-enrichment";
import { loadRosterEnrichment } from "@/lib/roster-enrichment/load-roster-enrichment";
import { serializeRosterPlayersForClient } from "@/lib/roster-enrichment/serialize-roster-player";

export type OtherTeamRosterPanelProps = {
  slug: string;
  team: {
    id: string;
    name: string;
    publicId: string | null;
    slug: string | null;
    waiverPriority: number | null;
    ownerName: string | null;
  };
  season: {
    id: string;
    seasonYear: number;
    regularSeasonEndWeek: number;
    benchSlots: number;
    irEnabled: boolean;
    irSlots: number;
    taxiEnabled: boolean;
    taxiSlots: number;
    waiversEnabled: boolean;
    settings: {
      rosterSlots: RosterSlotConfig[];
      irEligibleStatuses?: string[];
      taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
      taxiPreventReaddAfterActivation?: boolean;
      schedule?: ScheduleSettings | null;
    };
  };
  scoringRules: ScoringRuleDefinition[];
  tradesEnabled: boolean;
  myTeamSlug?: string | null;
  requestedWeek?: number | null;
  matchupWeek?: FantasyMatchupWeekResolution;
  preloadedRosterPlayers?: TeamRosterPlayer[];
};

export async function OtherTeamRosterPanel({
  slug,
  team,
  season,
  scoringRules,
  tradesEnabled,
  myTeamSlug = null,
  requestedWeek = null,
  matchupWeek: matchupWeekProp,
  preloadedRosterPlayers,
}: OtherTeamRosterPanelProps) {
  const matchupWeek =
    matchupWeekProp ??
    (await resolveFantasyMatchupWeek({
      seasonYear: season.seasonYear,
      nflRegularSeasonEndWeek: season.regularSeasonEndWeek,
      schedule: season.settings.schedule,
      requestedWeek,
    }));
  const { week: fantasyWeek, weeks, currentWeek } = matchupWeek;

  await ensureTeamRosterSlotsAssignedForWeek({
    teamId: team.id,
    rosterSlots: season.settings.rosterSlots,
    benchSlots: season.benchSlots,
    irEnabled: season.irEnabled,
    taxiEnabled: season.taxiEnabled,
    leagueSeasonId: season.id,
    currentWeek,
  });

  const [nflContext, loadedRosterPlayers, teamScheduleRows] = await Promise.all([
    loadMyTeamNflContext({
      seasonYear: season.seasonYear,
      schedule: season.settings.schedule,
      fantasyWeek,
    }),
    preloadedRosterPlayers
      ? Promise.resolve(preloadedRosterPlayers)
      : getTeamRosterPlayers(team.id),
    getTeamSchedule(season.id, team.id),
  ]);

  const { nflWeek, nflSeasonType, opponentsByTeam } = nflContext;

  const planSlots =
    fantasyWeek > currentWeek
      ? await getTeamLineupPlanSlots({
          leagueSeasonId: season.id,
          teamId: team.id,
          week: fantasyWeek,
        })
      : null;
  const rosterPlayers = planSlots
    ? overlayPlanSlots(loadedRosterPlayers, planSlots)
    : loadedRosterPlayers;

  const shellPlayers = rosterPlayers.map((player) =>
    withPlayerOpponent(player, nflWeek, opponentsByTeam, {
      seasonYear: season.seasonYear,
      seasonType: nflSeasonType,
    }),
  );

  const enrichment = await loadRosterEnrichment({
    seasonYear: season.seasonYear,
    schedule: season.settings.schedule,
    scoringRules,
    fantasyWeek,
    nflContext,
    players: rosterPlayers.map((player) => ({
      id: player.id,
      nflTeam: player.nflTeam,
      byeWeek: player.byeWeek,
      primaryPositionId: player.primaryPositionId,
    })),
  });

  const players = serializeRosterPlayersForClient(
    enrichment.ok
      ? applyRosterPlayerEnrichment(shellPlayers, enrichment.enrichmentByPlayerId)
      : shellPlayers,
  );

  const summarySchedule: TeamSummaryScheduleRow[] = teamScheduleRows.map(
    (row) => ({
      week: row.week,
      publicId: row.publicId,
      opponentName: row.opponentName,
      opponentSlug: row.opponentSlug,
      isHome: row.isHome,
      status: row.status,
      teamPts: row.isHome ? row.homePts : row.awayPts,
      opponentPts: row.isHome ? row.awayPts : row.homePts,
    }),
  );
  const { previous, current } = resolveTeamSummaryMatchups(
    summarySchedule,
    fantasyWeek,
  );

  return (
    <TeamRosterSections
      players={players}
      rosterSlots={season.settings.rosterSlots}
      benchSlots={season.benchSlots}
      irEnabled={season.irEnabled}
      irSlots={season.irSlots}
      irEligibleStatuses={season.settings.irEligibleStatuses}
      taxiEnabled={season.taxiEnabled}
      taxiSlots={season.taxiSlots}
      taxiMaxYearsExp={season.settings.taxiMaxYearsExp}
      taxiPreventReaddAfterActivation={
        season.settings.taxiPreventReaddAfterActivation === true
      }
      leagueSlug={slug}
      actionsEnabled={false}
      rowActionsEnabled={tradesEnabled}
      cutActionsEnabled={false}
      actionsVariant="opponent"
      partnerTeamSlug={team.publicId ?? team.slug ?? undefined}
      tradesEnabled={tradesEnabled}
      scoringRules={scoringRules}
      scoringWeek={fantasyWeek}
      week={fantasyWeek}
      currentWeek={currentWeek}
      weeks={weeks}
      clientWeekSwitch
      teamId={team.id}
      summary={{
        waiverPriorityLabel: season.waiversEnabled
          ? formatWaiverPriority(team.waiverPriority)
          : null,
        ownerName: team.ownerName,
        previous,
        current,
        myTeamSlug,
      }}
    />
  );
}
