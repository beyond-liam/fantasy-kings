"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { GameCentreChartPoint } from "@/lib/queries/game-centre";

const chartConfig = {
  away: {
    label: "Away",
    color: "var(--chart-1)",
  },
  home: {
    label: "Home",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

type ScoreLineChartProps = {
  data: GameCentreChartPoint[];
  awayName: string;
  homeName: string;
  empty: boolean;
};

export function ScoreLineChart({
  data,
  awayName,
  homeName,
  empty,
}: ScoreLineChartProps) {
  const config = {
    away: { ...chartConfig.away, label: awayName },
    home: { ...chartConfig.home, label: homeName },
  } satisfies ChartConfig;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Score Chart</h2>
      {empty || data.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border bg-card px-4">
          <p className="text-sm text-pretty text-muted-foreground">
            Updates after kickoff.
          </p>
        </div>
      ) : (
        <ChartContainer config={config} className="h-56 w-full">
          <LineChart
            accessibilityLayer
            data={data}
            margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
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
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={36}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="away"
              type="stepAfter"
              stroke="var(--color-away)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="home"
              type="stepAfter"
              stroke="var(--color-home)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      )}
    </section>
  );
}
