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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  chartAxisTick,
  type ChartConfig,
} from "@/components/ui/chart";
import { buildPositionStrengthTooltipParts } from "@/lib/leagues/roster-evaluation/position-strength-tooltip";
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

function PositionStrengthTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: PositionStrengthPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const parts = buildPositionStrengthTooltipParts(row);

  return (
    <div className="grid min-w-48 max-w-64 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs text-background shadow-xl dark:bg-foreground">
      <p className="text-pretty leading-snug text-background/90">
        {parts.map((part, index) =>
          part.kind === "rank" ? (
            <span key={index} className="font-semibold text-background">
              {part.value}
            </span>
          ) : (
            <span key={index}>{part.value}</span>
          ),
        )}
      </p>
    </div>
  );
}

export function PositionStrengthRadar({ data }: PositionStrengthRadarProps) {
  return (
    <Card size="sm" className="h-full gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle className="text-base text-balance">Position Strength</CardTitle>
        <CardDescription className="text-pretty">
          Starters vs bench
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 py-4">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square w-full max-h-72"
        >
          <RadarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
            <ChartTooltip cursor={false} content={<PositionStrengthTooltip />} />
            <PolarAngleAxis dataKey="position" tick={chartAxisTick} />
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
          </RadarChart>
        </ChartContainer>
        <div className="flex items-center justify-center gap-4 text-xs">
          {(Object.keys(chartConfig) as (keyof typeof chartConfig)[]).map(
            (key) => (
              <div key={key} className="flex items-center gap-1.5">
                <div
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: chartConfig[key].color }}
                />
                <span className="text-muted-foreground">
                  {chartConfig[key].label}
                </span>
              </div>
            ),
          )}
        </div>
      </CardContent>
    </Card>
  );
}
