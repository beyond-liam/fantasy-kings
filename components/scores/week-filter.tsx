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

export type WeekFilterOption = {
  number: number;
  label: string;
  rangeLabel: string;
};

type WeekFilterProps = {
  weeks: WeekFilterOption[];
  value: number;
};

export function WeekFilter({ weeks, value }: WeekFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const items = weeks.map((week) => ({
    value: String(week.number),
    label: week.label,
  }));

  return (
    <Select
      items={items}
      value={String(value)}
      onValueChange={(next) => {
        if (!next) {
          return;
        }

        const params = new URLSearchParams(searchParams.toString());
        params.set("week", next);
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger size="sm" className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {weeks.map((week) => (
            <SelectItem
              key={week.number}
              value={String(week.number)}
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
