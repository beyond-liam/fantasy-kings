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

type YearFilterProps = {
  years: number[];
  value: number;
};

export function YearFilter({ years, value }: YearFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const disabled = years.length <= 1;

  const items = years.map((year) => ({
    value: String(year),
    label: String(year),
  }));

  return (
    <Select
      items={items}
      value={String(value)}
      disabled={disabled}
      onValueChange={(next) => {
        if (!next || disabled) {
          return;
        }

        const params = new URLSearchParams(searchParams.toString());
        params.set("year", next);
        // Changing year resets week selection to default for that season.
        params.delete("week");
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger
        size="sm"
        className="w-24"
        aria-label="Season year"
        title={
          disabled
            ? "Only one season is available"
            : "Select season year"
        }
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {years.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
