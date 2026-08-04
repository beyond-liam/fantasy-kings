"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PlayerSeasonSelectProps = {
  season: string;
  availableSeasons: string[];
  playerId: string;
  leagueSlug: string | null;
};

export function PlayerSeasonSelect({
  season,
  availableSeasons,
  playerId,
  leagueSlug,
}: PlayerSeasonSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const seasons =
    availableSeasons.length > 0 ? availableSeasons : [season];
  const items = seasons.map((year) => ({
    value: year,
    label: year,
  }));

  return (
    <Select
      items={items}
      value={season}
      disabled={isPending || seasons.length <= 1}
      onValueChange={(value) => {
        if (!value || value === season) return;
        const params = new URLSearchParams();
        params.set("season", value);
        if (leagueSlug) params.set("league", leagueSlug);
        startTransition(() => {
          router.push(`/players/${playerId}?${params.toString()}`);
        });
      }}
    >
      <SelectTrigger size="sm" className="w-30" aria-label="Season">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
