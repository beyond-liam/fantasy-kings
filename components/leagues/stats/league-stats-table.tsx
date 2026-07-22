"use client";

import { useState } from "react";
import type {
  ColumnDef,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";

import { TeamIdentity } from "@/components/leagues/standings/team-identity";
import {
  DataTable,
  DataTableColumnHeader,
  DataTableViewOptions,
  useDataTable,
} from "@/components/ui/data-table";
import {
  formatLeaderPositionLabel,
  type LeaguePositionStatsRow,
} from "@/lib/leagues/league-position-stats";
import { formatPoints } from "@/lib/leagues/standings";
import { leagueTeamPath, myTeamPath } from "@/lib/leagues/utils";

type LeagueStatsTableProps = {
  rows: LeaguePositionStatsRow[];
  positionColumns: string[];
  leagueSlug: string;
  myTeamPublicId?: string | null;
  week: number;
  scoresAvailable: boolean;
};

const PLACEHOLDER = "—";

function formatNullablePoints(value: number | null | undefined) {
  if (value == null) {
    return PLACEHOLDER;
  }
  return formatPoints(value);
}

function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
) {
  const aMissing = a == null;
  const bMissing = b == null;
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

function claimedFirst(
  rowA: { original: LeaguePositionStatsRow },
  rowB: { original: LeaguePositionStatsRow },
  compare: () => number,
) {
  if (rowA.original.claimed !== rowB.original.claimed) {
    return rowA.original.claimed ? -1 : 1;
  }
  return compare();
}

function getStatsColumns(
  positionColumns: string[],
  leagueSlug: string,
  myTeamPublicId: string | null | undefined,
  scoresAvailable: boolean,
): ColumnDef<LeaguePositionStatsRow>[] {
  const positionDefs: ColumnDef<LeaguePositionStatsRow>[] =
    positionColumns.map((positionId) => {
      const label = formatLeaderPositionLabel(positionId);
      return {
        id: positionId,
        accessorFn: (row) =>
          row.claimed && scoresAvailable
            ? (row.byPosition[positionId] ?? null)
            : null,
        enableSorting: scoresAvailable,
        sortingFn: (a, b) =>
          claimedFirst(a, b, () =>
            compareNullableNumber(
              a.getValue<number | null>(positionId),
              b.getValue<number | null>(positionId),
            ),
          ),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={label}
            tooltip={`${label} starter points`}
          />
        ),
        cell: ({ row }) =>
          row.original.claimed
            ? formatNullablePoints(row.original.byPosition[positionId])
            : PLACEHOLDER,
        meta: { cellClassName: "tabular-nums" },
      };
    });

  return [
    {
      id: "rank",
      accessorFn: (row) => (row.claimed ? row.rank : null),
      enableSorting: true,
      enableHiding: false,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("rank"),
            b.getValue<number | null>("rank"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="#" tooltip="Rank" />
      ),
      cell: ({ row }) =>
        row.original.claimed ? row.original.rank : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums w-10" },
    },
    {
      id: "team",
      accessorFn: (row) => row.teamName,
      enableSorting: true,
      enableHiding: false,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          a.original.teamName.localeCompare(b.original.teamName),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Team" />
      ),
      cell: ({ row }) => {
        const team = row.original;
        let href: string | null = null;
        if (team.claimed && team.teamPublicId) {
          href =
            myTeamPublicId && team.teamPublicId === myTeamPublicId
              ? myTeamPath(leagueSlug)
              : leagueTeamPath(leagueSlug, team.teamPublicId);
        }
        return (
          <TeamIdentity
            teamName={team.teamName}
            ownerName={team.ownerName}
            claimed={team.claimed}
            logoUrl={team.logoUrl}
            href={href}
          />
        );
      },
    },
    ...positionDefs,
    {
      id: "pf",
      accessorFn: (row) =>
        row.claimed && scoresAvailable ? row.pointsFor : null,
      enableSorting: scoresAvailable,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("pf"),
            b.getValue<number | null>("pf"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="PF"
          tooltip="Points for (starters)"
        />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? formatNullablePoints(row.original.pointsFor)
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums font-medium" },
    },
    {
      id: "optPf",
      accessorFn: (row) =>
        row.claimed && scoresAvailable ? row.optimumPointsFor : null,
      enableSorting: scoresAvailable,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("optPf"),
            b.getValue<number | null>("optPf"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="OPF"
          tooltip="Optimum points for"
        />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? formatNullablePoints(row.original.optimumPointsFor)
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums" },
    },
  ];
}

export function LeagueStatsTable({
  rows,
  positionColumns,
  leagueSlug,
  myTeamPublicId,
  week,
  scoresAvailable,
}: LeagueStatsTableProps) {
  const [sorting, setSorting] = useState<SortingState>(
    scoresAvailable
      ? [{ id: "pf", desc: true }]
      : [{ id: "team", desc: false }],
  );
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    {},
  );

  const columns = getStatsColumns(
    positionColumns,
    leagueSlug,
    myTeamPublicId,
    scoresAvailable,
  );

  const columnLabels: Record<string, string> = {
    rank: "Rank",
    team: "Team",
    pf: "Points for",
    optPf: "OPF",
  };
  for (const positionId of positionColumns) {
    columnLabels[positionId] = formatLeaderPositionLabel(positionId);
  }

  const table = useDataTable({
    data: rows,
    columns,
    sorting,
    onSortingChange: setSorting,
    columnVisibility,
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: (row) => row.id,
    pageSize: Math.max(rows.length, 1),
  });

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No team slots configured for this league.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-lg font-semibold tracking-tight">Stats</h2>
          {scoresAvailable ? (
            <p className="text-sm tabular-nums text-muted-foreground">
              Week {week}
            </p>
          ) : null}
        </div>
        <DataTableViewOptions table={table} labels={columnLabels} />
      </div>
      <DataTable
        table={table}
        showPagination={false}
        emptyMessage="No team slots configured for this league."
      />
    </div>
  );
}
