"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { TvMinimalPlay as TvMinimalPlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { TABLE_ENTITY_LINK_CLASSNAME } from "@/components/ui/table";
import { TeamTableColumnHeader } from "@/components/team/team-table-column-header";
import { formatRecord, teamInitials } from "@/lib/leagues/standings";
import {
  leagueTeamPath,
  myTeamPath,
} from "@/lib/leagues/utils";
import { formatWinChancePct } from "@/lib/leagues/win-probability";
import { cn } from "@/lib/utils";

export type TeamScheduleDisplayRow = {
  id: string;
  week: number;
  weekRangeLabel: string;
  opponentTeamId: string;
  opponentName: string;
  opponentSlug: string;
  opponentLogoUrl?: string | null;
  isHome: boolean;
  opponentWins: number;
  opponentLosses: number;
  opponentTies: number;
  /** Null until fantasy matchup scoring lands. */
  result: "win" | "loss" | "tie" | null;
  /** Weekly scoring rank vs the league; null until scoring lands. */
  weeklyRank: number | null;
  /**
   * Estimated win probability vs this opponent (0–1).
   * TODO(live-win-prob): Recalibrate once live scoring feeds are trusted.
   */
  winChance: number | null;
};

type TeamScheduleListProps = {
  rows: TeamScheduleDisplayRow[];
  leagueSlug: string;
  /** When set, that team links to My Team instead of their public page. */
  myTeamSlug?: string | null;
};

const PLACEHOLDER = "—";

function resultLabel(result: TeamScheduleDisplayRow["result"]) {
  if (result === "win") {
    return "Win";
  }
  if (result === "loss") {
    return "Loss";
  }
  if (result === "tie") {
    return "Tie";
  }
  return PLACEHOLDER;
}

function resultClassName(result: TeamScheduleDisplayRow["result"]) {
  if (result === "win") {
    return "text-success";
  }
  if (result === "loss") {
    return "text-destructive";
  }
  return "text-muted-foreground";
}

function opponentHref(
  leagueSlug: string,
  opponentSlug: string,
  myTeamSlug: string | null | undefined,
) {
  if (!opponentSlug) {
    return myTeamPath(leagueSlug);
  }
  if (myTeamSlug && opponentSlug === myTeamSlug) {
    return myTeamPath(leagueSlug);
  }
  return leagueTeamPath(leagueSlug, opponentSlug);
}

function getColumns(
  leagueSlug: string,
  myTeamSlug: string | null | undefined,
): ColumnDef<TeamScheduleDisplayRow>[] {
  return [
    {
      id: "week",
      accessorKey: "week",
      enableSorting: false,
      meta: { width: 140 },
      header: () => <TeamTableColumnHeader title="Week" />,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="tabular-nums font-medium">{row.original.week}</span>
          <span className="truncate text-xs text-muted-foreground">
            {row.original.weekRangeLabel || PLACEHOLDER}
          </span>
        </div>
      ),
    },
    {
      id: "opponent",
      accessorFn: (row) => row.opponentName,
      enableSorting: false,
      header: () => <TeamTableColumnHeader title="Opponent" />,
      cell: ({ row }) => {
        const game = row.original;
        const record = formatRecord(
          game.opponentWins,
          game.opponentLosses,
          game.opponentTies,
        );
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 text-muted-foreground">
              {game.isHome ? "vs" : "@"}
            </span>
            <Avatar size="sm">
              {game.opponentLogoUrl ? (
                <AvatarImage src={game.opponentLogoUrl} alt="" />
              ) : null}
              <AvatarFallback>{teamInitials(game.opponentName)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <Link
                href={opponentHref(
                  leagueSlug,
                  game.opponentSlug,
                  myTeamSlug,
                )}
                className={TABLE_ENTITY_LINK_CLASSNAME}
              >
                {game.opponentName}
              </Link>
              <span className="truncate text-xs tabular-nums text-muted-foreground">
                {record}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "win-chance",
      accessorFn: (row) => row.winChance,
      enableSorting: false,
      meta: { width: 88, cellClassName: "tabular-nums" },
      header: () => (
        <TeamTableColumnHeader
          title="Chance"
          tooltip="Estimated chance to win this matchup from current starters. Uses projections until kickoff, then actual + remaining projection by time left. Revisit once live scoring is wired."
        />
      ),
      cell: ({ row }) => {
        const chance = row.original.winChance;
        if (chance == null) {
          return <span className="text-muted-foreground">{PLACEHOLDER}</span>;
        }
        return (
          <span
            className={cn(
              "font-medium",
              chance >= 0.55
                ? "text-success"
                : chance <= 0.45
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {formatWinChancePct(chance)}
          </span>
        );
      },
    },
    {
      id: "result",
      accessorFn: (row) => row.result ?? "",
      enableSorting: false,
      meta: { width: 88 },
      header: () => <TeamTableColumnHeader title="Result" />,
      cell: ({ row }) => (
        <span className={cn("font-medium", resultClassName(row.original.result))}>
          {resultLabel(row.original.result)}
        </span>
      ),
    },
    {
      id: "rank",
      accessorFn: (row) => row.weeklyRank,
      enableSorting: false,
      meta: { width: 72, cellClassName: "tabular-nums" },
      header: () => (
        <TeamTableColumnHeader
          title="Rank"
          tooltip="Weekly scoring rank vs the league"
        />
      ),
      cell: ({ row }) => {
        const rank = row.original.weeklyRank;
        if (rank == null) {
          return <span className="text-muted-foreground">{PLACEHOLDER}</span>;
        }
        return (
          <span
            className={cn(
              "font-medium",
              rank <= 8 ? "text-success" : "text-muted-foreground",
            )}
          >
            {rank}
          </span>
        );
      },
    },
    {
      id: "game-centre",
      enableSorting: false,
      meta: { width: 180 },
      header: () => (
        <TeamTableColumnHeader title="Game Centre" srOnly />
      ),
      cell: ({ row }) => (
        <Button
          nativeButton={false}
          size="sm"
          render={
            <Link
              href={`/league/${leagueSlug}/scores/${row.original.id}`}
            />
          }
        >
          <HugeiconsIcon
            icon={TvMinimalPlayIcon}
            strokeWidth={1.5}
            data-icon="inline-start"
          />
          View Game Centre
        </Button>
      ),
    },
  ];
}

export function TeamScheduleList({
  rows,
  leagueSlug,
  myTeamSlug,
}: TeamScheduleListProps) {
  const columns = getColumns(leagueSlug, myTeamSlug);
  const table = useDataTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    pageSize: Math.max(rows.length, 1),
  });

  if (rows.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>No schedule yet</EmptyTitle>
          <EmptyDescription>
            Regular-season matchups appear once the league is full and a
            schedule has been generated.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <DataTable
      table={table}
      showPagination={false}
      emptyMessage="No schedule yet."
    />
  );
}
