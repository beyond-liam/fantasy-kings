import { TeamRosterSections } from "@/components/team/roster-sections";
import {
  loadMyTeamNflContext,
  withPlayerOpponent,
} from "@/components/team/panels/load-my-team-nfl-context";
import { formatPersonName } from "@/lib/account/person-name";
import { ensureProfile } from "@/lib/auth/session";
import type { RosterSlotConfig, ScheduleSettings } from "@/db/schema/league-seasons";
import { loadStartedNflTeamsForLineupLock } from "@/lib/leagues/lineup-lock-started";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import { resolveTransactionRules } from "@/lib/leagues/transaction-rules";
import {
  formatWaiverPriority,
  resolveTeamSummaryMatchups,
  type TeamSummaryScheduleRow,
} from "@/lib/leagues/team-summary";
import { hasNflTeamStarted } from "@/lib/leagues/waivers/game-lock";
import { getTeamSchedule } from "@/lib/queries/matchups";
import { getRankedPlayers } from "@/lib/queries/players";
import { getPlayerRosterRatesMap } from "@/lib/queries/player-roster-rates";
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
}: MyTeamRosterPanelProps) {
  await ensureTeamRosterSlotsAssigned({
    teamId: team.id,
    rosterSlots: season.settings.rosterSlots,
    benchSlots: season.benchSlots,
    irEnabled: season.irEnabled,
    taxiEnabled: season.taxiEnabled,
  });

  const [
    { fantasyWeek, nflWeek, nflSeason, nflSeasonType, opponentsByTeam },
    rosterPlayers,
    teamScheduleRows,
    profile,
  ] = await Promise.all([
    loadMyTeamNflContext({
      seasonYear: season.seasonYear,
      schedule: season.settings.schedule,
    }),
    getTeamRosterPlayers(team.id),
    getTeamSchedule(season.id, team.id),
    ensureProfile(user),
  ]);

  const ratePlayerIds = rosterPlayers.map((player) => player.id);
  const [rosterRates, weekProjections, weekStats] = await Promise.all([
    getPlayerRosterRatesMap(ratePlayerIds),
    getRankedPlayers({
      season: nflSeason,
      week: nflWeek,
      seasonType: nflSeasonType,
      kind: "projection",
      scoringRules,
      playerIds: ratePlayerIds,
    }).catch(() => []),
    getRankedPlayers({
      season: nflSeason,
      week: nflWeek,
      seasonType: nflSeasonType,
      kind: "stats",
      scoringRules,
      playerIds: ratePlayerIds,
    }).catch(() => []),
  ]);

  const projectedById = new Map(
    weekProjections.map((player) => [player.id, player.fantasyPts]),
  );
  const actualById = new Map(
    weekStats.map((player) => [player.id, player.fantasyPts]),
  );
  const rosterPlayersWithRates = rosterPlayers.map((player) => {
    const rates = rosterRates.get(player.id);
    return withPlayerOpponent(
      {
        ...player,
        actualPts: actualById.get(player.id) ?? null,
        projectedPts: projectedById.get(player.id) ?? null,
        ownedPct: rates?.ownedPct ?? null,
        startPct: rates?.startPct ?? null,
      },
      nflWeek,
      opponentsByTeam,
      { seasonYear: season.seasonYear, seasonType: nflSeasonType },
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
    ? await loadStartedNflTeamsForLineupLock()
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
      summary={{
        waiverPriorityLabel: season.waiversEnabled
          ? formatWaiverPriority(team.waiverPriority)
          : null,
        ownerName: formatPersonName(profile),
        ownerUserId: user.id,
        previous,
        current,
        myTeamSlug: team.publicId ?? team.slug,
      }}
    />
  );
}
