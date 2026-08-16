"use client";

import { useMemo, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

import { createStickyPlayerColumns } from "@/components/rankings/sticky-player-columns";
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
  compareNullableNumber,
  formatPositionRank,
  getAdp,
  getFantasyPts,
  getPositionRankColorClass,
  sortableRankValue,
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

export function TeamStatsTable({
  section,
  leagueSlug,
}: TeamStatsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "fantasy_pts", desc: true },
  ]);
  const columnPosition = section.columnPosition;

  const columns = useMemo<ColumnDef<RankedPlayerRow>[]>(() => {
    const statColumns = getStatColumns(columnPosition);

    const cols: ColumnDef<RankedPlayerRow>[] = [
      ...createStickyPlayerColumns<RankedPlayerRow>({
        leagueSlug,
        getPlayer: (row) => ({
          id: row.id,
          fullName: row.fullName,
          sleeperId: row.sleeperId,
          primaryPositionId: row.primaryPositionId,
          nflTeam: row.nflTeam,
          byeWeek: row.byeWeek,
          injuryStatus: row.injuryStatus,
          hasPossession: row.opponent?.hasPossession,
          inRedZone: row.opponent?.inRedZone,
          isLive: row.opponent?.gameStatus === "in",
        }),
      }),
      {
        id: "opp",
        accessorFn: (row) => row.opponent?.label ?? "",
        enableSorting: false,
        header: () => (
          <TeamTableColumnHeader title="Opp" tooltip="Opponent" />
        ),
        cell: ({ row }) => <OpponentCell opponent={row.original.opponent} />,
        // Fixed so Opp/Rank line up across QB/RB/WR, K, DEF tables (different
        // stat column counts would otherwise stretch these unequally).
        // 144 matches roster Opp (w-36) so live down/distance fits.
        meta: { width: 144 },
      },
      {
        id: "rank",
        accessorFn: (row) => sortableRankValue(row.positionRank),
        enableSorting: true,
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
        meta: { width: 88 },
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
