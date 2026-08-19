import { TeamRosterSections } from "@/components/team/roster-sections";
import {
  loadMyTeamNflContext,
  withPlayerOpponent,
} from "@/components/team/panels/load-my-team-nfl-context";
import { formatPersonName } from "@/lib/account/person-name";
import { ensureProfile } from "@/lib/auth/session";
import type { RosterSlotConfig, ScheduleSettings } from "@/db/schema/league-seasons";
import { loadStartedNflTeamsForLineupLock } from "@/lib/leagues/lineup-lock-started";
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
} from "@/lib/leagues/matchup-week";
import { getTeamSchedule } from "@/lib/queries/matchups";
import {
  getRankedPlayers,
  getWeekProjectedFantasyPoints,
} from "@/lib/queries/players";
import { getPlayerRosterRatesMap } from "@/lib/queries/player-roster-rates";
import {
  getRosterTableStatMap,
  withRosterTableStats,
} from "@/lib/queries/team-player-stats";
import { getPositionalSosTable } from "@/lib/queries/positional-sos";
import { getTeamLineupPlanSlots } from "@/lib/queries/lineup-plans";
import {
  ensureTeamRosterSlotsAssigned,
  getTeamRosterPlayers,
} from "@/lib/queries/team-roster";

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
}: MyTeamRosterPanelProps) {
  const { week: fantasyWeek, weeks, currentWeek } = await resolveFantasyMatchupWeek({
    seasonYear: season.seasonYear,
    nflRegularSeasonEndWeek: season.regularSeasonEndWeek,
    schedule: season.settings.schedule,
    requestedWeek,
  });

  await ensureTeamRosterSlotsAssigned({
    teamId: team.id,
    rosterSlots: season.settings.rosterSlots,
    benchSlots: season.benchSlots,
    irEnabled: season.irEnabled,
    taxiEnabled: season.taxiEnabled,
    leagueSeasonId: season.id,
    schedule: season.settings.schedule,
    seasonYear: season.seasonYear,
    regularSeasonEndWeek: season.regularSeasonEndWeek,
    currentWeek,
  });

  const [
    { nflWeek, nflSeason, nflSeasonType, opponentsByTeam, nflState },
    loadedRosterPlayers,
    teamScheduleRows,
    profile,
  ] = await Promise.all([
    loadMyTeamNflContext({
      seasonYear: season.seasonYear,
      schedule: season.settings.schedule,
      fantasyWeek,
    }),
    getTeamRosterPlayers(team.id),
    getTeamSchedule(season.id, team.id),
    ensureProfile(user),
  ]);

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

  const ratePlayerIds = rosterPlayers.map((player) => player.id);
  const [rosterRates, projectedById, weekStats, tableStats, sos] =
    await Promise.all([
    getPlayerRosterRatesMap(ratePlayerIds),
    getWeekProjectedFantasyPoints({
      season: nflSeason,
      week: nflWeek,
      seasonType: nflSeasonType,
      scoringRules,
      playerIds: ratePlayerIds,
    }),
    getRankedPlayers({
      season: nflSeason,
      week: nflWeek,
      seasonType: nflSeasonType,
      kind: "stats",
      scoringRules,
      playerIds: ratePlayerIds,
      preserveStats: true,
    }).catch(() => []),
    getRosterTableStatMap({
      season: nflSeason,
      playerIds: ratePlayerIds,
      scoringRules,
      nfl: nflState,
      schedule: season.settings.schedule,
    }).catch(() => new Map()),
    getPositionalSosTable({
      season: nflSeason,
      positionIds: rosterPlayers.map((player) => player.primaryPositionId),
      rules: scoringRules,
    }),
  ]);

  const actualById = new Map(
    weekStats.map((player) => [player.id, player.fantasyPts]),
  );
  const weekStatsById = new Map(
    weekStats.map((player) => [player.id, player.stats]),
  );
  const rosterPlayersWithRates = rosterPlayers.map((player) => {
    const rates = rosterRates.get(player.id);
    return withPlayerOpponent(
      withRosterTableStats(
        {
          ...player,
          actualPts: actualById.get(player.id) ?? null,
          projectedPts: projectedById.get(player.id) ?? null,
          weekStats: weekStatsById.get(player.id),
          ownedPct: rates?.ownedPct ?? null,
          startPct: rates?.startPct ?? null,
        },
        tableStats,
      ),
      nflWeek,
      opponentsByTeam,
      {
        seasonYear: season.seasonYear,
        seasonType: nflSeasonType,
        sos,
      },
    );
  });

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

  const preventCutsAfterGameStart = resolveTransactionRules(
    season.settings.transactionRules,
  ).preventCutsAfterGameStart;
  const startedTeams = preventCutsAfterGameStart
    ? await loadStartedNflTeamsForLineupLock(season.settings.schedule)
    : null;
  const gameLockedPlayerIds =
    startedTeams != null
      ? rosterPlayersWithRates
          .filter((player) => hasNflTeamStarted(player.nflTeam, startedTeams))
          .map((player) => player.id)
      : [];

  return (
    <TeamRosterSections
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
      players={rosterPlayersWithRates}
      leagueSlug={slug}
      actionsEnabled={lineupEnabled}
      rowActionsEnabled={actionsEnabled || tradesEnabled}
      cutActionsEnabled={actionsEnabled}
      tradesEnabled={tradesEnabled}
      gameLockedPlayerIds={gameLockedPlayerIds}
      scoringRules={scoringRules}
      scoringWeek={fantasyWeek}
      week={fantasyWeek}
      currentWeek={currentWeek}
      weeks={weeks}
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
