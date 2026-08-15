"use client";

import { useMemo, useState } from "react";

import {
  PowerRankingsMyRankCard,
  PowerRankingsTrendCard,
} from "@/components/leagues/power-rankings/power-rankings-overview-cards";
import { PowerRankingsList } from "@/components/leagues/power-rankings/power-rankings-list";
import { PowerRankingsSeasonChart } from "@/components/leagues/power-rankings/power-rankings-season-chart";
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
import type {
  PowerRankingMode,
  PowerRankingTeamRow,
} from "@/lib/leagues/power-rankings/types";
import type {
  PowerRankTeamSummary,
  PowerRankTrendEntry,
} from "@/lib/leagues/power-rankings/trajectory";

type PowerRankingsCardProps = {
  leagueSlug: string;
  upcomingWeek: number;
  draftRows: PowerRankingTeamRow[];
  weekRows: PowerRankingTeamRow[];
  rosRows: PowerRankingTeamRow[];
  chartData: Array<Record<string, string | number>>;
  summaries: PowerRankTeamSummary[];
  trendingUp: PowerRankTrendEntry[];
  trendingDown: PowerRankTrendEntry[];
  teamCount: number;
  myTeamId: string | null;
  mySummary: PowerRankTeamSummary | null;
};

export function PowerRankingsCard({
  leagueSlug,
  upcomingWeek,
  draftRows,
  weekRows,
  rosRows,
  chartData,
  summaries,
  trendingUp,
  trendingDown,
  teamCount,
  myTeamId,
  mySummary,
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

  const rows =
    mode === "draft" ? draftRows : mode === "week" ? weekRows : rosRows;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <PowerRankingsTrendCard
          title="Trending Up"
          description="Biggest rank gain."
          direction="up"
          teams={trendingUp}
          leagueSlug={leagueSlug}
        />
        <PowerRankingsTrendCard
          title="Trending Down"
          description="Biggest rank drop."
          direction="down"
          teams={trendingDown}
          leagueSlug={leagueSlug}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <PowerRankingsMyRankCard
          title="Current Rank"
          description="Your current league power ranking."
          rank={mySummary?.currentRank ?? null}
          teamCount={teamCount}
        />
        <PowerRankingsMyRankCard
          title="Draft Rank"
          description="Where you stood when the draft power rankings landed."
          rank={mySummary?.draftRank ?? null}
          teamCount={teamCount}
        />
      </div>

      <PowerRankingsSeasonChart
        chartData={chartData}
        summaries={summaries}
        teamCount={teamCount}
        myTeamId={myTeamId}
      />

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
            <CardTitle className="text-base text-balance">
              Power Rankings
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <PowerRankingsList rows={rows} leagueSlug={leagueSlug} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
