"use client";

import { Area, ComposedChart, ReferenceLine, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import type { WinProbabilityPoint } from "@/lib/espn/game-summary";
import { getNflTeamColors } from "@/lib/nfl/team-colors";

const MID = 50;

export type WinProbabilityChartRow = {
  index: number;
  awayPct: number;
  /** Away win % when away is favored (≥50); null otherwise. */
  awayLead: number | null;
  /** Away win % when home is favored (≤50); null otherwise. */
  homeLead: number | null;
};

/** Split the series at 50% and insert crossing points so fills meet cleanly. */
export function buildWinProbabilityChartData(
  points: WinProbabilityPoint[],
): WinProbabilityChartRow[] {
  const rows: WinProbabilityChartRow[] = [];

  for (let i = 0; i < points.length; i++) {
    const awayPct = points[i]!.awayPct;
    const prev = points[i - 1];

    if (prev != null && (prev.awayPct - MID) * (awayPct - MID) < 0) {
      const t = (MID - prev.awayPct) / (awayPct - prev.awayPct);
      rows.push({
        index: i - 1 + t,
        awayPct: MID,
        awayLead: MID,
        homeLead: MID,
      });
    }

    rows.push({
      index: i,
      awayPct,
      awayLead: awayPct >= MID ? awayPct : null,
      homeLead: awayPct <= MID ? awayPct : null,
    });
  }

  return rows;
}

type WinProbabilityChartProps = {
  points: WinProbabilityPoint[];
  awayAbbrev: string;
  homeAbbrev: string;
};

export function WinProbabilityChart({
  points,
  awayAbbrev,
  homeAbbrev,
}: WinProbabilityChartProps) {
  if (points.length === 0) {
    return (
      <p className="text-sm tabular-nums text-muted-foreground">—</p>
    );
  }

  const awayColor =
    getNflTeamColors(awayAbbrev)?.primary ?? "var(--chart-1)";
  const homeColor =
    getNflTeamColors(homeAbbrev)?.primary ?? "var(--chart-2)";
  const chartData = buildWinProbabilityChartData(points);
  const latest = points[points.length - 1]?.awayPct ?? MID;

  const chartConfig = {
    awayLead: {
      label: awayAbbrev,
      color: awayColor,
    },
    homeLead: {
      label: homeAbbrev,
      color: homeColor,
    },
  } satisfies ChartConfig;

  return (
    <div className="flex flex-col gap-3">
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-32 w-full"
        initialDimension={{ width: 280, height: 128 }}
      >
        <ComposedChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 4, right: 4, top: 8, bottom: 4 }}
        >
          <XAxis dataKey="index" hide type="number" domain={["dataMin", "dataMax"]} />
          <YAxis domain={[0, 100]} hide />
          <ReferenceLine y={MID} stroke="var(--border)" strokeWidth={1} />
          <ChartTooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) {
                return null;
              }

              const row = payload[0]?.payload as WinProbabilityChartRow | undefined;
              const awayPct = row?.awayPct;
              if (awayPct == null || !Number.isFinite(awayPct)) {
                return null;
              }

              const homePct = 100 - awayPct;
              const favorite =
                awayPct >= homePct
                  ? { team: awayAbbrev, pct: awayPct, color: awayColor }
                  : { team: homeAbbrev, pct: homePct, color: homeColor };

              return (
                <div className="grid min-w-36 gap-1 rounded-md bg-foreground px-3 py-1.5 text-xs text-background">
                  <p className="font-semibold">Win probability</p>
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: favorite.color }}
                      aria-hidden
                    />
                    <p className="tabular-nums">
                      {favorite.team} {Math.round(favorite.pct)}%
                    </p>
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="awayLead"
            stroke={awayColor}
            fill={awayColor}
            fillOpacity={0.28}
            strokeWidth={2}
            baseValue={MID}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 3, fill: awayColor, strokeWidth: 0 }}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="homeLead"
            stroke={homeColor}
            fill={homeColor}
            fillOpacity={0.28}
            strokeWidth={2}
            baseValue={MID}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 3, fill: homeColor, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: awayColor }}
            aria-hidden
          />
          {awayAbbrev}{" "}
          <span className="font-medium tabular-nums text-foreground">
            {Math.round(latest)}%
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: homeColor }}
            aria-hidden
          />
          {homeAbbrev}{" "}
          <span className="font-medium tabular-nums text-foreground">
            {Math.round(100 - latest)}%
          </span>
        </span>
      </div>
    </div>
  );
}
