import { PlayersDataTable } from "@/components/rankings/players-data-table";
import { IrLockAlert } from "@/components/team/ir-lock-alert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import { isRosterTransactionsEnabled } from "@/lib/leagues/free-agency";
import {
  formatIrLockMessage,
  getIrLockViolations,
  IR_ACQUISITION_LOCK_REASON,
} from "@/lib/leagues/ir-lock";
import type { ScoringPreset } from "@/lib/leagues/scoring";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import { getStartedNflTeamAbbreviations } from "@/lib/leagues/waivers/game-lock";
import { resolvePlayerAcquisitionKind } from "@/lib/leagues/waivers/resolve-kind";
import type { PositionFilter } from "@/lib/rankings/column-config";
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
  team: string;
  rookiesOnly: boolean;
  freeAgentsOnly: boolean;
  scoringPreset: ScoringPreset;
  scoringRules: ScoringRuleDefinition[];
  sort: string;
  sortDesc: boolean;
  currentSeason: string;
  previousSeason: string;
  waiversEnabled: boolean;
  tradesEnabled: boolean;
  seasonSettings: LeagueSeasonSettings;
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
  team,
  rookiesOnly,
  freeAgentsOnly,
  scoringPreset,
  scoringRules,
  sort,
  sortDesc,
  currentSeason,
  previousSeason,
  waiversEnabled,
  tradesEnabled,
  seasonSettings,
  nflState,
}: LeaguePlayersTableProps) {
  let players: RankedPlayerRow[] = [];
  let setupError: string | null = null;
  let ownershipError: string | null = null;
  let ownershipMap: Awaited<
    ReturnType<typeof getLeaguePlayerOwnershipMap>
  > = new Map();
  let actionsEnabled = isRosterTransactionsEnabled({
    status: seasonStatus,
    freeAgencyOpen,
  });

  const [playersResult, teams, watchlistIds, ownershipResult, userTeam] =
    await Promise.all([
      getRankedPlayers({
        season: seasonYear,
        week,
        kind,
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
    ]);

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
  const acquisitionsLocked = irViolations.length > 0;
  const acquisitionLockReason = acquisitionsLocked
    ? formatIrLockMessage(irViolations)
    : IR_ACQUISITION_LOCK_REASON;

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

  const wire = resolveWaiverWireSettings(seasonSettings.waiverWire);
  let startedNflTeams = new Set<string>();
  if (
    waiversEnabled &&
    wire.waiverPool === "drops_and_free_agents" &&
    actionsEnabled
  ) {
    try {
      const nflWeek = Math.max(1, Number(nflState.week) || 1);
      const board = await getNflScoreboard({
        season: Number(nflState.season) || new Date().getUTCFullYear(),
        week: nflWeek,
      });
      startedNflTeams = getStartedNflTeamAbbreviations(board.games);
    } catch {
      startedNflTeams = new Set();
    }
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

      <PlayersDataTable
        currentSeason={currentSeason}
        data={players}
        initialWatchlistIds={watchlistIds}
        leagueSlug={slug}
        previousSeason={previousSeason}
        seasons={seasons}
        teams={teams}
        actionsEnabled={actionsEnabled}
        tradesEnabled={tradesEnabled && actionsEnabled}
        acquisitionsLocked={acquisitionsLocked}
        acquisitionLockReason={acquisitionLockReason}
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
        }}
        showScoringSelect={false}
      />
    </>
  );
}
