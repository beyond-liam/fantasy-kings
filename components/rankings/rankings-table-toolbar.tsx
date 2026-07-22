"use client";

import type { Table } from "@tanstack/react-table";
import { useMemo } from "react";

import type { RankingsViewState } from "@/components/rankings/rankings-toolbar";
import { useRankingsParams } from "@/components/rankings/use-rankings-params";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Field, FieldLabel } from "@/components/ui/field";
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
  DEFAULT_POSITION_FILTER,
  POSITION_FILTERS,
} from "@/lib/rankings/column-config";
import { RANKINGS_SCORING_OPTIONS } from "@/lib/rankings/scoring-preset";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, SearchIcon } from "@hugeicons/core-free-icons";

const WEEK_ITEMS = [
  { label: "Season", value: "season" },
  ...Array.from({ length: 18 }, (_, index) => ({
    label: `Week ${index + 1}`,
    value: String(index + 1),
  })),
];

type RankingsTableToolbarProps<TData> = {
  table: Table<TData>;
  teams: string[];
  seasons: string[];
  currentSeason: string;
  view: RankingsViewState;
  showScoringSelect?: boolean;
  /** NFL team filter — used on global rankings, not league Players. */
  showTeamFilter?: boolean;
  /** Free agents only switch — used on league Players instead of team filter. */
  showFreeAgentsFilter?: boolean;
  searchColumnId?: string;
  searchPlaceholder?: string;
};

export function RankingsTableToolbar<TData>({
  table,
  teams,
  seasons,
  currentSeason,
  view,
  showScoringSelect = true,
  showTeamFilter = true,
  showFreeAgentsFilter = false,
  searchColumnId = "player",
  searchPlaceholder = "Search players...",
}: RankingsTableToolbarProps<TData>) {
  const updateParams = useRankingsParams();
  const searchColumn = table.getColumn(searchColumnId);
  const searchValue = (searchColumn?.getFilterValue() as string) ?? "";

  const seasonItems = useMemo(
    () => seasons.map((season) => ({ label: season, value: season })),
    [seasons],
  );

  const teamItems = useMemo(
    () => [
      { label: "All teams", value: "ALL" },
      ...teams.map((team) => ({ label: team, value: team })),
    ],
    [teams],
  );

  const positionItems = useMemo(
    () =>
      POSITION_FILTERS.map((position) => ({
        label: position,
        value: position,
      })),
    [],
  );

  const scoringItems = useMemo(
    () =>
      RANKINGS_SCORING_OPTIONS.map((option) => ({
        label: option.label,
        value: option.value,
      })),
    [],
  );

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          items={seasonItems}
          value={view.season}
          onValueChange={(value) => {
            if (value) {
              updateParams({
                season: value === currentSeason ? null : value,
              });
            }
          }}
        >
          <SelectTrigger size="sm" className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {seasonItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {showScoringSelect ? (
          <Select
            items={scoringItems}
            value={view.scoring}
            onValueChange={(value) => {
              if (value) {
                updateParams({
                  scoring: value === "full_ppr" ? null : value,
                });
              }
            }}
          >
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {scoringItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}

        <Select
          items={WEEK_ITEMS}
          value={view.week}
          onValueChange={(value) => {
            if (value) {
              updateParams({
                week: value === "season" ? null : value,
              });
            }
          }}
        >
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {WEEK_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Field orientation="horizontal" className="w-auto gap-2">
          <Switch
            id="rookies-only"
            size="sm"
            checked={view.rookiesOnly}
            onCheckedChange={(checked) => {
              updateParams({
                rookies: checked ? "1" : null,
              });
            }}
          />
          <FieldLabel htmlFor="rookies-only" className="font-normal">
            Rookies only
          </FieldLabel>
        </Field>

        {showFreeAgentsFilter ? (
          <Field orientation="horizontal" className="w-auto gap-2">
            <Switch
              id="free-agents-only"
              size="sm"
              checked={view.freeAgentsOnly}
              onCheckedChange={(checked) => {
                updateParams({
                  fa: checked ? null : "0",
                });
              }}
            />
            <FieldLabel htmlFor="free-agents-only" className="font-normal">
              Free agents only
            </FieldLabel>
          </Field>
        ) : null}

        {showTeamFilter ? (
          <Select
            items={teamItems}
            value={view.team}
            onValueChange={(value) => {
              if (value) {
                updateParams({
                  team: value === "ALL" ? null : value,
                });
              }
            }}
          >
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {teamItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}

        <Select
          items={positionItems}
          value={view.position}
          onValueChange={(value) => {
            if (value) {
              updateParams({
                position: value === DEFAULT_POSITION_FILTER ? null : value,
              });
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

        <InputGroup className="h-8 w-[200px]">
          <InputGroupAddon align="inline-start">
            <HugeiconsIcon icon={SearchIcon} strokeWidth={2} />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) =>
              searchColumn?.setFilterValue(event.target.value)
            }
          />
          {searchValue ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Clear search"
                className="relative after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2"
                onClick={() => searchColumn?.setFilterValue("")}
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </div>
    </div>
  );
}
