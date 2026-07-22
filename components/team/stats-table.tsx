"use client";

import { useMemo, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

import { PlayerIdentity } from "@/components/rankings/player-identity";
import { OpponentCell } from "@/components/team/opponent-cell";
import { TeamTableColumnHeader } from "@/components/team/team-table-column-header";
import {
  DataTable,
  DataTableColumnHeader,
  useDataTable,
} from "@/components/ui/data-table";
import type { TeamStatsSection } from "@/lib/leagues/team-stats";
import { PLAYER_STAT_COLUMNS } from "@/lib/rankings/player-stat-columns";
import {
  formatStatValue,
  getStatColumns,
  type StatColumn,
} from "@/lib/rankings/column-config";
import {
  formatPositionRank,
  getAdp,
  getFantasyPts,
  getPositionRankColorClass,
} from "@/lib/rankings/stat-helpers";
import type { RankedPlayerRow } from "@/lib/queries/players";
import { cn } from "@/lib/utils";

type TeamStatsTableProps = {
  section: TeamStatsSection;
  leagueSlug?: string | null;
};

function renderStatCell(row: RankedPlayerRow, column: StatColumn): string {
  if (column.key === "adp") {
    return formatStatValue(getAdp(row.stats), column.decimals);
  }

  if (column.key === "fantasy_pts") {
    return formatStatValue(getFantasyPts(row), column.decimals);
  }

  return formatStatValue(row.stats[column.key], column.decimals);
}

function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
) {
  const aMissing = a == null || !Number.isFinite(a);
  const bMissing = b == null || !Number.isFinite(b);
  if (aMissing && bMissing) {
    return 0;
  }
  if (aMissing) {
    return 1;
  }
  if (bMissing) {
    return -1;
  }
  return a - b;
}

export function TeamStatsTable({
  section,
  leagueSlug,
}: TeamStatsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columnPosition = section.columnPosition;

  const columns = useMemo<ColumnDef<RankedPlayerRow>[]>(() => {
    const statColumns = getStatColumns(columnPosition);

    const cols: ColumnDef<RankedPlayerRow>[] = [
      {
        id: "player",
        accessorFn: (row) => row.fullName,
        enableSorting: false,
        header: () => <TeamTableColumnHeader title="Player" />,
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
              leagueSlug={leagueSlug}
            />
          );
        },
        meta: { width: 224, cellClassName: "min-w-[14rem]" },
      },
      {
        id: "opp",
        accessorFn: (row) => row.opponent?.label ?? "",
        enableSorting: false,
        header: () => (
          <TeamTableColumnHeader title="Opp" tooltip="Opponent" />
        ),
        cell: ({ row }) => <OpponentCell opponent={row.original.opponent} />,
      },
      {
        id: "rank",
        accessorFn: (row) => row.positionRank,
        enableSorting: true,
        sortingFn: (a, b) =>
          compareNullableNumber(
            a.original.positionRank,
            b.original.positionRank,
          ),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={PLAYER_STAT_COLUMNS.rank.header}
            tooltip={PLAYER_STAT_COLUMNS.rank.tooltip}
          />
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              "font-medium tabular-nums",
              getPositionRankColorClass(row.original.positionRank),
            )}
          >
            {formatPositionRank(
              row.original.primaryPositionId,
              row.original.positionRank,
            )}
          </span>
        ),
      },
    ];

    for (const column of statColumns) {
      cols.push({
        id: column.key,
        accessorFn: (row) => {
          if (column.key === "adp") {
            return getAdp(row.stats);
          }
          if (column.key === "fantasy_pts") {
            return getFantasyPts(row);
          }
          return row.stats[column.key] ?? null;
        },
        enableSorting: true,
        sortingFn: (a, b) =>
          compareNullableNumber(
            a.getValue<number | null>(column.key),
            b.getValue<number | null>(column.key),
          ),
        header: ({ column: tableColumn }) => (
          <DataTableColumnHeader
            column={tableColumn}
            title={column.header}
            tooltip={column.tooltip}
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {renderStatCell(row.original, column)}
          </span>
        ),
        meta: { cellClassName: "tabular-nums" },
      });
    }

    return cols;
  }, [columnPosition, leagueSlug]);

  const table = useDataTable({
    data: section.players,
    columns,
    sorting,
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    pageSize: Math.max(section.players.length, 1),
  });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{section.title}</h2>
      <DataTable
        table={table}
        showPagination={false}
        emptyMessage={`No ${section.title.toLowerCase()} on your roster yet.`}
        layout="fixed"
      />
    </section>
  );
}
