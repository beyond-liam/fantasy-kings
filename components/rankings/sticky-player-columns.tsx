"use client";

import type { ReactNode } from "react";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";

import { PlayerIdentity } from "@/components/rankings/player-identity";
import { TeamTableColumnHeader } from "@/components/team/team-table-column-header";
import { DataTableColumnHeader } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";

/** pl-2 (8) + avatar sm (24) + pr-2.5 (10) — gap lives in avatar cell. */
export const STICKY_PLAYER_AVATAR_WIDTH = 42;

/** Former 224px Player col minus avatar sticky width. */
export const STICKY_PLAYER_NAME_WIDTH = 182;

/** Combined Player column width when not split (desktop). */
export const PLAYER_COLUMN_WIDTH = 224;

export const STICKY_AVATAR_CELL_PAD = "pl-2 pr-2.5";
export const STICKY_NAME_CELL_PAD = "pl-0 pr-2";

export type StickyPlayerFields = {
  id: string;
  fullName: string;
  sleeperId?: string | null;
  primaryPositionId: string;
  nflTeam?: string | null;
  byeWeek?: number | null;
  injuryStatus?: string | null;
  hasPossession?: boolean;
  inRedZone?: boolean;
  isLive?: boolean;
};

type StickyPlayerColumnsOptions<TData> = {
  getPlayer: (row: TData) => StickyPlayerFields;
  leagueSlug?: string | null;
  /** Pin the avatar column. Default true. */
  sticky?: boolean;
  avatarWidth?: number;
  nameWidth?: number;
  /** Extra controls before the avatar (watchlist toggle, etc.). */
  avatarLeading?: (row: TData) => ReactNode;
  headerVariant?: "team" | "data";
  enableSorting?: boolean;
  filterFn?: FilterFn<TData>;
  nameCellClassName?: string;
};

/**
 * Split Player into sticky avatar + scrolling name for DataTable layouts.
 * Use when a table previously pinned the full player identity column.
 */
export function createStickyPlayerColumns<TData>(
  options: StickyPlayerColumnsOptions<TData>,
): ColumnDef<TData>[] {
  const sticky = options.sticky ?? true;
  const avatarWidth = options.avatarWidth ?? STICKY_PLAYER_AVATAR_WIDTH;
  const nameWidth = options.nameWidth ?? STICKY_PLAYER_NAME_WIDTH;
  const headerVariant = options.headerVariant ?? "team";

  return [
    {
      id: "playerAvatar",
      enableSorting: false,
      enableHiding: false,
      size: avatarWidth,
      header: () => <span className="sr-only">Player</span>,
      cell: ({ row }) => {
        const player = options.getPlayer(row.original);
        return (
          <div className="flex items-center gap-2">
            {options.avatarLeading?.(row.original)}
            <PlayerIdentity
              fullName={player.fullName}
              sleeperId={player.sleeperId}
              primaryPositionId={player.primaryPositionId}
              nflTeam={player.nflTeam}
              byeWeek={player.byeWeek}
              injuryStatus={player.injuryStatus}
              playerId={player.id}
              leagueSlug={options.leagueSlug}
              showText={false}
              hasPossession={player.hasPossession}
              inRedZone={player.inRedZone}
              isLive={player.isLive}
            />
          </div>
        );
      },
      meta: {
        width: avatarWidth,
        sticky: sticky ? "left" : undefined,
        cellClassName: STICKY_AVATAR_CELL_PAD,
        headerClassName: STICKY_AVATAR_CELL_PAD,
      },
    },
    {
      id: "player",
      accessorFn: (row) => options.getPlayer(row).fullName,
      enableSorting: options.enableSorting ?? false,
      enableHiding: false,
      size: nameWidth,
      header: ({ column }) =>
        headerVariant === "data" ? (
          <DataTableColumnHeader column={column} title="Player" />
        ) : (
          <TeamTableColumnHeader title="Player" />
        ),
      cell: ({ row }) => {
        const player = options.getPlayer(row.original);
        return (
          <PlayerIdentity
            fullName={player.fullName}
            sleeperId={player.sleeperId}
            primaryPositionId={player.primaryPositionId}
            nflTeam={player.nflTeam}
            byeWeek={player.byeWeek}
            injuryStatus={player.injuryStatus}
            playerId={player.id}
            leagueSlug={options.leagueSlug}
            showAvatar={false}
            className="min-w-0"
            hasPossession={player.hasPossession}
            inRedZone={player.inRedZone}
            isLive={player.isLive}
          />
        );
      },
      filterFn: options.filterFn,
      meta: {
        width: nameWidth,
        cellClassName: cn(STICKY_NAME_CELL_PAD, options.nameCellClassName),
        headerClassName: STICKY_NAME_CELL_PAD,
      },
    },
  ];
}

/** Full (unsplit) player column — desktop layouts that should stay unchanged. */
export function createFullPlayerColumn<TData>(options: {
  getPlayer: (row: TData) => StickyPlayerFields;
  leagueSlug?: string | null;
  width?: number;
  sticky?: boolean;
  headerVariant?: "team" | "data";
  enableSorting?: boolean;
  filterFn?: FilterFn<TData>;
  cellClassName?: string;
  leading?: (row: TData) => ReactNode;
}): ColumnDef<TData> {
  const width = options.width ?? PLAYER_COLUMN_WIDTH;
  const headerVariant = options.headerVariant ?? "team";

  return {
    id: "player",
    accessorFn: (row) => options.getPlayer(row).fullName,
    enableSorting: options.enableSorting ?? false,
    enableHiding: false,
    size: width,
    header: ({ column }) =>
      headerVariant === "data" ? (
        <DataTableColumnHeader column={column} title="Player" />
      ) : (
        <TeamTableColumnHeader title="Player" />
      ),
    cell: ({ row }) => {
      const player = options.getPlayer(row.original);
      return (
        <div className="flex min-w-0 items-center gap-1">
          {options.leading?.(row.original)}
          <PlayerIdentity
            fullName={player.fullName}
            sleeperId={player.sleeperId}
            primaryPositionId={player.primaryPositionId}
            nflTeam={player.nflTeam}
            byeWeek={player.byeWeek}
            injuryStatus={player.injuryStatus}
            playerId={player.id}
            leagueSlug={options.leagueSlug}
            className="min-w-0 flex-1"
            hasPossession={player.hasPossession}
            inRedZone={player.inRedZone}
            isLive={player.isLive}
          />
        </div>
      );
    },
    filterFn: options.filterFn,
    meta: {
      width,
      sticky: options.sticky ? "left" : undefined,
      cellClassName: options.cellClassName,
    },
  };
}
