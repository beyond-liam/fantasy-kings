"use client";

import { functionalUpdate, type ColumnFiltersState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import type { LeagueDraftTableActions } from "@/components/leagues/draft/draft-player-action";
import { getPlayersColumns } from "@/components/rankings/players-columns";
import { WatchlistProvider } from "@/components/rankings/watchlist-provider";
import { RankingsTableToolbar } from "@/components/rankings/rankings-table-toolbar";
import {
  RankingsToolbar,
  type RankingsViewState,
} from "@/components/rankings/rankings-toolbar";
import { useRankingsParams } from "@/components/rankings/use-rankings-params";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { useIsMobile } from "@/hooks/use-mobile";
import type { RankedPlayerRow } from "@/lib/queries/players";
import { parsePositionFilter, POSITION_FILTERS, type PositionFilter } from "@/lib/rankings/column-config";
import {
  DEFAULT_SORT_COLUMN,
  DEFAULT_SORT_DESC,
  parseSortingFromParams,
  sortingToParams,
} from "@/lib/rankings/sort-params";

type PlayersDataTableProps = {
  data: RankedPlayerRow[];
  teams: string[];
  seasons: string[];
  currentSeason: string;
  previousSeason: string;
  view: RankingsViewState;
  showScoringSelect?: boolean;
  leagueSlug?: string;
  initialWatchlistIds?: string[];
  /** League player actions (add/claim/trade/cut) — off until draft is complete. */
  actionsEnabled?: boolean;
  tradesEnabled?: boolean;
  acquisitionsLocked?: boolean;
  acquisitionLockReason?: string;
  /** When set, action column shows draft instead of add/trade. */
  draftActions?: LeagueDraftTableActions;
  /** Server-driven page of `data` (do not hydrate the full filtered set). */
  page?: number;
  pageSize?: number;
  totalCount?: number;
  /** League roster positions for the filter. Defaults to all. */
  positions?: readonly PositionFilter[];
};

type ClientView = Pick<
  RankingsViewState,
  "position" | "team" | "rookiesOnly" | "freeAgentsOnly" | "sort" | "sortDesc"
>;

function clientViewFromUrl(
  allowedPositions: readonly PositionFilter[] = POSITION_FILTERS,
): ClientView {
  if (typeof window === "undefined") {
    return {
      position: allowedPositions[0] ?? "QB",
      team: "ALL",
      rookiesOnly: false,
      freeAgentsOnly: true,
      sort: DEFAULT_SORT_COLUMN,
      sortDesc: DEFAULT_SORT_DESC,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const sortParam = params.get("sort");
  const sortDir = params.get("sortDir");

  return {
    // Absent param = default. Do not fall back to previous client state —
    // clearing rookies/team/position deletes the query key on purpose.
    position: parsePositionFilter(params.get("position"), allowedPositions),
    team: params.get("team") || "ALL",
    rookiesOnly: params.get("rookies") === "1",
    freeAgentsOnly: params.get("fa") !== "0",
    sort:
      sortParam === "pts_ppr"
        ? DEFAULT_SORT_COLUMN
        : (sortParam ?? DEFAULT_SORT_COLUMN),
    sortDesc: sortDir ? sortDir !== "asc" : DEFAULT_SORT_DESC,
  };
}

export function PlayersDataTable({
  data,
  teams,
  seasons,
  currentSeason,
  previousSeason,
  view: serverView,
  showScoringSelect = true,
  leagueSlug,
  initialWatchlistIds = [],
  actionsEnabled = true,
  tradesEnabled = true,
  acquisitionsLocked = false,
  acquisitionLockReason,
  draftActions,
  page = 1,
  pageSize,
  totalCount,
  positions = POSITION_FILTERS,
}: PlayersDataTableProps) {
  const updateParams = useRankingsParams();
  const isMobile = useIsMobile();
  const showWatchlist = Boolean(leagueSlug);
  const isLeagueView = Boolean(leagueSlug);
  const serverPaginated = totalCount != null && pageSize != null;
  const positionOptions =
    positions.length > 0 ? positions : POSITION_FILTERS;

  const [clientView, setClientView] = useState<ClientView>(() => ({
    position: serverView.position,
    team: serverView.team,
    rookiesOnly: serverView.rookiesOnly,
    freeAgentsOnly: serverView.freeAgentsOnly,
    sort: serverView.sort,
    sortDesc: serverView.sortDesc,
  }));

  // Keep client filters in sync after server navigations (season/week/kind).
  const serverViewKey = [
    serverView.season,
    serverView.week,
    serverView.kind,
    serverView.scoring,
    serverView.position,
    serverView.team,
    serverView.rookiesOnly,
    serverView.freeAgentsOnly,
    serverView.sort,
    serverView.sortDesc,
  ].join("|");
  const [syncedServerViewKey, setSyncedServerViewKey] =
    useState(serverViewKey);
  if (serverViewKey !== syncedServerViewKey) {
    setSyncedServerViewKey(serverViewKey);
    setClientView({
      position: serverView.position,
      team: serverView.team,
      rookiesOnly: serverView.rookiesOnly,
      freeAgentsOnly: serverView.freeAgentsOnly,
      sort: serverView.sort,
      sortDesc: serverView.sortDesc,
    });
  }

  useEffect(() => {
    const syncFromUrl = () => {
      setClientView(clientViewFromUrl(positionOptions));
    };

    window.addEventListener("rankingsparams", syncFromUrl);
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.removeEventListener("rankingsparams", syncFromUrl);
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, [positionOptions]);

  const view: RankingsViewState = {
    ...serverView,
    ...clientView,
  };

  const columns = useMemo(
    () =>
      getPlayersColumns(view.position, {
        showWatchlist,
        showLeagueOwnership: Boolean(leagueSlug),
        actionsEnabled,
        tradesEnabled,
        acquisitionsLocked,
        acquisitionLockReason,
        leagueSlug,
        draftActions,
        isMobile,
      }),
    [
      view.position,
      showWatchlist,
      leagueSlug,
      actionsEnabled,
      tradesEnabled,
      acquisitionsLocked,
      acquisitionLockReason,
      draftActions,
      isMobile,
    ],
  );

  // Position/team/rookies refetch on the server. FA also refetches (server param).
  // Keep defensive checks in case URL and payload briefly diverge.
  const filteredData = useMemo(() => {
    if (serverPaginated) {
      // Server already applied filters + page slice.
      return data;
    }
    return data.filter((row) => {
      if (row.primaryPositionId !== clientView.position) {
        return false;
      }

      if (
        !isLeagueView &&
        clientView.team !== "ALL" &&
        row.nflTeam !== clientView.team
      ) {
        return false;
      }

      if (clientView.rookiesOnly && row.yearsExp !== 0) {
        return false;
      }

      if (isLeagueView && clientView.freeAgentsOnly && row.fantasyTeamId) {
        return false;
      }

      return true;
    });
  }, [
    data,
    clientView.position,
    clientView.team,
    clientView.rookiesOnly,
    clientView.freeAgentsOnly,
    isLeagueView,
    serverPaginated,
  ]);

  const sorting = useMemo(
    () => parseSortingFromParams(clientView.sort, clientView.sortDesc),
    [clientView.sort, clientView.sortDesc],
  );

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  useEffect(() => {
    const columnIds = new Set(
      columns.map((column) => column.id).filter(Boolean) as string[],
    );

    if (!columnIds.has(clientView.sort)) {
      updateParams(sortingToParams(parseSortingFromParams()));
    }
  }, [columns, updateParams, clientView.position, clientView.sort]);

  const table = useDataTable({
    data: filteredData,
    columns,
    sorting,
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting);
      updateParams(sortingToParams(next));
    },
    columnFilters,
    onColumnFiltersChange: setColumnFilters,
    pageSize: serverPaginated ? pageSize : undefined,
    manualPagination: serverPaginated,
    pageCount: serverPaginated
      ? Math.max(1, Math.ceil(totalCount / pageSize))
      : undefined,
  });

  const content = (
    <div className="flex flex-col gap-4">
      <RankingsToolbar
        currentSeason={currentSeason}
        previousSeason={previousSeason}
        view={view}
      />
      <RankingsTableToolbar
        table={table}
        teams={teams}
        seasons={seasons}
        currentSeason={currentSeason}
        view={view}
        showScoringSelect={showScoringSelect}
        showTeamFilter={!isLeagueView}
        showFreeAgentsFilter={isLeagueView}
        positions={positionOptions}
        searchActions={
          leagueSlug
            ? {
                leagueSlug,
                showWatchlist,
                showActions: true,
                actionsEnabled,
                tradesEnabled,
                acquisitionsLocked,
                acquisitionLockReason,
                draftActions,
              }
            : undefined
        }
      />
      <DataTable
        table={table}
        layout="fixed"
        emptyMessage="No players match your filters."
        rowLabel={{ singular: "player", plural: "players" }}
        serverPagination={
          serverPaginated
            ? {
                page,
                pageSize,
                totalCount,
                onPageChange: (nextPage) => {
                  updateParams({
                    page: nextPage <= 1 ? null : String(nextPage),
                  });
                },
              }
            : undefined
        }
      />
    </div>
  );

  if (!leagueSlug) {
    return content;
  }

  return (
    <WatchlistProvider
      leagueSlug={leagueSlug}
      initialPlayerIds={initialWatchlistIds}
    >
      {content}
    </WatchlistProvider>
  );
}
