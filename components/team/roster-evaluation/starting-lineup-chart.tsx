"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
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
  /** Inverted height so rank 1 reaches the top of a 1..N axis. */
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

  const barHeight = Math.max(height, 8);
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
        <Avatar size="sm" className="size-6 ring-2 ring-card">
          {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
          <AvatarFallback className="text-[9px]">
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
        barValue: n - slot.rank + 1,
      })),
    [slots, n],
  );

  return (
    <Card size="sm" className="h-full gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle className="text-base text-balance">Starting Lineup</CardTitle>
      </CardHeader>
      <CardContent className="py-4">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-72 w-full"
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              top: RANK_LABEL_GAP + 4,
              right: 8,
              left: 8,
              bottom: AVATAR_SIZE / 2,
            }}
          >
            <XAxis
              dataKey="slotLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval={0}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              domain={[1, n]}
              ticks={ticks}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={28}
              tickMargin={4}
              tick={{ fontSize: 10 }}
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
                          className="size-2.5 shrink-0 rounded-[2px]"
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
