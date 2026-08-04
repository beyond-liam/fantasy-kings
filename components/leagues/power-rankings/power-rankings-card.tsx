"use client";

import { useMemo, useState } from "react";

import { PowerRankingsList } from "@/components/leagues/power-rankings/power-rankings-list";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildScaffoldPowerRankingRows } from "@/lib/leagues/power-rankings/scaffold";
import type { PowerRankingMode } from "@/lib/leagues/power-rankings/types";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";

type PowerRankingsCardProps = {
  leagueSlug: string;
  standingsTeams: LeagueStandingsMember[];
  /** Fantasy week used for the Week X option (current/upcoming slate). */
  upcomingWeek: number;
};

export function PowerRankingsCard({
  leagueSlug,
  standingsTeams,
  upcomingWeek,
}: PowerRankingsCardProps) {
  const [mode, setMode] = useState<PowerRankingMode>("draft");

  const modeItems = useMemo(
    () => [
      { value: "draft" as const, label: "Draft Rankings" },
      { value: "week" as const, label: `Week ${upcomingWeek}` },
      { value: "rest-of-season" as const, label: "Rest of Season" },
    ],
    [upcomingWeek],
  );

  const rows = useMemo(
    () => buildScaffoldPowerRankingRows(standingsTeams, mode),
    [standingsTeams, mode],
  );

  return (
    <div className="flex flex-col gap-4">
      <Select
        items={modeItems}
        value={mode}
        onValueChange={(value) => {
          if (
            value === "draft" ||
            value === "week" ||
            value === "rest-of-season"
          ) {
            setMode(value);
          }
        }}
      >
        <SelectTrigger
          size="sm"
          className="w-[10.5rem]"
          aria-label="Power rankings mode"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectGroup>
            {modeItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Card size="sm" className="gap-0 py-0">
        <CardHeader variant="panel">
          <CardTitle className="text-base text-balance">Power Rankings</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <PowerRankingsList rows={rows} leagueSlug={leagueSlug} />
        </CardContent>
      </Card>
    </div>
  );
}
