"use client";

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
  disabled?: boolean;
  onSeasonChange: (season: string) => void;
};

export function PlayerSeasonSelect({
  season,
  availableSeasons,
  disabled = false,
  onSeasonChange,
}: PlayerSeasonSelectProps) {
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
      disabled={disabled || seasons.length <= 1}
      onValueChange={(value) => {
        if (!value || value === season) return;
        onSeasonChange(value);
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
