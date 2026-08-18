"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type HofSeasonFilterProps = {
  years: number[];
  value: number | null;
};

export function HofSeasonFilter({ years, value }: HofSeasonFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      items={[
        { value: "all", label: "All time" },
        ...years.map((year) => ({
          value: String(year),
          label: String(year),
        })),
      ]}
      value={value == null ? "all" : String(value)}
      onValueChange={(next) => {
        if (!next) return;
        const params = new URLSearchParams(searchParams.toString());
        if (next === "all") {
          params.delete("year");
        } else {
          params.set("year", next);
        }
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
      }}
    >
      <SelectTrigger size="sm" className="w-28" aria-label="Season filter">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="all">All time</SelectItem>
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
