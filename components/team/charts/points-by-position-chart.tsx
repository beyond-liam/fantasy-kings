"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import {
  pickStrongestPosition,
  type PositionMixPoint,
} from "@/lib/leagues/team-stats-charts";

const chartConfig = {
  teamShare: {
    label: "You",
    color: "var(--chart-1)",
  },
  leagueShare: {
    label: "League avg",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

type PointsByPositionChartProps = {
  data: PositionMixPoint[];
};

export function PointsByPositionChart({ data }: PointsByPositionChartProps) {
  const strongest = pickStrongestPosition(data);

  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle>Points by Position</CardTitle>
        <CardDescription>
          Share of your starter points vs the league average.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {strongest ? (
          <ChartHeadlineMetric
            value={strongest.label}
            label={`Outscores league avg by ${strongest.shareDelta.toFixed(1)}%`}
          />
        ) : data.length > 0 ? (
          <ChartHeadlineMetric
            value="Even"
            label="No position clearly beats league share"
          />
        ) : null}
        {data.length === 0 ? (
          <Empty className="min-h-72 flex-1" size="sm">
            <EmptyHeader>
              <EmptyTitle>No position scoring yet</EmptyTitle>
              <EmptyDescription>
                Appears after weekly starter scores are recorded (open League
                Stats once scores are live).
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
              data={data}
              layout="vertical"
              margin={{ left: 8, right: 12, top: 8, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                width={40}
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
                        | PositionMixPoint
                        | undefined;
                      return row?.fullLabel ?? "";
                    }}
                    formatter={(value, name, item) => {
                      const row = item.payload as PositionMixPoint;
                      const isTeam = name === "teamShare";
                      const pct =
                        typeof value === "number"
                          ? `${value.toFixed(1)}%`
                          : String(value ?? "");
                      return (
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-4 leading-none">
                          <span className="truncate text-muted-foreground">
                            {isTeam ? "You" : "League avg"}
                          </span>
                          <span className="shrink-0 font-mono font-medium tabular-nums text-foreground">
                            {isTeam
                              ? `${pct} · ${formatPoints(row.points)} pts`
                              : pct}
                          </span>
                        </div>
                      );
                    }}
                  />
                }
              />
              <ChartLegend
                content={({ payload, verticalAlign }) => {
                  const order = ["teamShare", "leagueShare"] as const;
                  const sorted = [...(payload ?? [])].sort((a, b) => {
                    const ai = order.indexOf(
                      String(a.dataKey) as (typeof order)[number],
                    );
                    const bi = order.indexOf(
                      String(b.dataKey) as (typeof order)[number],
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
              <Bar
                dataKey="teamShare"
                fill="var(--color-teamShare)"
                radius={4}
              />
              <Bar
                dataKey="leagueShare"
                fill="var(--color-leagueShare)"
                radius={4}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
