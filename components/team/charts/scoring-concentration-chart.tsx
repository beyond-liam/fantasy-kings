"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

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
import type { ScoringConcentration } from "@/lib/leagues/team-stats-charts";

const chartConfig = {
  share: {
    label: "Share of starter PF",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

type ScoringConcentrationChartProps = {
  data: ScoringConcentration;
};

function shortLabel(label: string) {
  const parts = label.trim().split(/\s+/);
  if (parts.length <= 1) return label;
  const last = parts[parts.length - 1]!;
  return `${parts[0]![0]}. ${last}`;
}

export function ScoringConcentrationChart({
  data,
}: ScoringConcentrationChartProps) {
  const chartRows = data.slices.map((slice) => ({
    ...slice,
    chartLabel: slice.isRest ? "Rest" : shortLabel(slice.label),
  }));

  return (
    <Card size="sm" className="h-full gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle>Scoring Concentration</CardTitle>
        <CardDescription>
          How much of your starter points come from your top scorers.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 py-4">
        {data.topShare != null ? (
          <ChartHeadlineMetric
            value={`${data.topShare.toFixed(1)}%`}
            label={`Top ${data.topN} share of starter PF`}
          />
        ) : null}
        {chartRows.length === 0 ? (
          <Empty className="min-h-72 flex-1" size="sm">
            <EmptyHeader>
              <EmptyTitle>No concentration data yet</EmptyTitle>
              <EmptyDescription>
                Appears after weeks finalize with locked lineups (snapshots from
                first finalize onward).
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-72 w-full"
          >
            <BarChart
              accessibilityLayer
              data={chartRows}
              layout="vertical"
              margin={{ left: 8, right: 12, top: 8, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="chartLabel"
                type="category"
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `${value}%`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as
                        | (typeof chartRows)[number]
                        | undefined;
                      return row?.label ?? "";
                    }}
                    formatter={(value, _name, item) => {
                      const row = item.payload as (typeof chartRows)[number];
                      const pct =
                        typeof value === "number"
                          ? `${value.toFixed(1)}%`
                          : String(value ?? "");
                      return (
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-4 leading-none">
                          <span className="truncate text-muted-foreground">
                            Starter PF
                          </span>
                          <span className="shrink-0 font-mono font-medium tabular-nums text-foreground">
                            {pct} · {formatPoints(row.points)} pts
                          </span>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar dataKey="share" radius={4}>
                {chartRows.map((row) => (
                  <Cell
                    key={row.key}
                    fill={
                      row.isRest ? "var(--chart-2)" : "var(--chart-1)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
