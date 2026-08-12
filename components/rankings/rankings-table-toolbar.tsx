"use client";

import type { Table } from "@tanstack/react-table";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  PILL_CLASSNAME,
  PILL_INACTIVE_CLASSNAME,
  PositionPills,
} from "@/components/rankings/filter-pills";
import { PlayerSearchDrawer } from "@/components/rankings/player-search-drawer";
import type { LeagueDraftTableActions } from "@/components/leagues/draft/draft-player-action";
import { NflTeamOption } from "@/components/nfl/nfl-team-option";
import type { RankingsViewState } from "@/components/rankings/rankings-toolbar";
import { useRankingsParams } from "@/components/rankings/use-rankings-params";
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
import { Switch } from "@/components/ui/switch";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DEFAULT_POSITION_FILTER,
  POSITION_FILTERS,
  type PositionFilter,
} from "@/lib/rankings/column-config";
import { getNflTeamLabel } from "@/lib/nfl/teams";
import { RANKINGS_SCORING_OPTIONS } from "@/lib/rankings/scoring-preset";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  FilterHorizontalIcon,
  SearchIcon,
} from "@hugeicons/core-free-icons";

const WEEK_ITEMS = [
  { label: "Season", value: "season" },
  ...Array.from({ length: 18 }, (_, index) => ({
    label: `Week ${index + 1}`,
    value: String(index + 1),
  })),
];

type PlayerSearchActions = {
  leagueSlug: string;
  showWatchlist?: boolean;
  showActions?: boolean;
  actionsEnabled?: boolean;
  tradesEnabled?: boolean;
  acquisitionsLocked?: boolean;
  acquisitionLockReason?: string;
  waiverProcessingLocked?: boolean;
  draftActions?: LeagueDraftTableActions;
};

type RankingsTableToolbarProps<TData> = {
  table: Table<TData>;
  teams: string[];
  seasons: string[];
  currentSeason: string;
  view: RankingsViewState;
  showScoringSelect?: boolean;
  /** NFL team filter — used on global rankings, not league Players. */
  showTeamFilter?: boolean;
  /** Free agents only switch — league Players only. */
  showFreeAgentsFilter?: boolean;
  /** Position options (league roster). Defaults to all positions. */
  positions?: readonly PositionFilter[];
  searchActions?: PlayerSearchActions;
  searchPlaceholder?: string;
};

function FilterSwitches({
  idPrefix,
  view,
  showFreeAgentsFilter,
  updateParams,
  fieldClassName,
  labelFirst,
  switchSize,
}: {
  idPrefix: string;
  view: RankingsViewState;
  showFreeAgentsFilter: boolean;
  updateParams: ReturnType<typeof useRankingsParams>;
  fieldClassName: string;
  labelFirst: boolean;
  switchSize?: "sm" | "default";
}) {
  const switches = [
    {
      id: `${idPrefix}-rookies-only`,
      label: "Rookies only",
      checked: view.rookiesOnly,
      onCheckedChange: (checked: boolean) =>
        updateParams({ rookies: checked ? "1" : null }),
    },
    ...(showFreeAgentsFilter
      ? [
          {
            id: `${idPrefix}-free-agents-only`,
            label: "Free agents only",
            checked: view.freeAgentsOnly,
            onCheckedChange: (checked: boolean) =>
              updateParams({ fa: checked ? null : "0" }),
          },
        ]
      : []),
  ];

  return switches.map((item) => {
    const label = (
      <FieldLabel htmlFor={item.id} className="font-normal">
        {item.label}
      </FieldLabel>
    );
    const control = (
      <Switch
        id={item.id}
        size={switchSize ?? (labelFirst ? "default" : "sm")}
        checked={item.checked}
        onCheckedChange={item.onCheckedChange}
      />
    );

    return (
      <Field key={item.id} orientation="horizontal" className={fieldClassName}>
        {labelFirst ? label : control}
        {labelFirst ? control : label}
      </Field>
    );
  });
}

type ToolbarSelectOption = { label: string; value: string };

type ToolbarSelectConfig = {
  id: string;
  label: string;
  items: ToolbarSelectOption[];
  value: string;
  onSelect: (value: string) => void;
  /** Desktop trigger width; mobile always fills the drawer. */
  width: string;
  renderOption?: (option: ToolbarSelectOption) => ReactNode;
};

function ToolbarSelect({
  config,
  className,
  id,
  size = "sm",
}: {
  config: ToolbarSelectConfig;
  className: string;
  id?: string;
  size?: "sm" | "default" | "lg";
}) {
  const { items, value, onSelect, label, renderOption } = config;

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next) onSelect(String(next));
      }}
    >
      <SelectTrigger id={id} size={size} className={className} aria-label={label}>
        {renderOption ? (
          <SelectValue>
            {(current) => {
              const option = items.find((item) => item.value === current);
              return option ? renderOption(option) : null;
            }}
          </SelectValue>
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {renderOption ? renderOption(item) : item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function RankingsTableToolbar<TData>({
  table: _table,
  teams,
  seasons,
  currentSeason,
  view,
  showScoringSelect = true,
  showTeamFilter = true,
  showFreeAgentsFilter = false,
  positions = POSITION_FILTERS,
  searchActions,
  searchPlaceholder = "Search players...",
}: RankingsTableToolbarProps<TData>) {
  void _table;
  const updateParams = useRankingsParams();
  const [searchDraft, setSearchDraft] = useState(view.search ?? "");
  const [prevViewSearch, setPrevViewSearch] = useState(view.search);
  const positionOptions =
    positions.length > 0 ? positions : POSITION_FILTERS;
  const defaultPosition = positionOptions[0] ?? DEFAULT_POSITION_FILTER;

  if (view.search !== prevViewSearch) {
    setPrevViewSearch(view.search);
    const server = (view.search ?? "").trim();
    const local = searchDraft.trim();
    if (local === server || !local.startsWith(server)) {
      setSearchDraft(view.search ?? "");
    }
  }

  useEffect(() => {
    const trimmed = searchDraft.trim();
    const current = (view.search ?? "").trim();
    if (trimmed === current) return;

    const handle = window.setTimeout(() => {
      updateParams({ q: trimmed ? trimmed : null });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchDraft, updateParams, view.search]);

  const seasonItems = useMemo(
    () =>
      (view.kind === "projection" ? [currentSeason] : seasons).map(
        (season) => ({ label: season, value: season }),
      ),
    [currentSeason, seasons, view.kind],
  );

  const teamItems = useMemo(
    () => [
      { label: "All teams", value: "ALL" },
      ...teams.map((team) => ({
        label: getNflTeamLabel(team),
        value: team,
      })),
    ],
    [teams],
  );

  const positionItems = useMemo(
    () =>
      positionOptions.map((position) => ({
        label: position,
        value: position,
      })),
    [positionOptions],
  );

  const scoringItems = useMemo(
    () =>
      RANKINGS_SCORING_OPTIONS.map((option) => ({
        label: option.label,
        value: option.value,
      })),
    [],
  );

  const handlePositionChange = (value: string) => {
    updateParams({
      position: value === defaultPosition ? null : value,
    });
  };

  const yearSelect: ToolbarSelectConfig = {
    id: "year",
    label: "Year",
    items: seasonItems,
    value: view.season,
    width: "w-24",
    onSelect: (value) =>
      updateParams({ season: value === currentSeason ? null : value }),
  };

  const weekSelect: ToolbarSelectConfig = {
    id: "week",
    label: "Season / week",
    items: WEEK_ITEMS,
    value: view.week,
    width: "w-32",
    onSelect: (value) =>
      updateParams({ week: value === "season" ? null : value }),
  };

  const scoringSelect: ToolbarSelectConfig = {
    id: "scoring",
    label: "Scoring",
    items: scoringItems,
    value: view.scoring,
    width: "w-32",
    onSelect: (value) =>
      updateParams({ scoring: value === "full_ppr" ? null : value }),
  };

  const teamSelect: ToolbarSelectConfig = {
    id: "team",
    label: "Team",
    items: teamItems,
    value: view.team,
    width: "w-56",
    onSelect: (value) => updateParams({ team: value === "ALL" ? null : value }),
    renderOption: (option) =>
      option.value === "ALL" ? (
        option.label
      ) : (
        <NflTeamOption abbrev={option.value} />
      ),
  };

  const primarySelects = [
    yearSelect,
    weekSelect,
    ...(showScoringSelect ? [scoringSelect] : []),
  ];
  const drawerSelects = [
    ...primarySelects,
    ...(showTeamFilter ? [teamSelect] : []),
  ];

  const searchInput = (
    <>
      <InputGroupAddon align="inline-start">
        <HugeiconsIcon icon={SearchIcon} strokeWidth={2} />
      </InputGroupAddon>
      <InputGroupInput
        placeholder={searchPlaceholder}
        value={searchDraft}
        onChange={(event) => setSearchDraft(event.target.value)}
      />
      {searchDraft ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label="Clear search"
            className="relative after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2"
            onClick={() => {
              setSearchDraft("");
              updateParams({ q: null });
            }}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </>
  );

  return (
    <div className="flex w-full flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3 max-md:hidden">
        {primarySelects.map((config) => (
          <ToolbarSelect
            key={config.id}
            config={config}
            className={config.width}
          />
        ))}
      </div>

      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto overscroll-x-contain md:hidden">
        <PlayerSearchDrawer
          season={view.season}
          scoring={view.scoring}
          searchPlaceholder={searchPlaceholder}
          leagueSlug={searchActions?.leagueSlug}
          showWatchlist={searchActions?.showWatchlist}
          showActions={searchActions?.showActions}
          actionsEnabled={searchActions?.actionsEnabled}
          tradesEnabled={searchActions?.tradesEnabled}
          acquisitionsLocked={searchActions?.acquisitionsLocked}
          acquisitionLockReason={searchActions?.acquisitionLockReason}
          waiverProcessingLocked={searchActions?.waiverProcessingLocked}
          draftActions={searchActions?.draftActions}
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
                Narrow down the player list
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-6 p-4 pt-2">
              {drawerSelects.map((config) => (
                <Field key={config.id} className="gap-2">
                  <FieldLabel htmlFor={`mobile-${config.id}`}>
                    {config.label}
                  </FieldLabel>
                  <ToolbarSelect
                    config={config}
                    id={`mobile-${config.id}`}
                    size="lg"
                    className="w-full"
                  />
                </Field>
              ))}
              <FilterSwitches
                idPrefix="mobile"
                view={view}
                showFreeAgentsFilter={showFreeAgentsFilter}
                updateParams={updateParams}
                fieldClassName="w-full justify-between gap-3"
                labelFirst
                switchSize="default"
              />
            </div>
          </DrawerContent>
        </Drawer>

        <PositionPills
          value={view.position}
          onSelect={handlePositionChange}
          positions={positionOptions}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 max-md:hidden">
        <FilterSwitches
          idPrefix="desktop"
          view={view}
          showFreeAgentsFilter={showFreeAgentsFilter}
          updateParams={updateParams}
          fieldClassName="w-auto gap-2"
          labelFirst={false}
        />

        {showTeamFilter ? (
          <ToolbarSelect config={teamSelect} className={teamSelect.width} />
        ) : null}

        <Select
          items={positionItems}
          value={view.position}
          onValueChange={(value) => {
            if (value) {
              handlePositionChange(value);
            }
          }}
        >
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {positionItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <InputGroup className="h-8 w-[200px]">{searchInput}</InputGroup>
      </div>
    </div>
  );
}
