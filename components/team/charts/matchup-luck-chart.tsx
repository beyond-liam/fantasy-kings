"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";

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
  chartAxisTick,
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
  summarizeMatchupLuck,
  type WeeklyLuckPoint,
} from "@/lib/leagues/team-stats-charts";

const chartConfig = {
  luck: {
    label: "Luck",
    color: "var(--success)",
  },
} satisfies ChartConfig;

function formatRank(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${rank}th`;
  }
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

type MatchupLuckChartProps = {
  data: WeeklyLuckPoint[];
};

export function MatchupLuckChart({ data }: MatchupLuckChartProps) {
  // Zero luck draws a tiny stub so the week is still visible on the axis.
  const chartData = data.map((row) => ({
    ...row,
    luckBar: row.luck === 0 ? 2 : row.luck,
  }));
  const luckSummary = summarizeMatchupLuck(data);
  const luckSigned =
    luckSummary == null
      ? null
      : luckSummary.averageLuck > 0
        ? `+${luckSummary.averageLuck}`
        : String(luckSummary.averageLuck);

  return (
    <Card size="sm" className="h-full gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle>Matchup Luck</CardTitle>
        <CardDescription>
          Actual result vs how often your score would have beaten the field.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 py-4">
        {luckSummary ? (
          <ChartHeadlineMetric
            value={luckSummary.verdict}
            label={`Season average luck ${luckSigned}`}
          />
        ) : null}
        {data.length === 0 ? (
          <Empty className="min-h-72 flex-1" size="sm">
            <EmptyHeader>
              <EmptyTitle>No luck data yet</EmptyTitle>
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
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={chartAxisTick}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={36}
                tick={chartAxisTick}
                domain={["dataMin - 5", "dataMax + 5"]}
              />
              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as
                        | WeeklyLuckPoint
                        | undefined;
                      if (!row) return "";
                      return `${row.label} · ${row.result} · ${formatRank(row.rank)} of ${row.teamCount}`;
                    }}
                    formatter={(_value, _name, item) => {
                      const row = item.payload as WeeklyLuckPoint;
                      const luck =
                        row.luck > 0 ? `+${row.luck}` : String(row.luck);
                      const expected = Math.round(row.expectedWinPct * 100);
                      return (
                        <div className="flex min-w-0 flex-1 flex-col gap-1 leading-none">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-background/70">Luck</span>
                            <span className="shrink-0 font-mono font-medium tabular-nums text-background">
                              {luck}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-background/70">Score</span>
                            <span className="shrink-0 font-mono tabular-nums text-background">
                              {formatPoints(row.points)}–
                              {formatPoints(row.opponentPoints)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-background/70">
                              vs field
                            </span>
                            <span className="shrink-0 font-mono tabular-nums text-background">
                              {expected}% expected
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar dataKey="luckBar" radius={4} minPointSize={3}>
                {chartData.map((row) => (
                  <Cell
                    key={row.week}
                    fill={
                      row.luck > 0
                        ? "var(--success)"
                        : row.luck < 0
                          ? "var(--destructive)"
                          : "var(--muted-foreground)"
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
