"use client";

import { useDeferredValue, useMemo, useState, type CSSProperties } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  Cancel01Icon,
  FilterHorizontalIcon,
  SearchIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { DraftPlayerAction } from "@/components/leagues/draft/draft-player-action";
import { DraftQueueToggle } from "@/components/leagues/draft/draft-queue-toggle";
import { NflTeamOption } from "@/components/nfl/nfl-team-option";
import {
  PILL_CLASSNAME,
  PILL_INACTIVE_CLASSNAME,
  PositionPills,
} from "@/components/rankings/filter-pills";
import { PlayerIdentity } from "@/components/rankings/player-identity";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableColumnHeader,
  useDataTable,
} from "@/components/ui/data-table";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import { getNflTeamLabel } from "@/lib/nfl/teams";
import { cn } from "@/lib/utils";
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
  sortableRankValue,
  sortableStatValue,
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
/** Mobile shows an icon-only draft button, so the cell only needs the icon + padding. */
const ACTION_COLUMN_WIDTH_MOBILE = 48;
const PLAYER_COLUMN_WIDTH = 220;
/** Narrower so the pinned action + player columns leave room to scroll. */
const PLAYER_COLUMN_WIDTH_MOBILE = 168;

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

/** Gap between the search sheet and the viewport edges. */
const SHEET_INSET = "0.5rem";
const SEARCH_RESULT_LIMIT = 50;

type DraftPlayerSearchSheetProps = Pick<
  DraftPlayerPoolProps,
  | "slug"
  | "draftLive"
  | "draftComplete"
  | "isMyTurn"
  | "isCommissioner"
  | "onDraftPlayer"
> & {
  players: RankedPlayerRow[];
  drafted: Set<string>;
  hideDrafted: boolean;
  showQueue: boolean;
};

function DraftPlayerSearchSheet({
  players,
  drafted,
  hideDrafted,
  slug,
  draftLive,
  draftComplete,
  isMyTurn,
  isCommissioner,
  showQueue,
  onDraftPlayer,
}: DraftPlayerSearchSheetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const matches = players.filter((player) => {
      if (hideDrafted && drafted.has(player.id)) return false;
      return !needle || player.fullName.toLowerCase().includes(needle);
    });
    return matches.slice(0, SEARCH_RESULT_LIMIT);
  }, [deferredQuery, drafted, hideDrafted, players]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="Search players"
            className={cn(
              PILL_CLASSNAME,
              PILL_INACTIVE_CLASSNAME,
              "flex items-center",
            )}
          />
        }
      >
        <HugeiconsIcon icon={SearchIcon} strokeWidth={2} size={16} />
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-xl border"
        style={
          {
            top: SHEET_INSET,
            bottom: SHEET_INSET,
            left: SHEET_INSET,
            right: SHEET_INSET,
          } as CSSProperties
        }
      >
        <SheetHeader className="gap-3 border-b border-border p-2">
          <SheetTitle className="sr-only">Search players</SheetTitle>
          <SheetDescription className="sr-only">
            Search the draft player pool
          </SheetDescription>
          <div className="flex items-center gap-2">
            <InputGroup className="h-10 flex-1">
              <InputGroupAddon align="inline-start">
                <HugeiconsIcon icon={SearchIcon} strokeWidth={2} />
              </InputGroupAddon>
              <InputGroupInput
                autoFocus
                placeholder="Search players..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Clear search"
                    className="relative after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2"
                    onClick={() => setQuery("")}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
            <SheetClose render={<Button variant="ghost" size="icon" />}>
              <HugeiconsIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No players match your search.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((player) => {
                const isDrafted = drafted.has(player.id);

                return (
                  <li
                    key={player.id}
                    className="flex items-center gap-2 px-3 py-2.5"
                  >
                    <DraftPlayerAction
                      slug={slug}
                      playerId={player.id}
                      drafted={isDrafted}
                      canDraft={draftLive && isMyTurn && !isDrafted}
                      canCommissionerPick={
                        draftLive && isCommissioner && !isMyTurn && !isDrafted
                      }
                      hideActions={draftComplete}
                      disabledReason={
                        draftLive && !isMyTurn
                          ? "Waiting for your turn."
                          : "Draft has not started."
                      }
                      onDraft={
                        onDraftPlayer
                          ? () => onDraftPlayer(player.id)
                          : undefined
                      }
                    />
                    <PlayerIdentity
                      className="min-w-0 flex-1"
                      fullName={player.fullName}
                      sleeperId={player.sleeperId}
                      primaryPositionId={player.primaryPositionId}
                      nflTeam={player.nflTeam}
                      byeWeek={player.byeWeek}
                      injuryStatus={player.injuryStatus}
                      playerId={player.id}
                      leagueSlug={slug === "mock" ? undefined : slug}
                    />
                    {showQueue ? (
                      <DraftQueueToggle
                        playerId={player.id}
                        disabled={isDrafted}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
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
  const isMobile = useIsMobile();
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
      ...teams.map((value) => ({
        label: getNflTeamLabel(value),
        value,
      })),
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

    const actionWidth = isMobile
      ? ACTION_COLUMN_WIDTH_MOBILE
      : ACTION_COLUMN_WIDTH;
    const playerWidth = isMobile
      ? PLAYER_COLUMN_WIDTH_MOBILE
      : PLAYER_COLUMN_WIDTH;

    const actionColumn: ColumnDef<RankedPlayerRow> = {
      id: "action",
      enableSorting: false,
      size: actionWidth,
      meta: {
        width: actionWidth,
        sticky: isMobile ? "left" : undefined,
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
    };

    const playerColumn: ColumnDef<RankedPlayerRow> = {
      id: "player",
      accessorFn: (row) => row.fullName,
      enableSorting: false,
      size: playerWidth,
      meta: {
        width: playerWidth,
        sticky: isMobile ? "left" : undefined,
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
            leagueSlug={slug === "mock" ? undefined : slug}
          />
        );
      },
    };

    const middleColumns: ColumnDef<RankedPlayerRow>[] = [
      playerColumn,
      {
        id: "positionRank",
        accessorFn: (row) => sortableRankValue(row.positionRank),
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
              ? sortableStatValue(getAdp(row.stats))
              : column.key === "fantasy_pts"
                ? sortableStatValue(getFantasyPts(row))
                : sortableStatValue(row.stats[column.key]),
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
    ];

    // Desktop: queue | player | stats | draft. Mobile: draft | player | stats | queue.
    if (isMobile) {
      return [
        actionColumn,
        ...middleColumns,
        ...(showQueue ? [queueColumn] : []),
      ];
    }

    return [
      ...(showQueue ? [queueColumn] : []),
      ...middleColumns,
      actionColumn,
    ];
  }, [
    draftComplete,
    draftLive,
    drafted,
    isCommissioner,
    isMobile,
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

  const teamSelect = (
    size: "sm" | "default" | "lg" = "default",
    className = "w-full",
  ) => (
    <Select
      items={teamItems}
      value={team}
      onValueChange={(value) => {
        if (value) setTeam(value);
      }}
    >
      <SelectTrigger size={size} className={className} aria-label="NFL team">
        <SelectValue>
          {(value) =>
            value && value !== "ALL" ? (
              <NflTeamOption abbrev={String(value)} />
            ) : (
              "All teams"
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="ALL">All teams</SelectItem>
          {teams.map((value) => (
            <SelectItem key={value} value={value}>
              <NflTeamOption abbrev={value} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  const positionSelect = (
    size: "sm" | "default" | "lg" = "sm",
    className = "w-32",
  ) => (
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
      <SelectTrigger size={size} className={className} aria-label="Position">
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
  );

  const desktopSearch = (
    <InputGroup className="h-8 w-[200px]">
      <InputGroupAddon align="inline-start">
        <HugeiconsIcon icon={SearchIcon} strokeWidth={2} />
      </InputGroupAddon>
      <InputGroupInput
        placeholder="Search players..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label="Search players"
      />
      {search ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label="Clear search"
            className="relative after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2"
            onClick={() => setSearch("")}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto overscroll-x-contain md:hidden">
        <DraftPlayerSearchSheet
          players={data}
          drafted={drafted}
          hideDrafted={hideDrafted}
          slug={slug}
          draftLive={draftLive}
          draftComplete={draftComplete}
          isMyTurn={isMyTurn}
          isCommissioner={isCommissioner}
          showQueue={showQueue}
          onDraftPlayer={onDraftPlayer}
        />

        <Drawer showSwipeHandle>
          <DrawerTrigger
            render={
              <button
                type="button"
                aria-label="Filters"
                className={cn(
                  PILL_CLASSNAME,
                  PILL_INACTIVE_CLASSNAME,
                  "flex items-center",
                )}
              />
            }
          >
            <HugeiconsIcon
              icon={FilterHorizontalIcon}
              strokeWidth={2}
              size={16}
            />
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Filters</DrawerTitle>
              <DrawerDescription className="sr-only">
                Narrow down the player pool
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-6 p-4 pt-2">
              <Field className="gap-2">
                <FieldLabel htmlFor="draft-pool-mobile-team">
                  NFL team
                </FieldLabel>
                <div id="draft-pool-mobile-team">{teamSelect("lg")}</div>
              </Field>

              <Field
                orientation="horizontal"
                className="w-full justify-between gap-3"
              >
                <FieldLabel
                  htmlFor="draft-pool-hide-drafted"
                  className="font-normal"
                >
                  Hide drafted
                </FieldLabel>
                <Switch
                  id="draft-pool-hide-drafted"
                  checked={hideDrafted}
                  onCheckedChange={setHideDrafted}
                />
              </Field>

              <Field
                orientation="horizontal"
                className="w-full justify-between gap-3"
              >
                <FieldLabel
                  htmlFor="draft-pool-rookies"
                  className="font-normal"
                >
                  Rookies only
                </FieldLabel>
                <Switch
                  id="draft-pool-rookies"
                  checked={rookiesOnly}
                  onCheckedChange={setRookiesOnly}
                />
              </Field>
            </div>
          </DrawerContent>
        </Drawer>

        <PositionPills
          value={position}
          onSelect={(next) => {
            setPosition(next);
            setSorting(DEFAULT_SORTING);
          }}
        />
      </div>

      <div className="flex w-full flex-wrap items-center gap-3 max-md:hidden">
        {desktopSearch}
        {positionSelect("sm", "w-32")}
        {teamSelect("sm", "w-56")}
        <Field orientation="horizontal" className="w-auto gap-2">
          <Switch
            id="draft-pool-desktop-hide-drafted"
            size="sm"
            checked={hideDrafted}
            onCheckedChange={setHideDrafted}
          />
          <FieldLabel
            htmlFor="draft-pool-desktop-hide-drafted"
            className="font-normal"
          >
            Hide drafted
          </FieldLabel>
        </Field>
        <Field orientation="horizontal" className="w-auto gap-2">
          <Switch
            id="draft-pool-desktop-rookies"
            size="sm"
            checked={rookiesOnly}
            onCheckedChange={setRookiesOnly}
          />
          <FieldLabel
            htmlFor="draft-pool-desktop-rookies"
            className="font-normal"
          >
            Rookies only
          </FieldLabel>
        </Field>
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
