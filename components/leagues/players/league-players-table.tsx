import type { LeagueDraftTableActions } from "@/components/leagues/draft/draft-player-action";
import { PlayersDataTable } from "@/components/rankings/players-data-table";
import { IrLockAlert } from "@/components/team/ir-lock-alert";
import { TaxiLockAlert } from "@/components/team/taxi-lock-alert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { draftAllowsPicks } from "@/lib/leagues/draft/allows-picks";
import { isRosterTransactionsEnabled } from "@/lib/leagues/free-agency";
import {
  formatIrLockMessage,
  getIrLockViolations,
  IR_ACQUISITION_LOCK_REASON,
} from "@/lib/leagues/ir-lock";
import {
  formatTaxiLockMessage,
  getTaxiLockViolations,
} from "@/lib/leagues/taxi-lock";
import { resolveTaxiMaxYearsExp } from "@/lib/leagues/taxi-eligibility";
import type { ScoringPreset } from "@/lib/leagues/scoring";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import { isWaiverClaimOrderLocked } from "@/lib/leagues/waivers/calendar";
import { resolvePlayerAcquisitionKind } from "@/lib/leagues/waivers/resolve-kind";
import { getGameWeekCloseState } from "@/lib/nfl/current-week-board";
import type { PositionFilter } from "@/lib/rankings/column-config";
import { playersPageOffset } from "@/lib/rankings/players-page";
import { sortRankedPlayers } from "@/lib/rankings/sort-ranked-players";
import { getDraftBySeasonId, getDraftRoomData } from "@/lib/queries/draft";
import { isDraftUnderway } from "@/lib/queries/leagues";
import {
  getNflTeams,
  getRankedPlayers,
  type RankedPlayerRow,
} from "@/lib/queries/players";
import {
  getLeaguePlayerOwnershipMap,
  resolvePlayerOwnership,
} from "@/lib/queries/roster";
import { getTeamRosterPlayers } from "@/lib/queries/team-roster";
import { getTeamPendingClaimPlayerIds } from "@/lib/queries/waivers";
import {
  getSeasonWatchlistPlayerIds,
  getUserTeamForSeason,
} from "@/lib/queries/watchlist";
import { playerTableWeekItems, resolvePlayerScorePoint } from "@/lib/leagues/schedule/player-score-point";
import { countingGamesHaveStarted, resolveTablePositionRanks } from "@/lib/rankings/table-rank-source";
import type { SleeperNflState } from "@/lib/sleeper/api";

type LeaguePlayersTableProps = {
  slug: string;
  userId: string;
  seasonId: string;
  seasonStatus: string;
  freeAgencyOpen: boolean;
  seasonYear: string;
  week: number;
  weekParam: string;
  kind: "projection" | "stats";
  position: PositionFilter;
  /** League roster positions for the filter UI. */
  positions: PositionFilter[];
  team: string;
  rookiesOnly: boolean;
  freeAgentsOnly: boolean;
  scoringPreset: ScoringPreset;
  scoringRules: ScoringRuleDefinition[];
  sort: string;
  sortDesc: boolean;
  page: number;
  pageSize: number;
  search?: string;
  currentSeason: string;
  previousSeason: string;
  waiversEnabled: boolean;
  tradesEnabled: boolean;
  seasonSettings: LeagueSeasonSettings;
  benchSlots: number;
  isCommissioner: boolean;
  nflState: SleeperNflState;
};

/** Fetches players + ownership inside Suspense so the page chrome can stream. */
export async function LeaguePlayersTable({
  slug,
  userId,
  seasonId,
  seasonStatus,
  freeAgencyOpen,
  seasonYear,
  week,
  weekParam,
  kind,
  position,
  positions,
  team,
  rookiesOnly,
  freeAgentsOnly,
  scoringPreset,
  scoringRules,
  sort,
  sortDesc,
  page,
  pageSize,
  search,
  currentSeason,
  previousSeason,
  waiversEnabled,
  tradesEnabled,
  seasonSettings,
  benchSlots,
  isCommissioner,
  nflState,
}: LeaguePlayersTableProps) {
  let players: RankedPlayerRow[] = [];
  let setupError: string | null = null;
  let ownershipError: string | null = null;
  let ownershipMap: Awaited<
    ReturnType<typeof getLeaguePlayerOwnershipMap>
  > = new Map();
  let actionsEnabled = false;

  const scorePoint = resolvePlayerScorePoint({
    selectedWeek: week,
    kind,
    nfl: nflState,
    schedule: seasonSettings.schedule,
    seasonYear: Number(seasonYear),
  });
  const statsPoint = resolvePlayerScorePoint({
    selectedWeek: week,
    kind: "stats",
    nfl: nflState,
    schedule: seasonSettings.schedule,
    seasonYear: Number(seasonYear),
  });
  const countingStatsPoint = resolvePlayerScorePoint({
    selectedWeek: 0,
    kind: "stats",
    nfl: nflState,
    schedule: seasonSettings.schedule,
    seasonYear: Number(seasonYear),
  });

  const [playersResult, teams, watchlistIds, ownershipResult, userTeam, draft] =
    await Promise.all([
      getRankedPlayers({
        season: seasonYear,
        week: scorePoint.week,
        seasonType: scorePoint.seasonType,
        kind,
        positionRanks: resolveTablePositionRanks({
          kind,
          scorePoint,
          statsPoint: countingStatsPoint,
          isCurrentSeason: seasonYear === currentSeason,
        }),
        scoringRules,
        position,
        team: team !== "ALL" ? team : undefined,
        rookiesOnly: rookiesOnly || undefined,
      }).then(
        (rows) => ({ ok: true as const, rows }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
      getNflTeams(),
      getSeasonWatchlistPlayerIds(seasonId, userId),
      getLeaguePlayerOwnershipMap(seasonId, userId).then(
        (map) => ({ ok: true as const, map }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
      getUserTeamForSeason(seasonId, userId),
      getDraftBySeasonId(seasonId),
    ]);

  let draftActions: LeagueDraftTableActions | undefined;
  if (isDraftUnderway(draft?.status)) {
    const draftRoom = await getDraftRoomData({
      leagueSeasonId: seasonId,
      settings: seasonSettings,
      benchSlots,
    });
    const draftLive = draftAllowsPicks({
      status: draftRoom.draft?.status,
      pausedByWindow: draftRoom.draft?.pausedByWindow,
    });
    const myDraftTeamId =
      draftRoom.teams.find((teamRow) => teamRow.userId === userId)?.id ?? null;
    const isMyTurn = Boolean(
      draftLive &&
        draftRoom.onTheClock &&
        myDraftTeamId &&
        draftRoom.onTheClock.teamId === myDraftTeamId,
    );
    draftActions = {
      draftLive,
      isMyTurn,
      isCommissioner,
      draftedPlayerIds: Array.from(draftRoom.draftedPlayerIds),
    };
  } else {
    actionsEnabled = isRosterTransactionsEnabled(
      {
        status: seasonStatus,
        freeAgencyOpen,
      },
      draft?.status,
    );
  }

  const [rosterPlayers, pendingClaimPlayerIds] = await Promise.all([
    userTeam ? getTeamRosterPlayers(userTeam.id) : Promise.resolve([]),
    userTeam
      ? getTeamPendingClaimPlayerIds(userTeam.id)
      : Promise.resolve([]),
  ]);
  const pendingClaimIdSet = new Set(pendingClaimPlayerIds);
  const irViolations = getIrLockViolations(
    rosterPlayers,
    seasonSettings.irEligibleStatuses,
  );
  const taxiViolations = getTaxiLockViolations(
    rosterPlayers,
    resolveTaxiMaxYearsExp(seasonSettings.taxiMaxYearsExp),
  );
  const acquisitionsLocked =
    irViolations.length > 0 || taxiViolations.length > 0;
  const acquisitionLockReason = (() => {
    if (irViolations.length > 0 && taxiViolations.length > 0) {
      return `${formatIrLockMessage(irViolations)} ${formatTaxiLockMessage(taxiViolations)}`;
    }
    if (irViolations.length > 0) {
      return formatIrLockMessage(irViolations);
    }
    if (taxiViolations.length > 0) {
      return formatTaxiLockMessage(taxiViolations);
    }
    return IR_ACQUISITION_LOCK_REASON;
  })();

  if (ownershipResult.ok) {
    ownershipMap = ownershipResult.map;
  } else {
    actionsEnabled = false;
    const message =
      ownershipResult.error instanceof Error
        ? ownershipResult.error.message
        : "Database error";
    if (
      message.includes("roster_players") ||
      message.includes("does not exist")
    ) {
      ownershipError =
        "Roster ownership data is not set up yet. Run: pnpm db:push";
    } else {
      ownershipError = message;
    }
  }

  const wire = resolveWaiverWireSettings(
    seasonSettings.waiverWire,
    seasonSettings.transactionRules?.preseasonFreeAgents,
  );
  const waiverProcessingLocked =
    waiversEnabled && isWaiverClaimOrderLocked(wire);
  let startedNflTeams = new Set<string>();
  let slateComplete = false;
  let lastKickoff: Date | null = null;
  if (
    waiversEnabled &&
    wire.waiverPool === "drops_and_free_agents" &&
    actionsEnabled
  ) {
    const close = await getGameWeekCloseState(seasonSettings.schedule);
    startedNflTeams = close.startedNflTeams;
    slateComplete = close.slateComplete;
    lastKickoff = close.lastKickoff;
  }

  if (playersResult.ok) {
    players = playersResult.rows.map((row) => {
      const ownership = resolvePlayerOwnership(ownershipMap, row.id);
      const acquisitionKind = resolvePlayerAcquisitionKind({
        waiversEnabled,
        waiverWire: wire,
        rosterTransactionsEnabled: actionsEnabled,
        fantasyTeamId: ownership.fantasyTeamId,
        onWaivers: ownership.onWaivers,
        nflTeam: row.nflTeam,
        startedNflTeams,
        slateComplete,
        lastKickoff,
        seasonYear: Number(seasonYear) || new Date().getUTCFullYear(),
        nfl: nflState,
        schedule: seasonSettings.schedule,
      });
      return {
        ...row,
        fantasyTeamId: ownership.fantasyTeamId,
        fantasyTeamName: ownership.fantasyTeamName,
        fantasyTeamSlug: ownership.fantasyTeamSlug,
        isOwnedByCurrentUser: ownership.isOwnedByCurrentUser,
        onWaivers: ownership.onWaivers,
        acquisitionKind,
        hasPendingClaim: pendingClaimIdSet.has(row.id),
      };
    });
  } else {
    const message =
      playersResult.error instanceof Error
        ? playersResult.error.message
        : "Database error";
    if (
      message.includes("player_scores") ||
      message.includes("does not exist")
    ) {
      setupError =
        "Score data is not set up yet. Run: pnpm db:push && pnpm db:seed:scores";
    } else {
      setupError = message;
    }
  }

  const seasons = Array.from(new Set([currentSeason, previousSeason]));

  // Ownership / FA filters must run after the score load; then hydrate one page only.
  const searchNeedle = search?.trim().toLowerCase() ?? "";
  const filteredPlayers = sortRankedPlayers(
    players.filter((row) => {
      if (freeAgentsOnly && row.fantasyTeamId) return false;
      if (
        searchNeedle &&
        !row.fullName.toLowerCase().includes(searchNeedle)
      ) {
        return false;
      }
      return true;
    }),
    sort,
    sortDesc,
  );
  const totalCount = filteredPlayers.length;
  const offset = playersPageOffset(page, pageSize);
  const pageRows = filteredPlayers.slice(offset, offset + pageSize);

  return (
    <>
      {setupError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load players</AlertTitle>
          <AlertDescription>{setupError}</AlertDescription>
        </Alert>
      ) : null}

      {ownershipError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load roster ownership</AlertTitle>
          <AlertDescription>{ownershipError}</AlertDescription>
        </Alert>
      ) : null}

      <IrLockAlert violations={irViolations} />
      <TaxiLockAlert violations={taxiViolations} />

      <PlayersDataTable
        currentSeason={currentSeason}
        data={pageRows}
        initialWatchlistIds={watchlistIds}
        leagueSlug={slug}
        previousSeason={previousSeason}
        seasons={seasons}
        teams={teams}
        actionsEnabled={actionsEnabled}
        tradesEnabled={tradesEnabled}
        acquisitionsLocked={acquisitionsLocked}
        acquisitionLockReason={acquisitionLockReason}
        waiverProcessingLocked={waiverProcessingLocked}
        draftActions={draftActions}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        view={{
          season: seasonYear,
          week: weekParam === "0" ? "season" : weekParam,
          kind,
          position,
          team,
          rookiesOnly,
          freeAgentsOnly,
          scoring: scoringPreset,
          sort,
          sortDesc,
          search: search ?? "",
          seasonStarted: countingGamesHaveStarted(statsPoint),
        }}
        showScoringSelect={false}
        positions={positions}
        weekItems={playerTableWeekItems(seasonSettings.schedule)}
      />
    </>
  );
}
