"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import type { StartingLineupSlot } from "@/lib/leagues/roster-evaluation/types";
import { getSleeperPlayerAvatarThumbUrl } from "@/lib/sleeper/avatars";

const AVATAR_SIZE = 24;
const RANK_LABEL_GAP = 14;

const chartConfig = {
  barValue: {
    label: "Rank",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const TONE_FILL: Record<StartingLineupSlot["tone"], string> = {
  success: "var(--success)",
  neutral: "var(--muted-foreground)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
};

type ChartSlot = StartingLineupSlot & {
  /**
   * Inverted height on a 0..N domain. Rank N is half a step (0.5) so the
   * lowest bar is shorter while consecutive ranks stay 1 unit apart.
   */
  barValue: number;
};

type StartingLineupChartProps = {
  slots: StartingLineupSlot[];
  teamCount: number;
};

type BarShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: ChartSlot;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function StartingLineupBarShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill,
  payload,
}: BarShapeProps) {
  if (!payload) return null;

  // Keep proportional heights — no min floor that breaks equal steps.
  const barHeight = Math.max(height, 1);
  const barY = y + (height - barHeight);
  const avatarSrc = payload.sleeperId
    ? getSleeperPlayerAvatarThumbUrl(payload.sleeperId)
    : null;
  const avatarX = x + (width - AVATAR_SIZE) / 2;
  const avatarY = barY + barHeight - AVATAR_SIZE / 2;

  return (
    <g>
      <text
        x={x + width / 2}
        y={barY - 6}
        textAnchor="middle"
        className="fill-foreground text-[11px] font-semibold tabular-nums"
      >
        #{payload.rank}
      </text>
      <rect
        x={x}
        y={barY}
        width={width}
        height={barHeight}
        rx={4}
        ry={4}
        fill={fill}
        fillOpacity={0.8}
      />
      <foreignObject
        x={avatarX}
        y={avatarY}
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
      >
        <Avatar
          size="sm"
          className="size-6 bg-muted ring-2 ring-card"
        >
          {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
          <AvatarFallback className="bg-muted text-[9px]">
            {initials(payload.playerName)}
          </AvatarFallback>
        </Avatar>
      </foreignObject>
    </g>
  );
}

export function StartingLineupChart({
  slots,
  teamCount,
}: StartingLineupChartProps) {
  const n = Math.max(1, teamCount);
  const ticks = useMemo(
    () => Array.from({ length: n }, (_, index) => index + 1),
    [n],
  );
  const chartData = useMemo(
    () =>
      slots.map((slot) => ({
        ...slot,
        // Rank 1 → n-0.5 (near top); rank n → 0.5 (half step).
        barValue: n - slot.rank + 0.5,
      })),
    [slots, n],
  );

  return (
    <Card size="sm" className="h-full gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle className="text-base text-balance">Starting Lineup</CardTitle>
        <CardDescription className="text-pretty">
          Current starters
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col py-4">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto! min-h-72 w-full flex-1"
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              top: RANK_LABEL_GAP + 4,
              right: 8,
              left: 8,
              bottom: AVATAR_SIZE / 2 + 8,
            }}
          >
            <XAxis
              dataKey="slotLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval={0}
              tick={chartAxisTick}
            />
            <YAxis
              type="number"
              domain={[0, n]}
              ticks={ticks}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={28}
              tickMargin={4}
              tick={chartAxisTick}
              tickFormatter={(value) => String(n - Number(value) + 1)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelClassName="font-semibold"
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as ChartSlot | undefined;
                    return row?.playerName ?? "";
                  }}
                  formatter={(_value, _name, item) => {
                    const row = item.payload as ChartSlot;
                    const color = TONE_FILL[row.tone];
                    return (
                      <>
                        <div
                          className="size-2.5 shrink-0 rounded-xs"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex min-w-0 flex-1 items-center leading-none">
                          <span className="truncate text-background/70">
                            {row.slotLabel} #{row.rank}
                          </span>
                        </div>
                      </>
                    );
                  }}
                />
              }
            />
            <Bar
              dataKey="barValue"
              shape={StartingLineupBarShape}
              maxBarSize={36}
              isAnimationActive={false}
            >
              {chartData.map((slot) => (
                <Cell key={slot.slotLabel} fill={TONE_FILL[slot.tone]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
