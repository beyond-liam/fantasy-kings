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
  /** Required when weeks include multiple ESPN season types. */
  seasonType?: EspnSeasonType;
};

function weekKey(week: WeekFilterOption) {
  return week.seasonType != null
    ? `${week.seasonType}:${week.number}`
    : String(week.number);
}

export function WeekFilter({ weeks, value, seasonType }: WeekFilterProps) {
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
    label: week.label,
  }));

  return (
    <Select
      items={items}
      value={selected ? weekKey(selected) : String(value)}
      onValueChange={(next) => {
        if (!next) {
          return;
        }

        const params = new URLSearchParams(searchParams.toString());
        if (next.includes(":")) {
          const [nextSeasonType, nextWeek] = next.split(":");
          params.set("week", nextWeek);
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
      <SelectContent>
        <SelectGroup>
          {weeks.map((week) => (
            <SelectItem
              key={weekKey(week)}
              value={weekKey(week)}
              className="h-auto items-start py-2 [&>span]:whitespace-normal"
            >
              <span className="flex flex-col gap-0.5 text-left">
                <span>{week.label}</span>
                <span className="text-xs text-muted-foreground">
                  {week.rangeLabel}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
