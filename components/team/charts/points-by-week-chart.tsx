"use client";

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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ChartHeadlineMetric } from "@/components/team/charts/chart-headline-metric";
import { formatPoints } from "@/lib/leagues/standings";
import type {
  ConsistencyAverageMetric,
  WeeklyPointsBandPoint,
} from "@/lib/leagues/team-stats-charts";

const chartConfig = {
  team: {
    label: "You",
    color: "var(--chart-1)",
  },
  high: {
    label: "High",
    color: "var(--chart-3)",
  },
  low: {
    label: "Low",
    color: "var(--chart-4)",
  },
  median: {
    label: "Median",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const WEEK_LEGEND_ORDER = ["team", "high", "low", "median"] as const;

type PointsByWeekChartProps = {
  data: WeeklyPointsBandPoint[];
  avgWeeklyScore: ConsistencyAverageMetric;
};

export function PointsByWeekChart({
  data,
  avgWeeklyScore,
}: PointsByWeekChartProps) {
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle>Points by Week</CardTitle>
        <CardDescription>
          Your score vs the league high, median, and low each week.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {avgWeeklyScore.average != null ? (
          <ChartHeadlineMetric
            value={formatPoints(avgWeeklyScore.average)}
            label="Average weekly score"
          />
        ) : null}
        {data.length === 0 ? (
          <Empty className="min-h-72 flex-1" size="sm">
            <EmptyHeader>
              <EmptyTitle>No weekly scores yet</EmptyTitle>
              <EmptyDescription>
                Appears after the first finalized week.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-72 w-full"
          >
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
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={40}
                tickFormatter={(value) => formatPoints(Number(value))}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend
                content={({ payload, verticalAlign }) => {
                  const sorted = [...(payload ?? [])].sort((a, b) => {
                    const ai = WEEK_LEGEND_ORDER.indexOf(
                      String(a.dataKey) as (typeof WEEK_LEGEND_ORDER)[number],
                    );
                    const bi = WEEK_LEGEND_ORDER.indexOf(
                      String(b.dataKey) as (typeof WEEK_LEGEND_ORDER)[number],
                    );
                    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                  });
                  return (
                    <ChartLegendContent
                      payload={sorted}
                      verticalAlign={verticalAlign}
                    />
                  );
                }}
              />
              <Line
                dataKey="high"
                type="monotone"
                stroke="var(--color-high)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                dataKey="low"
                type="monotone"
                stroke="var(--color-low)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                dataKey="median"
                type="monotone"
                stroke="var(--color-median)"
                strokeWidth={1.5}
                strokeDasharray="2 4"
                dot={false}
              />
              <Line
                dataKey="team"
                type="monotone"
                stroke="var(--color-team)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
