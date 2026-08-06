"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  chartColorVar,
  type PowerRankTeamSummary,
} from "@/lib/leagues/power-rankings/trajectory";

type PowerRankingsSeasonChartProps = {
  chartData: Array<Record<string, string | number>>;
  summaries: PowerRankTeamSummary[];
  teamCount: number;
  myTeamId: string | null;
};

type TooltipPayloadEntry = {
  dataKey?: unknown;
  value?: unknown;
  color?: string;
};

function formatRank(value: number | null) {
  return value == null ? "—" : String(value);
}

/**
 * LineChart only allows axis tooltips (`shared={false}` is ignored), so pick
 * the series whose rank is closest to the cursor’s vertical position.
 */
function pickNearestSeries(
  payload: ReadonlyArray<TooltipPayloadEntry>,
  cursorY: number | null,
  plotHeight: number | null,
  teamCount: number,
): TooltipPayloadEntry | null {
  if (payload.length === 0) return null;
  if (cursorY == null || plotHeight == null || plotHeight <= 0 || teamCount <= 1) {
    return payload[0] ?? null;
  }

  // Plot sits above the x-axis ticks; top padding matches chart margin.
  const top = 8;
  const bottom = Math.max(top + 1, plotHeight - 28);
  const t = Math.min(1, Math.max(0, (cursorY - top) / (bottom - top)));
  // Reversed Y: rank 1 at top.
  const targetRank = 1 + t * (teamCount - 1);

  let best: TooltipPayloadEntry = payload[0]!;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const entry of payload) {
    const value =
      typeof entry.value === "number" ? entry.value : Number(entry.value);
    if (!Number.isFinite(value)) continue;
    const dist = Math.abs(value - targetRank);
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  return best;
}

function PowerRankTeamTooltip({
  active,
  payload,
  summariesById,
  chartConfig,
  cursorY,
  plotHeight,
  teamCount,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadEntry>;
  summariesById: Map<string, PowerRankTeamSummary>;
  chartConfig: ChartConfig;
  cursorY: number | null;
  plotHeight: number | null;
  teamCount: number;
}) {
  if (!active || !payload?.length) return null;

  const entry = pickNearestSeries(payload, cursorY, plotHeight, teamCount);
  const rawKey = entry?.dataKey;
  const teamId = typeof rawKey === "string" ? rawKey : null;
  if (!teamId) return null;
  const summary = summariesById.get(teamId);
  if (!summary) return null;

  const swatch =
    entry?.color ??
    (typeof chartConfig[teamId]?.color === "string"
      ? chartConfig[teamId].color
      : undefined);

  return (
    <div className="grid min-w-48 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        {swatch ? (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: swatch }}
          />
        ) : null}
        <span className="font-semibold text-foreground text-balance">
          {summary.teamName}
        </span>
      </div>
      <div className="grid gap-1 text-muted-foreground">
        <div className="flex justify-between gap-6">
          <span>Draft ranking</span>
          <span className="font-medium tabular-nums text-foreground">
            {formatRank(summary.draftRank)}
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span>Current ranking</span>
          <span className="font-medium tabular-nums text-foreground">
            {formatRank(summary.currentRank)}
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span>Highest ranking</span>
          <span className="font-medium tabular-nums text-foreground">
            {formatRank(summary.highestRank)}
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span>Lowest ranking</span>
          <span className="font-medium tabular-nums text-foreground">
            {formatRank(summary.lowestRank)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PowerRankingsSeasonChart({
  chartData,
  summaries,
  teamCount,
  myTeamId,
}: PowerRankingsSeasonChartProps) {
  const [cursorY, setCursorY] = useState<number | null>(null);
  const [plotHeight, setPlotHeight] = useState<number | null>(null);

  const summariesById = useMemo(
    () => new Map(summaries.map((row) => [row.teamId, row] as const)),
    [summaries],
  );

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    summaries.forEach((team, index) => {
      config[team.teamId] = {
        label: team.teamName,
        color: chartColorVar(index),
      };
    });
    return config;
  }, [summaries]);

  const legendOrder = useMemo(() => {
    const ids = summaries.map((team) => team.teamId);
    if (!myTeamId) return ids;
    return [myTeamId, ...ids.filter((teamId) => teamId !== myTeamId)];
  }, [myTeamId, summaries]);

  return (
    <Card size="sm" className="gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle className="text-balance">Season trajectory</CardTitle>
        <CardDescription className="text-pretty">
          Rank from draft through each scored week. Lower on the chart is
          better.
        </CardDescription>
      </CardHeader>
      <CardContent className="py-4">
        {chartData.length === 0 || summaries.length === 0 ? (
          <Empty className="min-h-72" size="sm">
            <EmptyHeader>
              <EmptyTitle>No ranking history yet</EmptyTitle>
              <EmptyDescription>
                Appears once draft rankings are available.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-3">
            <div
              onMouseMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setCursorY(event.clientY - rect.top);
                setPlotHeight(rect.height);
              }}
              onMouseLeave={() => {
                setCursorY(null);
              }}
            >
              <ChartContainer
                config={chartConfig}
                className="aspect-auto h-80 w-full"
              >
                <LineChart
                  accessibilityLayer
                  data={chartData}
                  margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                  />
                  <YAxis
                    reversed
                    domain={[1, Math.max(1, teamCount)]}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={28}
                    ticks={Array.from(
                      { length: Math.max(1, teamCount) },
                      (_, index) => index + 1,
                    )}
                  />
                  <ChartTooltip
                    content={(props) => (
                      <PowerRankTeamTooltip
                        active={props.active}
                        payload={props.payload}
                        summariesById={summariesById}
                        chartConfig={chartConfig}
                        cursorY={cursorY}
                        plotHeight={plotHeight}
                        teamCount={teamCount}
                      />
                    )}
                  />
                  {summaries.map((team) => {
                    const isMine = myTeamId != null && team.teamId === myTeamId;
                    return (
                      <Line
                        key={team.teamId}
                        dataKey={team.teamId}
                        type="monotone"
                        stroke={`var(--color-${team.teamId})`}
                        strokeWidth={isMine ? 3 : 1.75}
                        strokeOpacity={isMine ? 1 : 0.85}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    );
                  })}
                </LineChart>
              </ChartContainer>
            </div>

            <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 px-1">
              {legendOrder.map((teamId) => {
                const summary = summariesById.get(teamId);
                if (!summary) return null;
                const color = chartConfig[teamId]?.color;
                return (
                  <li
                    key={teamId}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span
                      className="size-2 shrink-0 rounded-[2px]"
                      style={
                        typeof color === "string"
                          ? { backgroundColor: color }
                          : undefined
                      }
                    />
                    <span className="text-foreground">{summary.teamName}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
