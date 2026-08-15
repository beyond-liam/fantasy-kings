"use client";

import { useState } from "react";
import { Cell, Label, Pie, PieChart, Sector } from "recharts";
import type { PieSectorShapeProps } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import type {
  OverviewMatchupBucketId,
  OverviewMatchupDifficulty,
} from "@/lib/players/overview-metrics";
import { formatOpponentTick } from "@/lib/players/overview-metrics";
import { cn } from "@/lib/utils";

const chartConfig = {
  week: { label: "Week" },
} satisfies ChartConfig;

const RADIAN = Math.PI / 180;
const SLICE_GAP_STROKE = "var(--background)";
const SLICE_GAP_WIDTH = 2;
const BYE_INSET = 1.75;
const BYE_DASH = "2.5 2";
const BYE_STROKE =
  "color-mix(in oklab, var(--muted-foreground) 40%, transparent)";

function difficultyFill(
  difficulty: "easy" | "mid" | "hard" | null,
  isBye: boolean,
): string {
  if (isBye) return "color-mix(in oklab, var(--muted) 70%, transparent)";
  if (difficulty === "easy") return "var(--success)";
  if (difficulty === "mid") return "var(--muted-foreground)";
  if (difficulty === "hard") return "var(--destructive)";
  return "var(--muted)";
}

type WheelSlice = {
  week: number;
  value: number;
  fill: string;
  isBye: boolean;
  isPlayoff: boolean;
  difficulty: OverviewMatchupBucketId | null;
  matchupRank: number | null;
  ptsAllowed: number | null;
  opponent: string | null;
  abbrev: string | null;
  venue: "home" | "away" | null;
};

function ScheduleSliceShape(props: PieSectorShapeProps) {
  const payload = props.payload as WheelSlice | undefined;
  const {
    cx = 0,
    cy = 0,
    innerRadius = 0,
    outerRadius = 0,
    startAngle = 0,
    endAngle = 0,
    fill,
  } = props;

  if (!payload?.isBye) {
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke={SLICE_GAP_STROKE}
        strokeWidth={SLICE_GAP_WIDTH}
      />
    );
  }

  // Match neighboring slice footprint; keep the dashed outline inset.
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke={SLICE_GAP_STROKE}
        strokeWidth={SLICE_GAP_WIDTH}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius + BYE_INSET}
        outerRadius={outerRadius - BYE_INSET}
        startAngle={startAngle}
        endAngle={endAngle}
        fill="none"
        stroke={BYE_STROKE}
        strokeWidth={1}
        strokeDasharray={BYE_DASH}
        pointerEvents="none"
      />
    </g>
  );
}

function formatOpponent(slice: {
  opponent: string | null;
  abbrev: string | null;
  venue: "home" | "away" | null;
}): string {
  if (!slice.opponent || slice.opponent === "BYE") return "Bye";
  return (
    formatOpponentTick(slice.venue, slice.abbrev) ?? slice.opponent
  );
}

function WeekSpokeLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  payload?: WheelSlice;
}) {
  const { cx = 0, cy = 0, midAngle = 0, outerRadius = 0, payload } = props;
  // Skip even weeks and playoff weeks so labels clear the playoff arc.
  if (!payload || payload.week % 2 === 0 || payload.isPlayoff) return null;

  const radius = outerRadius + 22;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      className="fill-muted-foreground text-[10px]"
    >
      {`Wk ${payload.week}`}
    </text>
  );
}

type ScheduleWheelProps = {
  data: OverviewMatchupDifficulty;
  positionLabel?: string;
  className?: string;
};

export function ScheduleWheel({
  data,
  positionLabel = "this position",
  className,
}: ScheduleWheelProps) {
  const [activeWeek, setActiveWeek] = useState<number | null>(null);

  const slices: WheelSlice[] = data.weeks.map((w) => {
    const base = difficultyFill(w.difficulty, w.isBye);
    const isActive = activeWeek === w.week;
    return {
      week: w.week,
      value: 1,
      fill: isActive
        ? base
        : activeWeek != null
          ? `color-mix(in oklab, ${base} 55%, transparent)`
          : base,
      isBye: w.isBye,
      isPlayoff: w.isPlayoff,
      difficulty: w.difficulty,
      matchupRank: w.matchupRank,
      ptsAllowed: w.ptsAllowed,
      opponent: w.opponent,
      abbrev: w.abbrev,
      venue: w.venue,
    };
  });

  const playoffSlices: WheelSlice[] = data.weeks.map((w) => ({
    week: w.week,
    value: 1,
    fill: w.isPlayoff ? "var(--warning)" : "transparent",
    isBye: w.isBye,
    isPlayoff: w.isPlayoff,
    difficulty: w.difficulty,
    matchupRank: w.matchupRank,
    ptsAllowed: w.ptsAllowed,
    opponent: w.opponent,
    abbrev: w.abbrev,
    venue: w.venue,
  }));

  const active = slices.find((s) => s.week === activeWeek) ?? null;

  const avg =
    data.averageMatchupRank != null
      ? Math.round(data.averageMatchupRank)
      : null;

  const playoffWeekLabel =
    data.playoffWeeks.length > 0
      ? data.playoffWeeks.length === 1
        ? `Wk ${data.playoffWeeks[0]}`
        : `Wk ${data.playoffWeeks[0]}–${data.playoffWeeks[data.playoffWeeks.length - 1]}`
      : null;

  return (
    <div className={cn("relative flex min-w-0 flex-col items-center", className)}>
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square w-full max-w-[360px]"
        initialDimension={{ width: 360, height: 360 }}
      >
        <PieChart
          margin={{ top: 28, right: 28, bottom: 28, left: 28 }}
          onMouseLeave={() => setActiveWeek(null)}
        >
          <ChartTooltip
            cursor={false}
            content={({ active: tipActive, payload }) => {
              if (!tipActive || !payload?.length) return null;
              const row = payload[0]?.payload as WheelSlice | undefined;
              if (!row) return null;
              if (row.isBye) {
                return (
                  <div className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background">
                    Week {row.week} is a bye.
                  </div>
                );
              }
              const rank = row.matchupRank;
              const tone =
                row.difficulty === "hard"
                  ? "looks like one to avoid"
                  : row.difficulty === "easy"
                    ? "looks friendly"
                    : "looks about average";
              return (
                <div className="flex max-w-[16rem] flex-col rounded-md bg-foreground text-xs text-background">
                  <p className="px-3 py-1.5 text-pretty font-semibold">
                    Week {row.week} {formatOpponent(row)} {tone} for{" "}
                    {positionLabel}.
                  </p>
                  <dl className="flex flex-col gap-1 border-y border-background/15 px-3 py-1.5">
                    <div className="flex justify-between gap-4">
                      <dt className="text-background/70">Matchup rank</dt>
                      <dd className="font-medium tabular-nums">
                        {rank != null
                          ? `#${rank} of ${data.leagueTeamCount}`
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-background/70">
                        Fantasy pts allowed
                      </dt>
                      <dd className="font-medium tabular-nums">
                        {row.ptsAllowed != null
                          ? `${row.ptsAllowed.toFixed(1)} / game`
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  <p className="px-3 py-1.5 text-[10px] text-background/70">
                    #1 gives up the most fantasy points to {positionLabel}.
                  </p>
                </div>
              );
            }}
          />

          {/* Playoff arc — thin ring just outside the schedule donut */}
          <Pie
            data={playoffSlices}
            dataKey="value"
            nameKey="week"
            innerRadius="71%"
            outerRadius="74%"
            startAngle={90}
            endAngle={-270}
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
            pointerEvents="none"
          />

          <Pie
            data={slices}
            dataKey="value"
            nameKey="week"
            innerRadius="46%"
            outerRadius="68%"
            startAngle={90}
            endAngle={-270}
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
            shape={ScheduleSliceShape}
            onMouseEnter={(_, index) => {
              const slice = slices[index];
              if (slice) setActiveWeek(slice.week);
            }}
            label={WeekSpokeLabel}
            labelLine={false}
          >
            {slices.map((slice) => (
              <Cell key={`wk-${slice.week}`} fill={slice.fill} />
            ))}
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                  return null;
                }
                const { cx, cy } = viewBox;
                if (active && !active.isBye) {
                  return (
                    <text x={cx} y={cy} textAnchor="middle">
                      <tspan
                        x={cx}
                        y={(cy ?? 0) - 26}
                        className="fill-success text-[10px] font-medium tracking-wide"
                      >
                        {`Wk ${active.week}`}
                      </tspan>
                      <tspan
                        x={cx}
                        y={(cy ?? 0) - 4}
                        className="fill-foreground text-2xl font-semibold tabular-nums"
                      >
                        {active.matchupRank != null
                          ? `#${active.matchupRank}`
                          : "—"}
                      </tspan>
                      <tspan
                        x={cx}
                        y={(cy ?? 0) + 14}
                        className="fill-muted-foreground text-[10px] tabular-nums"
                      >
                        {active.matchupRank != null
                          ? `of ${data.leagueTeamCount}`
                          : ""}
                      </tspan>
                      <tspan
                        x={cx}
                        y={(cy ?? 0) + 32}
                        className="fill-muted-foreground text-xs"
                      >
                        {formatOpponent(active)}
                      </tspan>
                    </text>
                  );
                }

                return (
                  <text x={cx} y={cy} textAnchor="middle">
                    <tspan
                      x={cx}
                      y={(cy ?? 0) - 14}
                      className="fill-foreground text-4xl font-semibold tabular-nums"
                    >
                      {data.weeks.length}
                    </tspan>
                    <tspan
                      x={cx}
                      y={(cy ?? 0) + 8}
                      className="fill-muted-foreground text-[10px] tracking-wide"
                    >
                      Weeks
                    </tspan>
                    <tspan
                      x={cx}
                      y={(cy ?? 0) + 26}
                      className="fill-muted-foreground text-[10px] tracking-wide"
                    >
                      {avg != null
                        ? `Avg #${avg} of ${data.leagueTeamCount}`
                        : "Schedule"}
                    </tspan>
                  </text>
                );
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      {playoffWeekLabel ? (
        <div className="-mt-7 flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className="size-2.5 shrink-0 rounded-full bg-warning"
            aria-hidden
          />
          <span>
            Fantasy playoffs{" "}
            <span className="tabular-nums text-foreground">
              {playoffWeekLabel}
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
