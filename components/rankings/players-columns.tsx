"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { PlayerActionButton } from "@/components/rankings/player-action-button";
import { PlayerIdentity } from "@/components/rankings/player-identity";
import { WatchlistToggle } from "@/components/rankings/watchlist-toggle";
import { DataTableColumnHeader } from "@/components/ui/data-table";
import {
  formatStatValue,
  getStatColumns,
  type PositionFilter,
} from "@/lib/rankings/column-config";
import {
  formatPositionRank,
  getAdp,
  getFantasyPts,
  getPositionRankColorClass,
} from "@/lib/rankings/stat-helpers";
import { PLAYER_STAT_COLUMNS } from "@/lib/rankings/player-stat-columns";
import type { RankedPlayerRow } from "@/lib/queries/players";

function renderStatCell(row: RankedPlayerRow, key: string, decimals?: number) {
  if (key === "adp") {
    return formatStatValue(getAdp(row.stats), decimals);
  }

  if (key === "fantasy_pts") {
    return formatStatValue(getFantasyPts(row), decimals);
  }

  return formatStatValue(row.stats[key], decimals);
}

function sortableValue(value: number | null | undefined): number | undefined {
  if (value == null) {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

const STAT_CELL_CLASS = "tabular-nums";

export function getPlayersColumns(
  position: PositionFilter,
  options?: {
    showWatchlist?: boolean;
    showLeagueOwnership?: boolean;
    actionsEnabled?: boolean;
    acquisitionsLocked?: boolean;
    acquisitionLockReason?: string;
    leagueSlug?: string;
    tradesEnabled?: boolean;
  },
): ColumnDef<RankedPlayerRow>[] {
  const statCols = getStatColumns(position);
  const showWatchlist = options?.showWatchlist ?? false;
  const showLeagueOwnership = options?.showLeagueOwnership ?? false;
  const actionsEnabled = options?.actionsEnabled ?? true;
  const acquisitionsLocked = options?.acquisitionsLocked ?? false;
  const acquisitionLockReason = options?.acquisitionLockReason;
  const leagueSlug = options?.leagueSlug ?? "";
  const tradesEnabled = options?.tradesEnabled ?? true;

  const watchlistColumn: ColumnDef<RankedPlayerRow> = {
    id: "watchlist",
    enableSorting: false,
    enableHiding: false,
    size: 40,
    meta: {
      width: 40,
      cellClassName: "px-1 text-center",
      headerClassName: "px-1",
    },
    header: () => <span className="sr-only">Watchlist</span>,
    cell: ({ row }) => <WatchlistToggle playerId={row.original.id} />,
  };

  const teamColumn: ColumnDef<RankedPlayerRow> = {
    id: "fantasyTeam",
    accessorFn: (row) => row.fantasyTeamName ?? "",
    enableSorting: false,
    size: 140,
    meta: {
      width: 140,
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Team" />
    ),
    cell: ({ row }) => {
      const name = row.original.fantasyTeamName;
      if (!name) {
        return null;
      }

      return <span className="block truncate">{name}</span>;
    },
  };

  const actionColumn: ColumnDef<RankedPlayerRow> = {
    id: "action",
    enableSorting: false,
    enableHiding: false,
    size: 72,
    meta: {
      width: 72,
      cellClassName: "px-1 text-center",
      headerClassName: "px-1",
    },
    header: () => <span className="sr-only">Action</span>,
    cell: ({ row }) => (
      <PlayerActionButton
        player={row.original}
        leagueSlug={leagueSlug}
        disabled={!actionsEnabled}
        tradesEnabled={tradesEnabled}
        acquisitionsLocked={acquisitionsLocked}
        acquisitionLockReason={acquisitionLockReason}
      />
    ),
  };

  return [
    ...(showWatchlist ? [watchlistColumn] : []),
    {
      id: "player",
      accessorFn: (row) => row.fullName,
      enableSorting: false,
      enableHiding: false,
      size: 220,
      meta: {
        width: 220,
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Player" />
      ),
      cell: ({ row }) => {
        const player = row.original;

        return (
          <PlayerIdentity
            fullName={player.fullName}
            sleeperId={player.sleeperId}
            primaryPositionId={player.primaryPositionId}
            nflTeam={player.nflTeam}
            byeWeek={player.byeWeek}
            injuryStatus={player.injuryStatus}
            playerId={player.id}
            leagueSlug={leagueSlug || null}
          />
        );
      },
      filterFn: (row, _columnId, filterValue) => {
        const query = String(filterValue).toLowerCase();
        if (!query) {
          return true;
        }

        return row.original.fullName.toLowerCase().includes(query);
      },
    },
    {
      id: "positionRank",
      accessorFn: (row) => sortableValue(row.positionRank),
      sortUndefined: "last",
      meta: {
        cellClassName: STAT_CELL_CLASS,
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={PLAYER_STAT_COLUMNS.rank.header}
          tooltip={PLAYER_STAT_COLUMNS.rank.tooltip}
        />
      ),
      cell: ({ row }) => (
        <span
          className={`block truncate font-medium ${getPositionRankColorClass(row.original.positionRank)}`}
        >
          {formatPositionRank(
            row.original.primaryPositionId,
            row.original.positionRank,
          )}
        </span>
      ),
    },
    ...statCols.map(
      (column): ColumnDef<RankedPlayerRow> => ({
        id: column.key,
        meta: {
          cellClassName: STAT_CELL_CLASS,
        },
        accessorFn: (row) =>
          column.key === "adp"
            ? sortableValue(getAdp(row.stats))
            : column.key === "fantasy_pts"
              ? sortableValue(getFantasyPts(row))
              : sortableValue(row.stats[column.key]),
        sortUndefined: "last",
        header: ({ column: tableColumn }) => (
          <DataTableColumnHeader
            column={tableColumn}
            title={column.header}
            tooltip={column.tooltip}
          />
        ),
        cell: ({ row }) => (
          <span className="block truncate">
            {renderStatCell(row.original, column.key, column.decimals)}
          </span>
        ),
      }),
    ),
    ...(showLeagueOwnership ? [teamColumn, actionColumn] : []),
  ];
}
