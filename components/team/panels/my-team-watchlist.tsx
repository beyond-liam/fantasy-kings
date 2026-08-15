import type { ScheduleSettings, WaiverWireSettings } from "@/db/schema/league-seasons";
import { WatchlistProvider } from "@/components/rankings/watchlist-provider";
import { TeamWatchlistSection } from "@/components/team/watchlist-section";
import {
  loadMyTeamNflContext,
  withPlayerOpponent,
} from "@/components/team/panels/load-my-team-nfl-context";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import { getStartedNflTeamAbbreviations } from "@/lib/leagues/waivers/game-lock";
import { resolvePlayerAcquisitionKind } from "@/lib/leagues/waivers/resolve-kind";
import { getRankedPlayers, getWeekProjectedFantasyPoints } from "@/lib/queries/players";
import { getPlayerRosterRatesMap } from "@/lib/queries/player-roster-rates";
import {
  getRosterTableStatMap,
  withRosterTableStats,
} from "@/lib/queries/team-player-stats";
import {
  getLeaguePlayerOwnershipMap,
  getTeamRosteredPlayerIds,
  resolvePlayerOwnership,
} from "@/lib/queries/roster";
import { getTeamPendingClaimPlayerIds } from "@/lib/queries/waivers";
import {
  getLeagueWatchlistPlayerIds,
  getTeamWatchlist,
} from "@/lib/queries/watchlist";

export type MyTeamWatchlistPanelProps = {
  slug: string;
  userId: string;
  teamId: string | null;
  seasonId: string;
  seasonYear: number;
  schedule?: ScheduleSettings | null;
  waiversEnabled: boolean;
  scoringRules: ScoringRuleDefinition[];
  actionsEnabled: boolean;
  wire: WaiverWireSettings;
  acquisitionsLocked: boolean;
  acquisitionLockReason: string;
  waiverProcessingLocked: boolean;
};

export async function MyTeamWatchlistPanel({
  slug,
  userId,
  teamId,
  seasonId,
  seasonYear,
  schedule,
  waiversEnabled,
  scoringRules,
  actionsEnabled,
  wire,
  acquisitionsLocked,
  acquisitionLockReason,
  waiverProcessingLocked,
}: MyTeamWatchlistPanelProps) {
  const [
    { nflWeek, nflSeason, nflSeasonType, nflState, scoreboard, opponentsByTeam },
    watchlistPlayers,
    watchlistIds,
    ownershipMap,
    pendingClaimPlayerIds,
    rosterPlayerIds,
  ] = await Promise.all([
    loadMyTeamNflContext({ seasonYear, schedule }),
    teamId ? getTeamWatchlist(teamId) : Promise.resolve([]),
    getLeagueWatchlistPlayerIds(slug, userId),
    getLeaguePlayerOwnershipMap(seasonId, userId).catch(() => new Map()),
    teamId ? getTeamPendingClaimPlayerIds(teamId) : Promise.resolve([]),
    teamId ? getTeamRosteredPlayerIds(teamId) : Promise.resolve([]),
  ]);

  let startedNflTeams = new Set<string>();
  if (
    scoreboard &&
    waiversEnabled &&
    wire.waiverPool === "drops_and_free_agents" &&
    actionsEnabled
  ) {
    startedNflTeams = getStartedNflTeamAbbreviations(scoreboard.games);
  }

  const pendingClaimIdSet = new Set(pendingClaimPlayerIds);
  const ratePlayerIds = [
    ...new Set([
      ...rosterPlayerIds,
      ...watchlistPlayers.map((player) => player.id),
    ]),
  ];
  const [rosterRates, projectedById, weekStats, tableStats] = await Promise.all([
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
    }).catch(() => []),
    getRosterTableStatMap({
      season: nflSeason,
      playerIds: ratePlayerIds,
      scoringRules,
      nfl: nflState,
      schedule,
    }).catch(() => new Map()),
  ]);

  const actualById = new Map(
    weekStats.map((player) => [player.id, player.fantasyPts]),
  );
  const playersWithOwnership = watchlistPlayers.map((player) => {
    const ownership = resolvePlayerOwnership(ownershipMap, player.id);
    const rates = rosterRates.get(player.id);
    const acquisitionKind = resolvePlayerAcquisitionKind({
      waiversEnabled,
      waiverWire: wire,
      rosterTransactionsEnabled: actionsEnabled,
      fantasyTeamId: ownership.fantasyTeamId,
      onWaivers: ownership.onWaivers,
      nflTeam: player.nflTeam,
      startedNflTeams,
      seasonYear,
      nfl: nflState,
      schedule,
    });
    return withPlayerOpponent(
      withRosterTableStats(
        {
          ...player,
          fantasyTeamId: ownership.fantasyTeamId,
          fantasyTeamName: ownership.fantasyTeamName,
          isOwnedByCurrentUser: ownership.isOwnedByCurrentUser,
          onWaivers: ownership.onWaivers,
          acquisitionKind,
          hasPendingClaim: pendingClaimIdSet.has(player.id),
          ownedPct: rates?.ownedPct ?? null,
          startPct: rates?.startPct ?? null,
          actualPts: actualById.get(player.id) ?? null,
          projectedPts: projectedById.get(player.id) ?? null,
        },
        tableStats,
      ),
      nflWeek,
      opponentsByTeam,
      { seasonYear, seasonType: nflSeasonType },
    );
  });

  return (
    <WatchlistProvider leagueSlug={slug} initialPlayerIds={watchlistIds}>
      <TeamWatchlistSection
        players={playersWithOwnership}
        leagueSlug={slug}
        actionsEnabled={actionsEnabled}
        acquisitionsLocked={acquisitionsLocked}
        acquisitionLockReason={acquisitionLockReason}
        waiverProcessingLocked={waiverProcessingLocked}
      />
    </WatchlistProvider>
  );
}
