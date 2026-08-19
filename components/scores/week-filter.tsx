"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EspnSeasonType } from "@/lib/espn/scoreboard";

export type WeekFilterOption = {
  number: number;
  label: string;
  rangeLabel: string;
  /** Present on NFL Scores when preseason + regular share week numbers. */
  seasonType?: EspnSeasonType;
};

type WeekFilterProps = {
  weeks: WeekFilterOption[];
  value: number;
  /** When set, the matching week shows as "Current week" in the trigger and menu. */
  currentWeek?: number;
  /** Required when weeks include multiple ESPN season types. */
  seasonType?: EspnSeasonType;
  /** When set, updates the URL with replaceState and skips full route navigation. */
  onWeekChange?: (week: number) => void;
  /** When set, prefetches roster data for a week (e.g. on menu hover). */
  onWeekPrefetch?: (week: number) => void;
  disabled?: boolean;
};

function weekDisplayLabel(week: WeekFilterOption, currentWeek?: number) {
  if (currentWeek != null && week.number === currentWeek) {
    return "Current week";
  }
  return week.label;
}

function weekKey(week: WeekFilterOption) {
  return week.seasonType != null
    ? `${week.seasonType}:${week.number}`
    : String(week.number);
}

export function WeekFilter({
  weeks,
  value,
  currentWeek,
  seasonType,
  onWeekChange,
  onWeekPrefetch,
  disabled = false,
}: WeekFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selected =
    weeks.find(
      (week) =>
        week.number === value &&
        (seasonType == null || week.seasonType === seasonType),
    ) ?? weeks.find((week) => week.number === value);

  const items = weeks.map((week) => ({
    value: weekKey(week),
    label: weekDisplayLabel(week, currentWeek),
  }));

  return (
    <Select
      items={items}
      value={selected ? weekKey(selected) : String(value)}
      disabled={disabled}
      onValueChange={(next) => {
        if (!next) {
          return;
        }

        const nextWeek = next.includes(":")
          ? Number(next.split(":")[1])
          : Number(next);
        if (!Number.isFinite(nextWeek)) {
          return;
        }

        if (onWeekChange) {
          const params = new URLSearchParams(searchParams.toString());
          if (next.includes(":")) {
            const [nextSeasonType, weekValue] = next.split(":");
            params.set("week", weekValue);
            params.set("seasontype", nextSeasonType);
          } else {
            params.set("week", next);
            params.delete("seasontype");
          }
          window.history.replaceState(
            null,
            "",
            `${pathname}?${params.toString()}`,
          );
          onWeekChange(nextWeek);
          return;
        }

        const params = new URLSearchParams(searchParams.toString());
        if (next.includes(":")) {
          const [nextSeasonType, nextWeekValue] = next.split(":");
          params.set("week", nextWeekValue);
          params.set("seasontype", nextSeasonType);
        } else {
          params.set("week", next);
          params.delete("seasontype");
        }
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger
        size="sm"
        className="w-fit max-w-none *:data-[slot=select-value]:line-clamp-none"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {weeks.map((week) => (
            <SelectItem
              key={weekKey(week)}
              value={weekKey(week)}
              className="h-auto items-start py-2"
              onMouseEnter={() => onWeekPrefetch?.(week.number)}
              onFocus={() => onWeekPrefetch?.(week.number)}
            >
              <span className="flex flex-col gap-0.5 text-left">
                <span>{weekDisplayLabel(week, currentWeek)}</span>
                {week.rangeLabel ? (
                  <span className="text-xs text-muted-foreground">
                    {week.rangeLabel}
                  </span>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
