"use client";

import { useMemo, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

import {
  DataTable,
  DataTableColumnHeader,
  useDataTable,
} from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { PlayerProfile } from "@/lib/queries/player-profile";
import {
  formatPositionRank,
  getPositionRankBadgeVariant,
} from "@/lib/rankings/stat-helpers";
import { cn } from "@/lib/utils";

type GameLogRow = {
  week: number;
  opponent: string | null;
  result: "W" | "L" | "T" | null;
  fantasyPts: number | null;
  finish: number | null;
  stats: Record<string, number | null>;
};

type PlayerGameLogTableProps = {
  profile: PlayerProfile;
};

function formatPts(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

function formatStat(value: number | null | undefined, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Number.isInteger(value) && decimals <= 1) return String(value);
  return value.toFixed(decimals);
}

function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
) {
  const aMissing = a == null || !Number.isFinite(a);
  const bMissing = b == null || !Number.isFinite(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return a - b;
}

const RESULT_SORT_RANK: Record<"W" | "L" | "T", number> = {
  W: 3,
  T: 2,
  L: 1,
};

const RESULT_CLASS: Record<"W" | "L" | "T", string> = {
  W: "text-success",
  L: "text-destructive",
  T: "text-muted-foreground",
};

const FINISH_BADGE_BORDER: Record<
  "success" | "secondary" | "warning" | "destructive",
  string
> = {
  success: "border-success/40",
  secondary: "border-muted-foreground/25",
  warning: "border-warning/40",
  destructive: "border-destructive/40",
};

export function PlayerGameLogTable({ profile }: PlayerGameLogTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "week", desc: false },
  ]);

  const finishByWeek = useMemo(
    () =>
      new Map(
        (profile.overview.weeklyFinish?.weeks ?? []).map((row) => [
          row.week,
          row.finish,
        ]),
      ),
    [profile.overview.weeklyFinish?.weeks],
  );

  const data = useMemo<GameLogRow[]>(
    () =>
      profile.gameLog.map((row) => ({
        week: row.week,
        opponent: row.opponent,
        result: row.result,
        fantasyPts: row.fantasyPts,
        finish: finishByWeek.get(row.week) ?? null,
        stats: row.stats,
      })),
    [finishByWeek, profile.gameLog],
  );

  const statColumns = useMemo(
    () => profile.gameLogColumns.slice(0, 8),
    [profile.gameLogColumns],
  );

  const columns = useMemo<ColumnDef<GameLogRow>[]>(() => {
    const cols: ColumnDef<GameLogRow>[] = [
      {
        id: "week",
        accessorKey: "week",
        enableSorting: true,
        sortingFn: (a, b) => a.original.week - b.original.week,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Wk"
            tooltip="NFL week"
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.week}</span>
        ),
        meta: {
          width: 72,
          sticky: "left",
          cellClassName: "tabular-nums",
        },
      },
      {
        id: "opp",
        accessorFn: (row) => row.opponent ?? "",
        enableSorting: true,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Opp"
            tooltip="Opponent"
          />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {row.original.opponent ?? "—"}
          </span>
        ),
        meta: {
          width: 96,
          sticky: "left",
        },
      },
      {
        id: "result",
        accessorFn: (row) =>
          row.result ? RESULT_SORT_RANK[row.result] : null,
        enableSorting: true,
        sortingFn: (a, b) =>
          compareNullableNumber(
            a.original.result ? RESULT_SORT_RANK[a.original.result] : null,
            b.original.result ? RESULT_SORT_RANK[b.original.result] : null,
          ),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="W/L"
            tooltip="NFL team result"
          />
        ),
        cell: ({ row }) =>
          row.original.result ? (
            <span
              className={cn(
                "font-semibold",
                RESULT_CLASS[row.original.result],
              )}
            >
              {row.original.result}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        meta: { width: 52 },
      },
      {
        id: "fantasyPts",
        accessorKey: "fantasyPts",
        enableSorting: true,
        sortingFn: (a, b) =>
          compareNullableNumber(a.original.fantasyPts, b.original.fantasyPts),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="FPts"
            tooltip="Fantasy points"
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatPts(row.original.fantasyPts)}
          </span>
        ),
        meta: { width: 64, cellClassName: "tabular-nums" },
      },
      {
        id: "finish",
        accessorKey: "finish",
        enableSorting: true,
        sortingFn: (a, b) =>
          compareNullableNumber(a.original.finish, b.original.finish),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Rnk"
            tooltip="Weekly finish at position"
          />
        ),
        cell: ({ row }) => {
          const finish = row.original.finish;
          const badgeVariant = getPositionRankBadgeVariant(finish);
          if (badgeVariant == null || finish == null) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <Badge
              variant={badgeVariant}
              className={cn(
                "border font-semibold tabular-nums",
                FINISH_BADGE_BORDER[badgeVariant],
              )}
            >
              {formatPositionRank(
                profile.primaryPositionId,
                Math.round(finish),
              )}
            </Badge>
          );
        },
        meta: { width: 72 },
      },
    ];

    for (const column of statColumns) {
      cols.push({
        id: column.key,
        accessorFn: (row) => row.stats[column.key] ?? null,
        enableSorting: true,
        sortingFn: (a, b) =>
          compareNullableNumber(
            a.original.stats[column.key] ?? null,
            b.original.stats[column.key] ?? null,
          ),
        header: ({ column: tableColumn }) => (
          <DataTableColumnHeader
            column={tableColumn}
            title={column.header}
            tooltip={column.tooltip}
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatStat(
              row.original.stats[column.key] ?? null,
              column.decimals ?? 1,
            )}
          </span>
        ),
        meta: { cellClassName: "tabular-nums" },
      });
    }

    return cols;
  }, [profile.primaryPositionId, statColumns]);

  const table = useDataTable({
    data,
    columns,
    sorting,
    onSortingChange: setSorting,
    getRowId: (row) => String(row.week),
    pageSize: Math.max(data.length, 1),
  });

  if (profile.gameLog.length === 0) {
    return (
      <Empty className="border-none" size="sm">
        <EmptyHeader>
          <EmptyTitle>No schedule yet</EmptyTitle>
          <EmptyDescription>
            Game log for {profile.season} appears once the schedule is set.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <DataTable
      table={table}
      showPagination={false}
      emptyMessage={`No game log for ${profile.season}.`}
      layout="fixed"
      className="relative z-0 isolate min-w-0 gap-0"
    />
  );
}
