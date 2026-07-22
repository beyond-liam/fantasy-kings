"use client";

import { useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AddTeamIcon } from "@hugeicons/core-free-icons";
import type {
  ColumnDef,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";

import { TeamIdentity } from "@/components/leagues/standings/team-identity";
import { TeamTableColumnHeader } from "@/components/team/team-table-column-header";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableColumnHeader,
  DataTableViewOptions,
  useDataTable,
} from "@/components/ui/data-table";
import { claimTeam } from "@/lib/actions/leagues";
import {
  formatGamesBehind,
  formatPoints,
  formatRecord,
  formatWinPct,
  streakSortValue,
  type LeagueStandingsRow,
} from "@/lib/leagues/standings";
import type { LeaguePlayoffStandingsRow } from "@/lib/leagues/playoff-standings";
import { leagueTeamPath, myTeamPath } from "@/lib/leagues/utils";
import { cn } from "@/lib/utils";

type StandingsTableRow = LeagueStandingsRow | LeaguePlayoffStandingsRow;

type LeagueStandingsTableProps = {
  rows: StandingsTableRow[];
  showFaabBudget?: boolean;
  leagueSlug: string;
  myTeamSlug?: string | null;
  /** When set, unclaimed rows show Claim Team (invite/recruit flow). */
  inviteCode?: string | null;
  canClaim?: boolean;
  title?: string;
  /** Show Seed column (playoffs view). Rows should include `seed`. */
  showSeed?: boolean;
  /** Draw a hard line under this seed (last playoff berth). */
  playoffCutoffSeed?: number | null;
};

const PLACEHOLDER = "—";

const COLUMN_LABELS: Record<string, string> = {
  seed: "Seed",
  team: "Team",
  rec: "Record",
  pct: "Win percentage",
  gb: "Games behind",
  strk: "Streak",
  pf: "Points for",
  pfAvg: "Points for average",
  pa: "Points against",
  paAvg: "Points against average",
  wp: "Waiver priority",
  faab: "Budget remaining",
  rank: "Rank",
  opp: "Opponent",
  action: "Action",
};

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
  rowA: { original: StandingsTableRow },
  rowB: { original: StandingsTableRow },
  compare: () => number,
) {
  if (rowA.original.claimed !== rowB.original.claimed) {
    return rowA.original.claimed ? -1 : 1;
  }
  return compare();
}

function ClaimTeamButton({
  inviteCode,
  teamId,
}: {
  inviteCode: string;
  teamId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await claimTeam(inviteCode, teamId);
            if (result?.error) {
              setError(result.error);
            }
          });
        }}
      >
        <HugeiconsIcon
          icon={AddTeamIcon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Claim Team
      </Button>
      {error ? (
        <span className="max-w-40 text-right text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function getStandingsColumns(
  showFaabBudget: boolean,
  leagueSlug: string,
  myTeamSlug: string | null | undefined,
  inviteCode: string | null | undefined,
  canClaim: boolean,
  showSeed: boolean,
): ColumnDef<StandingsTableRow>[] {
  const wpColumn: ColumnDef<StandingsTableRow> = {
    id: "wp",
    accessorFn: (row) => (row.claimed ? row.waiverPriority : null),
    enableSorting: true,
    sortingFn: (a, b) =>
      claimedFirst(a, b, () =>
        compareNullableNumber(
          a.getValue<number | null>("wp"),
          b.getValue<number | null>("wp"),
        ),
      ),
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="WP"
        tooltip="Waiver priority"
      />
    ),
    cell: ({ row }) =>
      row.original.claimed
        ? (row.original.waiverPriority ?? PLACEHOLDER)
        : PLACEHOLDER,
    meta: { cellClassName: "tabular-nums" },
  };

  const faabColumn: ColumnDef<StandingsTableRow> = {
    id: "faab",
    accessorFn: (row) => (row.claimed ? row.faabRemaining : null),
    enableSorting: true,
    sortingFn: (a, b) =>
      claimedFirst(a, b, () =>
        compareNullableNumber(
          a.getValue<number | null>("faab"),
          b.getValue<number | null>("faab"),
        ),
      ),
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="BRM"
        tooltip="Waiver budget remaining"
      />
    ),
    cell: ({ row }) =>
      row.original.claimed && row.original.faabRemaining != null
        ? `$${row.original.faabRemaining}`
        : PLACEHOLDER,
    meta: { cellClassName: "tabular-nums" },
  };

  const seedColumn: ColumnDef<StandingsTableRow> = {
    id: "seed",
    accessorFn: (row) => ("seed" in row ? row.seed : null),
    enableSorting: true,
    enableHiding: false,
    sortingFn: (a, b) =>
      claimedFirst(a, b, () =>
        compareNullableNumber(
          a.getValue<number | null>("seed"),
          b.getValue<number | null>("seed"),
        ),
      ),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Seed" tooltip="Playoff seed" />
    ),
    cell: ({ row }) => {
      const seed = "seed" in row.original ? row.original.seed : null;
      return seed != null ? `#${seed}` : PLACEHOLDER;
    },
    meta: { cellClassName: "tabular-nums w-14" },
  };

  const columns: ColumnDef<StandingsTableRow>[] = [
    ...(showSeed ? [seedColumn] : []),
    {
      id: "team",
      accessorFn: (row) => row.teamName,
      enableSorting: false,
      enableHiding: false,
      size: 220,
      meta: { width: 220 },
      header: () => <TeamTableColumnHeader title="Team" />,
      cell: ({ row }) => {
        const team = row.original;
        let href: string | null = null;
        if (team.claimed && team.teamPublicId) {
          href =
            myTeamSlug && team.teamPublicId === myTeamSlug
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
    {
      id: "rec",
      accessorFn: (row) =>
        row.claimed ? row.wins + row.ties * 0.5 - row.losses * 0.001 : null,
      enableSorting: true,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("rec"),
            b.getValue<number | null>("rec"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="REC" tooltip="Record" />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? formatRecord(
              row.original.wins,
              row.original.losses,
              row.original.ties,
            )
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "pct",
      accessorFn: (row) => (row.claimed ? row.winPct : null),
      enableSorting: true,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("pct"),
            b.getValue<number | null>("pct"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="W%"
          tooltip="Win percentage"
        />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? formatWinPct(row.original.winPct)
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "gb",
      accessorFn: (row) => (row.claimed ? (row.gamesBehind ?? 0) : null),
      enableSorting: true,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("gb"),
            b.getValue<number | null>("gb"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="GB"
          tooltip="Games behind"
        />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? formatGamesBehind(row.original.gamesBehind)
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "strk",
      accessorFn: (row) =>
        row.claimed ? streakSortValue(row.streak) : null,
      enableSorting: true,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("strk"),
            b.getValue<number | null>("strk"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="STRK" tooltip="Streak" />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? (row.original.streak ?? PLACEHOLDER)
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "pf",
      accessorFn: (row) => (row.claimed ? row.pointsFor : null),
      enableSorting: true,
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
          tooltip="Points for"
        />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? formatPoints(row.original.pointsFor)
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "pfAvg",
      accessorFn: (row) => (row.claimed ? row.pointsForAvg : null),
      enableSorting: true,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("pfAvg"),
            b.getValue<number | null>("pfAvg"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="PF/G"
          tooltip="Points for average"
        />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? formatPoints(row.original.pointsForAvg)
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "pa",
      accessorFn: (row) => (row.claimed ? row.pointsAgainst : null),
      enableSorting: true,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("pa"),
            b.getValue<number | null>("pa"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="PA"
          tooltip="Points against"
        />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? formatPoints(row.original.pointsAgainst)
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "paAvg",
      accessorFn: (row) => (row.claimed ? row.pointsAgainstAvg : null),
      enableSorting: true,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("paAvg"),
            b.getValue<number | null>("paAvg"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="PA/G"
          tooltip="Points against average"
        />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? formatPoints(row.original.pointsAgainstAvg)
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums" },
    },
    wpColumn,
    ...(showFaabBudget ? [faabColumn] : []),
    {
      id: "rank",
      accessorFn: (row) => (row.claimed ? row.rank : null),
      enableSorting: true,
      sortingFn: (a, b) =>
        claimedFirst(a, b, () =>
          compareNullableNumber(
            a.getValue<number | null>("rank"),
            b.getValue<number | null>("rank"),
          ),
        ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="RK" tooltip="Rank" />
      ),
      cell: ({ row }) =>
        row.original.claimed
          ? (row.original.rank ?? PLACEHOLDER)
          : PLACEHOLDER,
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "opp",
      accessorFn: (row) => row.opponentName,
      enableSorting: false,
      header: () => <TeamTableColumnHeader title="OPP" tooltip="Opponent" />,
      cell: ({ row }) =>
        row.original.claimed
          ? (row.original.opponentName ?? PLACEHOLDER)
          : PLACEHOLDER,
    },
  ];

  if (canClaim && inviteCode) {
    columns.push({
      id: "action",
      enableSorting: false,
      enableHiding: false,
      header: () => <TeamTableColumnHeader title="" />,
      cell: ({ row }) => {
        if (row.original.claimed || !row.original.teamId) {
          return null;
        }
        return (
          <ClaimTeamButton
            inviteCode={inviteCode}
            teamId={row.original.teamId}
          />
        );
      },
    });
  }

  return columns;
}

export function LeagueStandingsTable({
  rows,
  showFaabBudget = false,
  leagueSlug,
  myTeamSlug,
  inviteCode,
  canClaim = false,
  title = "Standings",
  showSeed = false,
  playoffCutoffSeed = null,
}: LeagueStandingsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: showSeed ? "seed" : "rank", desc: false },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    showSeed ? { rank: false } : {},
  );

  const columns = getStandingsColumns(
    showFaabBudget,
    leagueSlug,
    myTeamSlug,
    inviteCode,
    canClaim,
    showSeed,
  );
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
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <DataTableViewOptions table={table} labels={COLUMN_LABELS} />
      </div>
      <DataTable
        table={table}
        showPagination={false}
        emptyMessage="No team slots configured for this league."
        getRowClassName={(row) => {
          if (playoffCutoffSeed == null || !("seed" in row.original)) {
            return undefined;
          }
          const { seed } = row.original;
          return cn(
            seed === playoffCutoffSeed && "border-b-2! border-border!",
            seed > playoffCutoffSeed && "text-muted-foreground",
          );
        }}
      />
    </div>
  );
}
