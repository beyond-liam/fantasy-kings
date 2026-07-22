"use client";

import { functionalUpdate, type ColumnFiltersState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import { getPlayersColumns } from "@/components/rankings/players-columns";
import { WatchlistProvider } from "@/components/rankings/watchlist-provider";
import { RankingsTableToolbar } from "@/components/rankings/rankings-table-toolbar";
import {
  RankingsToolbar,
  type RankingsViewState,
} from "@/components/rankings/rankings-toolbar";
import { useRankingsParams } from "@/components/rankings/use-rankings-params";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import type { RankedPlayerRow } from "@/lib/queries/players";
import { parsePositionFilter } from "@/lib/rankings/column-config";
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
};

type ClientView = Pick<
  RankingsViewState,
  "position" | "team" | "rookiesOnly" | "freeAgentsOnly" | "sort" | "sortDesc"
>;

function clientViewFromUrl(): ClientView {
  if (typeof window === "undefined") {
    return {
      position: "QB",
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
    position: parsePositionFilter(params.get("position")),
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
}: PlayersDataTableProps) {
  const updateParams = useRankingsParams();
  const showWatchlist = Boolean(leagueSlug);
  const isLeagueView = Boolean(leagueSlug);

  const [clientView, setClientView] = useState<ClientView>(() => ({
    position: serverView.position,
    team: serverView.team,
    rookiesOnly: serverView.rookiesOnly,
    freeAgentsOnly: serverView.freeAgentsOnly,
    sort: serverView.sort,
    sortDesc: serverView.sortDesc,
  }));

  // Keep client filters in sync after server navigations (season/week/kind).
  useEffect(() => {
    setClientView({
      position: serverView.position,
      team: serverView.team,
      rookiesOnly: serverView.rookiesOnly,
      freeAgentsOnly: serverView.freeAgentsOnly,
      sort: serverView.sort,
      sortDesc: serverView.sortDesc,
    });
  }, [
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
  ]);

  useEffect(() => {
    const syncFromUrl = () => {
      setClientView(clientViewFromUrl());
    };

    window.addEventListener("rankingsparams", syncFromUrl);
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.removeEventListener("rankingsparams", syncFromUrl);
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

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
      }),
    [
      view.position,
      showWatchlist,
      leagueSlug,
      actionsEnabled,
      tradesEnabled,
      acquisitionsLocked,
      acquisitionLockReason,
    ],
  );

  // Position/team/rookies refetch on the server. FA stays client-only (ownership).
  // Keep defensive position/team/rookies checks in case URL and payload briefly diverge.
  const filteredData = useMemo(() => {
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
      />
      <DataTable
        table={table}
        layout="fixed"
        emptyMessage="No players match your filters."
        rowLabel={{ singular: "player", plural: "players" }}
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
