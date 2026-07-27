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
import { ChartHeadlineMetric } from "@/components/team/charts/chart-headline-metric";
import { formatPoints } from "@/lib/leagues/standings";
import {
  buildOptimalRecordSummary,
  formatRecordSummary,
  type WeeklyBenchWastePoint,
} from "@/lib/leagues/team-stats-charts";

const chartConfig = {
  leftOnBench: {
    label: "Left on bench",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

type BenchWasteChartProps = {
  data: WeeklyBenchWastePoint[];
};

export function BenchWasteChart({ data }: BenchWasteChartProps) {
  const records = buildOptimalRecordSummary(data);

  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle>Points Left on Bench</CardTitle>
        <CardDescription>
          Optimum lineup minus what you started. Fix start/sit when this climbs.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {records ? (
          <ChartHeadlineMetric
            value={formatRecordSummary(records.optimal)}
            label={`Should-be record`}
          />
        ) : null}
        {data.length === 0 ? (
          <div className="flex min-h-72 flex-1 items-center justify-center rounded-lg border border-dashed px-4">
            <p className="text-sm text-pretty text-muted-foreground">
              Appears after weekly starter scores are recorded (open League
              Stats once scores are live).
            </p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-72 w-full"
          >
            <BarChart
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
                width={36}
                tickFormatter={(value) => formatPoints(Number(value))}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as
                        | WeeklyBenchWastePoint
                        | undefined;
                      if (!row) return "";
                      const result = row.result ? ` · ${row.result}` : "";
                      return `${row.label}${result}`;
                    }}
                    formatter={(value, _name, item) => {
                      const row = item.payload as WeeklyBenchWastePoint;
                      const left =
                        typeof value === "number"
                          ? formatPoints(value)
                          : String(value ?? "");
                      return (
                        <div className="flex min-w-0 flex-1 flex-col gap-1 leading-none">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                              Left on bench
                            </span>
                            <span className="shrink-0 font-mono font-medium tabular-nums text-foreground">
                              {left}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                              Started / optimum
                            </span>
                            <span className="shrink-0 font-mono tabular-nums text-foreground">
                              {formatPoints(row.pointsFor)} /{" "}
                              {formatPoints(row.optimumPointsFor)}
                            </span>
                          </div>
                          {row.wouldHaveFlipped ? (
                            <p className="text-success">
                              Optimum would have won this week.
                            </p>
                          ) : null}
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar dataKey="leftOnBench" radius={4} minPointSize={3}>
                {data.map((row) => (
                  <Cell
                    key={row.week}
                    fill={
                      row.wouldHaveFlipped
                        ? "var(--destructive)"
                        : row.leftOnBench === 0
                          ? "#475569"
                          : "var(--chart-5)"
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
