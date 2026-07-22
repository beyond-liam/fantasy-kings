"use client";

import { useMemo, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

import { DraftPlayerAction } from "@/components/leagues/draft/draft-player-action";
import { DraftQueueToggle } from "@/components/leagues/draft/draft-queue-toggle";
import { PlayerIdentity } from "@/components/rankings/player-identity";
import {
  DataTable,
  DataTableColumnHeader,
  useDataTable,
} from "@/components/ui/data-table";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  POSITION_FILTERS,
  type PositionFilter,
  formatStatValue,
  getStatColumns,
  parsePositionFilter,
} from "@/lib/rankings/column-config";
import {
  formatPositionRank,
  getAdp,
  getFantasyPts,
  getPositionRankColorClass,
} from "@/lib/rankings/stat-helpers";
import type { RankedPlayerRow } from "@/lib/queries/players";

type DraftPlayerPoolProps = {
  slug: string;
  data: RankedPlayerRow[];
  teams: string[];
  draftedPlayerIds: string[];
  draftLive: boolean;
  draftComplete: boolean;
  isMyTurn: boolean;
  isCommissioner: boolean;
  /** Hide the queue column (e.g. mock drafts). */
  showQueue?: boolean;
  /** Local draft handler — skips league server actions when set. */
  onDraftPlayer?: (playerId: string) => void;
};

const DEFAULT_SORTING: SortingState = [{ id: "fantasy_pts", desc: true }];
const STAT_CELL_CLASS = "tabular-nums";
const ACTION_COLUMN_WIDTH = 148;

const POSITION_ITEMS = POSITION_FILTERS.map((value) => ({
  label: value,
  value,
}));

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

export function DraftPlayerPool({
  slug,
  data,
  teams,
  draftedPlayerIds,
  draftLive,
  draftComplete,
  isMyTurn,
  isCommissioner,
  showQueue = true,
  onDraftPlayer,
}: DraftPlayerPoolProps) {
  const drafted = useMemo(
    () => new Set(draftedPlayerIds),
    [draftedPlayerIds],
  );
  const [position, setPosition] = useState<PositionFilter>("QB");
  const [team, setTeam] = useState("ALL");
  const [rookiesOnly, setRookiesOnly] = useState(false);
  const [hideDrafted, setHideDrafted] = useState(true);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);

  const teamItems = useMemo(
    () => [
      { label: "All teams", value: "ALL" },
      ...teams.map((value) => ({ label: value, value })),
    ],
    [teams],
  );

  const columns = useMemo<ColumnDef<RankedPlayerRow>[]>(() => {
    const statCols = getStatColumns(position);

    const queueColumn: ColumnDef<RankedPlayerRow> = {
      id: "queue",
      enableSorting: false,
      size: 40,
      meta: { width: 40, cellClassName: "px-1 text-center" },
      header: () => <span className="sr-only">Queue</span>,
      cell: ({ row }) => (
        <DraftQueueToggle
          playerId={row.original.id}
          disabled={drafted.has(row.original.id)}
        />
      ),
    };

    return [
      ...(showQueue ? [queueColumn] : []),
      {
        id: "player",
        accessorFn: (row) => row.fullName,
        enableSorting: false,
        size: 220,
        meta: { width: 220 },
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
              leagueSlug={slug === "mock" ? undefined : slug}
            />
          );
        },
      },
      {
        id: "positionRank",
        accessorFn: (row) => sortableValue(row.positionRank),
        sortUndefined: "last",
        meta: { cellClassName: STAT_CELL_CLASS },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Draft" />
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
          meta: { cellClassName: STAT_CELL_CLASS },
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
      {
        id: "action",
        enableSorting: false,
        size: ACTION_COLUMN_WIDTH,
        meta: {
          width: ACTION_COLUMN_WIDTH,
          cellClassName: "overflow-visible px-1 text-center",
          headerClassName: "px-1",
        },
        header: () => <span className="sr-only">Action</span>,
        cell: ({ row }) => {
          const isDrafted = drafted.has(row.original.id);
          const canDraft = draftLive && isMyTurn && !isDrafted;
          const canCommissionerPick =
            draftLive && isCommissioner && !isMyTurn && !isDrafted;
          let disabledReason = "Draft has not started.";
          if (draftLive && !isMyTurn) {
            disabledReason = "Waiting for your turn.";
          }

          return (
            <DraftPlayerAction
              slug={slug}
              playerId={row.original.id}
              drafted={isDrafted}
              canDraft={canDraft}
              canCommissionerPick={canCommissionerPick}
              hideActions={draftComplete}
              disabledReason={disabledReason}
              onDraft={
                onDraftPlayer
                  ? () => onDraftPlayer(row.original.id)
                  : undefined
              }
            />
          );
        },
      },
    ];
  }, [
    draftComplete,
    draftLive,
    drafted,
    isCommissioner,
    isMyTurn,
    onDraftPlayer,
    position,
    showQueue,
    slug,
  ]);

  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.filter((row) => {
      if (row.primaryPositionId !== position) return false;
      if (team !== "ALL" && row.nflTeam !== team) return false;
      if (rookiesOnly && row.yearsExp !== 0) return false;
      if (hideDrafted && drafted.has(row.id)) return false;
      if (query && !row.fullName.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [data, drafted, hideDrafted, position, rookiesOnly, search, team]);

  const table = useDataTable({
    data: filteredData,
    columns,
    sorting,
    onSortingChange: setSorting,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Field className="sm:w-40">
          <FieldLabel>Position</FieldLabel>
          <Select
            items={POSITION_ITEMS}
            value={position}
            onValueChange={(value) => {
              if (value) {
                setPosition(parsePositionFilter(value));
                setSorting(DEFAULT_SORTING);
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {POSITION_FILTERS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field className="sm:w-44">
          <FieldLabel>NFL team</FieldLabel>
          <Select
            items={teamItems}
            value={team}
            onValueChange={(value) => {
              if (value) setTeam(value);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL">All teams</SelectItem>
                {teams.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field className="sm:min-w-48 sm:flex-1">
          <FieldLabel htmlFor="draft-pool-search">Search</FieldLabel>
          <Input
            id="draft-pool-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search players..."
          />
        </Field>

        <div className="flex flex-wrap gap-4 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={rookiesOnly} onCheckedChange={setRookiesOnly} />
            Rookies only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={hideDrafted} onCheckedChange={setHideDrafted} />
            Hide drafted
          </label>
        </div>
      </div>

      <DataTable
        table={table}
        layout="fixed"
        emptyMessage="No players match your filters."
        rowLabel={{ singular: "player", plural: "players" }}
      />
    </div>
  );
}
