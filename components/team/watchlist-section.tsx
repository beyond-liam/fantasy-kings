"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

import { BinocularsIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerActionButton } from "@/components/rankings/player-action-button";
import { PlayerIdentity } from "@/components/rankings/player-identity";
import { WatchlistToggle } from "@/components/rankings/watchlist-toggle";
import { useWatchlist } from "@/components/rankings/watchlist-provider";
import { OpponentCell } from "@/components/team/opponent-cell";
import { PointsCell } from "@/components/team/points-cell";
import { TeamTableColumnHeader } from "@/components/team/team-table-column-header";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableColumnHeader,
  useDataTable,
} from "@/components/ui/data-table";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { WatchlistPlayer } from "@/lib/queries/watchlist";
import { formatRosterRatePct } from "@/lib/leagues/format-roster-rate";
import { PLAYER_STAT_COLUMNS } from "@/lib/rankings/player-stat-columns";
import { compareNullableNumber } from "@/lib/rankings/stat-helpers";

type TeamWatchlistSectionProps = {
  players: WatchlistPlayer[];
  leagueSlug: string;
  actionsEnabled?: boolean;
  acquisitionsLocked?: boolean;
  acquisitionLockReason?: string;
};

const PLACEHOLDER = "—";

export function TeamWatchlistSection({
  players,
  leagueSlug,
  actionsEnabled = false,
  acquisitionsLocked = false,
  acquisitionLockReason,
}: TeamWatchlistSectionProps) {
  const { isWatched } = useWatchlist();
  const [sorting, setSorting] = useState<SortingState>([]);
  const visiblePlayers = players.filter((player) => isWatched(player.id));

  const columns = useMemo<ColumnDef<WatchlistPlayer>[]>(
    () => [
      {
        id: "player",
        accessorFn: (row) => row.fullName,
        enableSorting: false,
        enableHiding: false,
        header: () => <TeamTableColumnHeader title="Player" />,
        cell: ({ row }) => {
          const player = row.original;
          return (
            <div className="flex min-w-0 items-center gap-1">
              <WatchlistToggle playerId={player.id} />
              <PlayerIdentity
                fullName={player.fullName}
                sleeperId={player.sleeperId}
                primaryPositionId={player.primaryPositionId}
                nflTeam={player.nflTeam}
                byeWeek={player.byeWeek}
                injuryStatus={player.injuryStatus}
                playerId={player.id}
                leagueSlug={leagueSlug}
                className="min-w-0 flex-1"
              />
            </div>
          );
        },
        meta: { width: 224, sticky: "left", cellClassName: "min-w-[14rem]" },
      },
      {
        id: "opponent",
        accessorFn: (row) => row.opponent?.label ?? "",
        enableSorting: false,
        header: () => (
          <TeamTableColumnHeader title="Opp" tooltip="Opponent" />
        ),
        cell: ({ row }) => <OpponentCell opponent={row.original.opponent} />,
      },
      {
        id: "points",
        accessorFn: (row) => row.actualPts ?? row.projectedPts,
        enableSorting: true,
        sortingFn: (a, b) =>
          compareNullableNumber(
            a.original.actualPts ?? a.original.projectedPts,
            b.original.actualPts ?? b.original.projectedPts,
          ),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="PTS"
            tooltip="This week's points (projected underneath)"
          />
        ),
        cell: ({ row }) => {
          const player = row.original;
          return (
            <PointsCell
              actualPts={player.actualPts}
              projectedPts={player.projectedPts}
              showActual={
                player.opponent?.gameStatus === "in" ||
                player.opponent?.gameStatus === "post"
              }
            />
          );
        },
      },
      {
        id: "rank",
        accessorFn: () => null,
        enableSorting: false,
        header: () => (
          <TeamTableColumnHeader
            title={PLAYER_STAT_COLUMNS.rank.header}
            tooltip={PLAYER_STAT_COLUMNS.rank.tooltip}
          />
        ),
        cell: () => (
          <span className="text-muted-foreground">{PLACEHOLDER}</span>
        ),
      },
      {
        id: "fantasyPoints",
        accessorFn: () => null,
        enableSorting: false,
        header: () => (
          <TeamTableColumnHeader
            title={PLAYER_STAT_COLUMNS.fpts.header}
            tooltip={PLAYER_STAT_COLUMNS.fpts.tooltip}
          />
        ),
        cell: () => (
          <span className="tabular-nums text-muted-foreground">
            {PLACEHOLDER}
          </span>
        ),
      },
      {
        id: "average",
        accessorFn: () => null,
        enableSorting: false,
        header: () => (
          <TeamTableColumnHeader
            title={PLAYER_STAT_COLUMNS.avg.header}
            tooltip={PLAYER_STAT_COLUMNS.avg.tooltip}
          />
        ),
        cell: () => (
          <span className="tabular-nums text-muted-foreground">
            {PLACEHOLDER}
          </span>
        ),
      },
      {
        id: "owned",
        accessorFn: (row) => row.ownedPct,
        enableSorting: true,
        sortingFn: (a, b) =>
          compareNullableNumber(a.original.ownedPct, b.original.ownedPct),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="OWN"
            tooltip="% of leagues that own this player"
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRosterRatePct(row.original.ownedPct)}
          </span>
        ),
      },
      {
        id: "owner",
        accessorFn: (row) => row.fantasyTeamName ?? "",
        enableSorting: false,
        header: () => (
          <TeamTableColumnHeader title="Owner" tooltip="Fantasy team owner" />
        ),
        cell: ({ row }) =>
          row.original.fantasyTeamName ? (
            <span className="block truncate">
              {row.original.fantasyTeamName}
            </span>
          ) : null,
        meta: { cellClassName: "min-w-[8rem]" },
      },
      {
        id: "action",
        accessorFn: () => null,
        enableSorting: false,
        enableHiding: false,
        header: () => <TeamTableColumnHeader title="Action" srOnly />,
        cell: ({ row }) => (
          <PlayerActionButton
            player={row.original}
            leagueSlug={leagueSlug}
            disabled={!actionsEnabled}
            acquisitionsLocked={acquisitionsLocked}
            acquisitionLockReason={acquisitionLockReason}
          />
        ),
        meta: { cellClassName: "w-10" },
      },
    ],
    [
      actionsEnabled,
      acquisitionLockReason,
      acquisitionsLocked,
      leagueSlug,
    ],
  );

  const table = useDataTable({
    data: visiblePlayers,
    columns,
    sorting,
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    pageSize: Math.max(visiblePlayers.length, 1),
  });

  if (visiblePlayers.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={BinocularsIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>No players on watchlist</EmptyTitle>
          <EmptyDescription>
            Bookmark players from the Players tab to track them here.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            nativeButton={false}
            render={<Link href={`/league/${leagueSlug}/players`} />}
          >
            <HugeiconsIcon
              icon={UserGroupIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Browse Players
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <DataTable
      table={table}
      showPagination={false}
      emptyMessage="Bookmark players from the Players tab to track them here."
    />
  );
}
