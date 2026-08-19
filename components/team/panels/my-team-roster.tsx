import { TeamRosterSections } from "@/components/team/roster-sections";
import {
  loadMyTeamNflContext,
  withPlayerOpponent,
} from "@/components/team/panels/load-my-team-nfl-context";
import { formatPersonName } from "@/lib/account/person-name";
import { ensureProfile } from "@/lib/auth/session";
import type { RosterSlotConfig, ScheduleSettings } from "@/db/schema/league-seasons";
import { loadFantasyWeekLineupLockState } from "@/lib/leagues/lineup-lock-started";
import { overlayPlanSlots } from "@/lib/leagues/lineup-plans";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import { resolveTransactionRules } from "@/lib/leagues/transaction-rules";
import {
  formatWaiverPriority,
  resolveTeamSummaryMatchups,
  type TeamSummaryScheduleRow,
} from "@/lib/leagues/team-summary";
import { hasNflTeamStarted } from "@/lib/leagues/waivers/game-lock";
import {
  resolveFantasyMatchupWeek,
  type FantasyMatchupWeekResolution,
} from "@/lib/leagues/matchup-week";
import { getTeamSchedule } from "@/lib/queries/matchups";
import { getTeamLineupPlanSlots } from "@/lib/queries/lineup-plans";
import {
  ensureTeamRosterSlotsAssignedForWeek,
  getTeamRosterPlayers,
} from "@/lib/queries/team-roster";
import { applyRosterPlayerEnrichment } from "@/lib/roster-enrichment/apply-enrichment";
import { loadRosterEnrichment } from "@/lib/roster-enrichment/load-roster-enrichment";
import { serializeRosterPlayersForClient } from "@/lib/roster-enrichment/serialize-roster-player";
import { seedTeamRosterDisplayCache } from "@/lib/queries/team-roster-display-cache";
import type { TeamRosterPlayer } from "@/lib/leagues/roster-fill";

export type MyTeamRosterPanelProps = {
  slug: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string; name?: string };
  };
  team: {
    id: string;
    name: string;
    publicId: string | null;
    slug: string | null;
    waiverPriority: number | null;
  };
  season: {
    id: string;
    seasonYear: number;
    benchSlots: number;
    irEnabled: boolean;
    irSlots: number;
    taxiEnabled: boolean;
    taxiSlots: number;
    waiversEnabled: boolean;
    tradesEnabled: boolean;
    regularSeasonEndWeek: number;
    settings: {
      rosterSlots: RosterSlotConfig[];
      irEligibleStatuses?: string[];
      taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
      taxiPreventReaddAfterActivation?: boolean;
      schedule?: ScheduleSettings | null;
      transactionRules?: Parameters<typeof resolveTransactionRules>[0];
    };
  };
  scoringRules: ScoringRuleDefinition[];
  actionsEnabled: boolean;
  lineupEnabled: boolean;
  tradesEnabled: boolean;
  requestedWeek?: number | null;
  /** When provided (e.g. from my-team page), skips duplicate week resolution. */
  matchupWeek?: FantasyMatchupWeekResolution;
  /** When provided, skips the roster DB read (page already loaded players). */
  preloadedRosterPlayers?: TeamRosterPlayer[];
};

export async function MyTeamRosterPanel({
  slug,
  user,
  team,
  season,
  scoringRules,
  actionsEnabled,
  lineupEnabled,
  tradesEnabled,
  requestedWeek = null,
  matchupWeek: matchupWeekProp,
  preloadedRosterPlayers,
}: MyTeamRosterPanelProps) {
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

  const [
    nflContext,
    loadedRosterPlayers,
    teamScheduleRows,
    profile,
  ] = await Promise.all([
    loadMyTeamNflContext({
      seasonYear: season.seasonYear,
      schedule: season.settings.schedule,
      fantasyWeek,
    }),
    preloadedRosterPlayers
      ? Promise.resolve(preloadedRosterPlayers)
      : getTeamRosterPlayers(team.id),
    getTeamSchedule(season.id, team.id),
    ensureProfile(user),
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

  seedTeamRosterDisplayCache(team.id, rosterPlayers);

  const shellPlayers = rosterPlayers.map((player) =>
    withPlayerOpponent(player, nflWeek, opponentsByTeam, {
      seasonYear: season.seasonYear,
      seasonType: nflSeasonType,
    }),
  );

  const preventCutsAfterGameStart = resolveTransactionRules(
    season.settings.transactionRules,
  ).preventCutsAfterGameStart;

  const [enrichment, lockState] = await Promise.all([
    loadRosterEnrichment({
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
    }),
    preventCutsAfterGameStart && fantasyWeek <= currentWeek
      ? loadFantasyWeekLineupLockState({
          schedule: season.settings.schedule,
          fantasyWeek,
          seasonYear: season.seasonYear,
        })
      : Promise.resolve({
          startedNflTeams: null as Set<string> | null,
          slateFinalized: false,
        }),
  ]);

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

  const gameLockedPlayerIds =
    lockState.startedNflTeams != null
      ? players
          .filter((player) =>
            hasNflTeamStarted(player.nflTeam, lockState.startedNflTeams!),
          )
          .map((player) => player.id)
      : [];

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
      actionsEnabled={lineupEnabled}
      rowActionsEnabled={actionsEnabled || tradesEnabled}
      cutActionsEnabled={actionsEnabled}
      tradesEnabled={tradesEnabled}
      gameLockedPlayerIds={gameLockedPlayerIds}
      slateFinalized={lockState.slateFinalized}
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
        ownerName: formatPersonName(profile),
        previous,
        current,
        myTeamSlug: team.publicId ?? team.slug,
      }}
    />
  );
}
