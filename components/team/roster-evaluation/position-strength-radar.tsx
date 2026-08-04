"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { PositionStrengthPoint } from "@/lib/leagues/roster-evaluation/types";

const chartConfig = {
  starters: {
    label: "Starters",
    color: "var(--chart-1)",
  },
  bench: {
    label: "Bench",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

type PositionStrengthRadarProps = {
  data: PositionStrengthPoint[];
};

export function PositionStrengthRadar({ data }: PositionStrengthRadarProps) {
  return (
    <Card size="sm" className="h-full gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle className="text-base text-balance">Position Strength</CardTitle>
      </CardHeader>
      <CardContent className="py-4">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square w-full max-h-72"
        >
          <RadarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelClassName="font-semibold"
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as
                      | PositionStrengthPoint
                      | undefined;
                    return row?.position ?? "";
                  }}
                  formatter={(_value, name, item) => {
                    const row = item.payload as PositionStrengthPoint;
                    const isBench = name === "bench";
                    const rank = isBench ? row.benchRank : row.startersRank;
                    const color = isBench
                      ? "var(--color-bench)"
                      : "var(--color-starters)";
                    return (
                      <>
                        <div
                          className="size-2.5 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex min-w-0 flex-1 items-center leading-none">
                          <span className="truncate text-background/70">
                            {isBench ? "Bench" : "Starter"} #{rank}
                          </span>
                        </div>
                      </>
                    );
                  }}
                />
              }
            />
            <PolarAngleAxis dataKey="position" />
            <PolarGrid radialLines={false} />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Radar
              dataKey="starters"
              fill="var(--color-starters)"
              fillOpacity={0.35}
              stroke="var(--color-starters)"
              strokeWidth={2}
              dot={{ r: 3, fillOpacity: 1 }}
            />
            <Radar
              dataKey="bench"
              fill="var(--color-bench)"
              fillOpacity={0.25}
              stroke="var(--color-bench)"
              strokeWidth={2}
              dot={{ r: 3, fillOpacity: 1 }}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
