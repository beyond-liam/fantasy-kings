"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  BriefcaseMedicalIcon,
  ZzzIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  chartAxisTick,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScheduleWheel } from "@/components/players/schedule-wheel";
import { RosterCompareTable } from "@/components/players/roster-compare-table";
import {
  formatProjectionStat,
  formatProjectionPerGame,
  projectionAccentSurfaceClass,
  projectionAccentTextClass,
} from "@/lib/players/projection-highlights";
import {
  DEF_LEAGUE_PA_PER_WEEK,
  formatOpponentTick,
  type OverviewMatchupBucketOpponent,
  type PlayerOverviewMetrics,
} from "@/lib/players/overview-metrics";
import { sosRateUnitLabel } from "@/lib/players/sos-thresholds";
import { getSleeperTeamLogoUrl } from "@/lib/sleeper/avatars";
import { cn } from "@/lib/utils";

const SEGMENT_COLORS = [
  "var(--color-emerald-400)",
  "var(--color-blue-400)",
  "var(--color-purple-400)",
  "var(--color-amber-400)",
  "var(--color-rose-400)",
] as const;

function segmentColor(segmentId: string, index: number): string {
  if (segmentId === "other") return "var(--color-slate-600)";
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length]!;
}

const SCORING_SEGMENT_HELP: Record<string, string> = {
  pass_yd:
    "How much of this player's fantasy output comes from passing yards under your league scoring.",
  pass_td:
    "How much of this player's fantasy output comes from passing touchdowns.",
  rush_yd:
    "How much of this player's fantasy output comes from rushing yards under your league scoring.",
  rush_td:
    "How much of this player's fantasy output comes from rushing touchdowns.",
  rec: "How much of this player's fantasy output comes from receptions (PPR and catch bonuses).",
  rec_yd:
    "How much of this player's fantasy output comes from receiving yards.",
  rec_td:
    "How much of this player's fantasy output comes from receiving touchdowns.",
  fg_short:
    "Fantasy points from field goals under 40 yards under your league scoring.",
  fg_40: "Fantasy points from 40–49 yard field goals (including distance bonuses).",
  fg_50: "Fantasy points from 50+ yard field goals (including distance bonuses).",
  fg: "Fantasy points from field goals under your league scoring.",
  xp: "Fantasy points from extra points under your league scoring.",
  sack: "Fantasy points from sacks under your league scoring.",
  tkl_solo:
    "Fantasy points from solo tackles under your league scoring.",
  tkl_ast:
    "Fantasy points from assisted tackles under your league scoring.",
  tkl_loss:
    "Fantasy points from tackles for loss under your league scoring.",
  int: "Fantasy points from interceptions under your league scoring.",
  ff: "Fantasy points from forced fumbles under your league scoring.",
  fum_rec:
    "Fantasy points from fumble recoveries under your league scoring.",
  safe: "Fantasy points from safeties under your league scoring.",
  def_td: "Fantasy points from defensive touchdowns under your league scoring.",
  other:
    "Remaining fantasy points from other defensive scoring rules.",
};

function scoringSegmentHelp(segmentId: string, label: string): string {
  return (
    SCORING_SEGMENT_HELP[segmentId] ??
    `Share of season fantasy points from ${label.toLowerCase()} under your league scoring.`
  );
}

const SEGMENT_SHORT_LABELS: Record<string, string> = {
  pass_yd: "Pass yds",
  pass_td: "Pass TD",
  rush_yd: "Rush yds",
  rush_td: "Rush TD",
  rec: "Receptions",
  rec_yd: "Rec yds",
  rec_td: "Rec TD",
  fg_short: "FG <40",
  fg_40: "FG 40–49",
  fg_50: "FG 50+",
  fg: "FG",
  xp: "XP",
  sack: "Sacks",
  tkl_solo: "Solo",
  tkl_ast: "Ast",
  tkl_loss: "TFL",
  int: "INTs",
  ff: "FF",
  fum_rec: "FR",
  safe: "Safety",
  def_td: "TDs",
  other: "Other",
};

function segmentShortLabel(segmentId: string, label: string): string {
  return SEGMENT_SHORT_LABELS[segmentId] ?? label;
}

function ScoringSummaryFooter({ summary }: { summary: string }) {
  const [headline, detail] = summary.split(" — ");

  return (
    <p className="flex items-start text-xs text-pretty text-muted-foreground">
      <span>
        {detail ? (
          <>
            <span className="font-medium text-foreground">{headline}</span>
            <span> - {detail}</span>
          </>
        ) : (
          summary
        )}
      </span>
    </p>
  );
}

function consistencyScoreTextClass(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-emerald-400";
  if (score >= 40) return "text-warning";
  return "text-destructive";
}

function ConsistencyFooter({
  score,
  label,
  stdev,
}: {
  score: number;
  label: string;
  stdev: number;
}) {
  return (
    <p className="flex items-start text-xs text-pretty text-muted-foreground">
      <span>
        Consistency score:{" "}
        <span
          className={cn(
            "font-semibold",
            consistencyScoreTextClass(score),
          )}
        >
          {score}
        </span>
        <span>
          {" "}
          - {label.toLowerCase()} week to week (±{stdev.toFixed(1)} pts)
        </span>
      </span>
    </p>
  );
}

function ScoringSegmentTooltip({
  segment,
  color,
  gamesPlayed,
  triggerClassName,
  triggerStyle,
  onHoverChange,
  children,
}: {
  segment: PlayerOverviewMetrics["scoringBreakdown"]["segments"][number];
  color: string;
  gamesPlayed: number;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  onHoverChange?: (id: string | null) => void;
  children?: ReactNode;
}) {
  const gp = Math.max(1, gamesPlayed);
  const ptsPerGame = segment.points / gp;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn("min-w-0", triggerClassName)}
            style={triggerStyle}
            onMouseEnter={() => onHoverChange?.(segment.id)}
            onMouseLeave={() => onHoverChange?.(null)}
            onFocus={() => onHoverChange?.(segment.id)}
            onBlur={() => onHoverChange?.(null)}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="flex flex-col gap-1.5 py-0.5 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 font-medium">
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              {segment.label}
            </span>
            <span className="tabular-nums opacity-80">
              {segment.pct.toFixed(0)}%
            </span>
          </div>
          <p className="text-pretty leading-snug opacity-75">
            {scoringSegmentHelp(segment.id, segment.label)}
          </p>
          <p className="tabular-nums opacity-80">
            {formatPts(ptsPerGame)} pts/g · {formatPts(segment.points)} season
            pts
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function ScoringBreakdownPanel({
  breakdown,
  gamesPlayed,
}: {
  breakdown: PlayerOverviewMetrics["scoringBreakdown"];
  gamesPlayed: number;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">
            {formatPts(breakdown.fptsPerGame)}
          </span>
          <span className="text-xs text-muted-foreground">FPts / game</span>
        </div>
        <div
          className="flex h-7 overflow-hidden rounded-full ring-1 ring-foreground/10"
          role="img"
          aria-label="Scoring breakdown bar"
        >
          {breakdown.segments.map((segment, index) => {
            const color = segmentColor(segment.id, index);
            const showPct = segment.pct >= 8;
            const dimmed = hoveredId != null && hoveredId !== segment.id;
            return (
              <ScoringSegmentTooltip
                key={segment.id}
                segment={segment}
                color={color}
                gamesPlayed={gamesPlayed}
                onHoverChange={setHoveredId}
                triggerClassName={cn(
                  "flex h-full min-w-0 cursor-default items-center justify-center transition-opacity duration-150",
                  dimmed && "opacity-35",
                )}
                triggerStyle={{
                  width: `${Math.max(segment.pct, 0)}%`,
                  backgroundColor: color,
                }}
              >
                {showPct ? (
                  <span className="text-[10px] font-semibold tabular-nums text-black/75">
                    {segment.pct.toFixed(0)}%
                  </span>
                ) : null}
              </ScoringSegmentTooltip>
            );
          })}
        </div>
        <ul className="flex flex-wrap gap-2">
          {breakdown.segments.map((segment, index) => {
            const color = segmentColor(segment.id, index);
            const ptsPerGame = segment.points / Math.max(1, gamesPlayed);
            const isActive = hoveredId === segment.id;
            const dimmed = hoveredId != null && !isActive;
            return (
              <li
                key={segment.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 ring-1 transition-[opacity,background-color,box-shadow] duration-150",
                  isActive
                    ? "bg-muted ring-foreground/20"
                    : "bg-muted/40 ring-foreground/10",
                  dimmed && "opacity-40",
                )}
              >
                <span
                  className="size-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {segmentShortLabel(segment.id, segment.label)}
                </span>
                <span
                  className="text-xs font-semibold tabular-nums"
                  style={{ color }}
                >
                  {formatPts(ptsPerGame)}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {segment.pct.toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </TooltipProvider>
  );
}

const weekChartConfig = {
  fpts: { label: "FPts", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Relative band treated as "around" / "slightly below" vs league average. */
const EFFICIENCY_AROUND_BAND = 0.05;
const EFFICIENCY_SLIGHTLY_BELOW_BAND = 0.15;
/** Typical combined FG + XP makes per game for NFL kickers. */
const K_LEAGUE_KICKS_PER_WEEK = 4;
/** Within this share of season average (or at least 3 pts) counts as "just below". */
const WEEKLY_JUST_BELOW_RATIO = 0.2;
const WEEKLY_JUST_BELOW_MIN_PTS = 3;

type WeeklyVsAvgTone = "above" | "just_below" | "below";

function weeklyVsAvgTone(value: number, avg: number | null): WeeklyVsAvgTone {
  if (avg == null || value >= avg) return "above";
  const justBelowPts = Math.max(
    Math.abs(avg) * WEEKLY_JUST_BELOW_RATIO,
    WEEKLY_JUST_BELOW_MIN_PTS,
  );
  if (value >= avg - justBelowPts) return "just_below";
  return "below";
}

const WEEKLY_TONE_FILL: Record<WeeklyVsAvgTone, string> = {
  above: "var(--success)",
  just_below: "var(--warning)",
  below: "var(--destructive)",
};

const WEEKLY_TONE_TEXT: Record<WeeklyVsAvgTone, string> = {
  above: "text-success",
  just_below: "text-warning",
  below: "text-destructive",
};

/** Position finish bands relative to the startable barometer. */
const FINISH_DEPTH_PAD = 14;

type FinishRankTone = "success" | "muted" | "warning" | "destructive";

function finishRankTone(
  rank: number,
  startableThreshold = 12,
): FinishRankTone {
  if (rank <= startableThreshold) return "success";
  if (rank <= startableThreshold + 12) return "muted";
  if (rank <= startableThreshold + FINISH_DEPTH_PAD + 12) return "warning";
  return "destructive";
}

const FINISH_TONE_FILL: Record<FinishRankTone, string> = {
  success: "var(--success)",
  muted: "var(--muted-foreground)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
};

const FINISH_TONE_TEXT: Record<FinishRankTone, string> = {
  success: "text-success",
  muted: "text-muted-foreground",
  warning: "text-warning",
  destructive: "text-destructive",
};

function finishStartableCountTone(count: number, games: number): WeeklyVsAvgTone {
  if (games <= 0) return "below";
  const pct = (count / games) * 100;
  if (pct >= 50) return "above";
  if (pct >= 25) return "just_below";
  return "below";
}

function finishLineColor(
  averageFinish: number,
  startableThreshold = 12,
): string {
  return FINISH_TONE_FILL[
    finishRankTone(averageFinish, startableThreshold)
  ];
}

function buildFinishAxisTicks(maxRank: number, floor = 24): number[] {
  const step = 12;
  const top = Math.max(floor, Math.ceil(maxRank / step) * step);
  const ticks: number[] = [];
  for (let value = step; value <= top; value += step) {
    ticks.push(value);
  }
  return ticks;
}

function efficiencyLineColor(value: number, avg: number | null): string {
  if (avg == null) return "var(--chart-1)";
  const relative = avg === 0 ? 0 : (value - avg) / Math.abs(avg);
  if (relative >= EFFICIENCY_AROUND_BAND) return "var(--success)";
  if (relative >= -EFFICIENCY_AROUND_BAND) return "var(--muted-foreground)";
  if (relative >= -EFFICIENCY_SLIGHTLY_BELOW_BAND) {
    return "var(--warning)";
  }
  return "var(--destructive)";
}

/** Lower PA is better — invert efficiency coloring vs the position average. */
function pointsAllowedLineColor(value: number, avg: number | null): string {
  if (avg == null) return "var(--chart-1)";
  return efficiencyLineColor(-value, -avg);
}

function weeklyBarColor(value: number, avg: number | null): string {
  return WEEKLY_TONE_FILL[weeklyVsAvgTone(value, avg)];
}

type WeeklyChartRow = {
  week: number;
  label: string;
  opponentTick: string;
  opponent: string;
  fpts: number | null;
  /** Value fed to Recharts (0 for bye/dnp placeholders). */
  barValue: number | null;
  kind: "scored" | "bye" | "dnp" | "upcoming";
  /** When Without QB1 is on: fade weeks QB1 played (sample stays full opacity). */
  muted?: boolean;
};

const WEEKLY_STATUS_BAR_HEIGHT = 22;
const WEEKLY_STATUS_ICON_SIZE = 8;

type WeeklyBarShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: WeeklyChartRow;
  /** Mobile: icon instead of BYE/DNP text in the status bar. */
  compact?: boolean;
};

function WeeklyFptsBarShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill,
  payload,
  compact = false,
}: WeeklyBarShapeProps) {
  if (!payload || payload.kind === "upcoming" || payload.barValue == null) {
    return null;
  }

  if (payload.kind === "bye" || payload.kind === "dnp") {
    // Stay inside the Recharts bar slot — never widen past `width` (causes overlap).
    const gap = Math.min(1, Math.max(width * 0.1, 0));
    const boxWidth = Math.max(width - gap, 1);
    const boxX = x + (width - boxWidth) / 2;
    const baseline = height > 0 ? y + height : y;
    const boxY = baseline - WEEKLY_STATUS_BAR_HEIGHT;
    const isDnp = payload.kind === "dnp";
    const statusColor = isDnp
      ? "var(--destructive)"
      : "var(--muted-foreground)";
    const iconSize = Math.min(WEEKLY_STATUS_ICON_SIZE, Math.max(boxWidth - 2, 6));
    const radius = Math.min(4, boxWidth / 2);
    return (
      <g opacity={payload.muted ? 0.28 : 1}>
        <rect
          x={boxX}
          y={boxY}
          width={boxWidth}
          height={WEEKLY_STATUS_BAR_HEIGHT}
          rx={radius}
          ry={radius}
          fill="var(--muted)"
          stroke={isDnp ? "var(--destructive)" : "var(--color-border)"}
          strokeWidth={1}
        />
        {compact ? (
          <foreignObject
            x={boxX + (boxWidth - iconSize) / 2}
            y={boxY + (WEEKLY_STATUS_BAR_HEIGHT - iconSize) / 2}
            width={iconSize}
            height={iconSize}
          >
            <div className="flex size-full items-center justify-center">
              <HugeiconsIcon
                icon={isDnp ? BriefcaseMedicalIcon : ZzzIcon}
                strokeWidth={2}
                size={iconSize}
                color={statusColor}
                aria-label={isDnp ? "Did not play" : "Bye week"}
              />
            </div>
          </foreignObject>
        ) : (
          <text
            x={boxX + boxWidth / 2}
            y={boxY + WEEKLY_STATUS_BAR_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={statusColor}
            fontSize={9}
            fontWeight={600}
          >
            {isDnp ? "DNP" : "BYE"}
          </text>
        )}
      </g>
    );
  }

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={4}
      ry={4}
      fill={fill}
      opacity={payload.muted ? 0.28 : 1}
    />
  );
}

function WeeklyOpponentTick({
  x,
  y,
  payload,
  rows,
  compact,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: number | string };
  rows: WeeklyChartRow[];
  /** Mobile: week digits only — opponent lives in the bar tooltip. */
  compact?: boolean;
}) {
  const week = Number(payload?.value);
  const row = rows.find((r) => r.week === week);
  const tickX = typeof x === "number" ? x : Number(x);
  const tickY = typeof y === "number" ? y : Number(y);
  if (row == null || !Number.isFinite(tickX) || !Number.isFinite(tickY)) {
    return null;
  }

  if (compact) {
    const lastWeek = rows[rows.length - 1]?.week;
    const showLabel =
      row.week === 1 ||
      row.week === lastWeek ||
      row.week % 2 === 1;
    if (!showLabel) return null;

    return (
      <g transform={`translate(${tickX},${tickY})`}>
        <text
          dy={10}
          textAnchor="middle"
          fill="var(--muted-foreground)"
          fontSize={10}
          className="tabular-nums"
        >
          {row.week}
        </text>
      </g>
    );
  }

  const secondary =
    row.kind === "bye" ? "BYE" : row.kind === "dnp" ? "DNP" : row.opponentTick;
  const secondaryFill =
    row.kind === "dnp" ? "var(--destructive)" : "var(--muted-foreground)";

  return (
    <g transform={`translate(${tickX},${tickY})`}>
      <text
        dy={10}
        textAnchor="middle"
        fill="var(--muted-foreground)"
        fontSize={9}
      >
        {`W${row.week}`}
      </text>
      {secondary ? (
        <text dy={22} textAnchor="middle" fill={secondaryFill} fontSize={8}>
          {secondary}
        </text>
      ) : null}
    </g>
  );
}

function formatPts(value: number | null | undefined, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(decimals);
}

function SosOpponentBadge({
  opponent,
  positionId,
}: {
  opponent: OverviewMatchupBucketOpponent;
  positionId: string;
}) {
  const isDef = positionId === "DEF";
  const isK = positionId === "K";
  const rateUnit = sosRateUnitLabel(positionId);
  const rankLabel =
    opponent.matchupRank != null
      ? isDef
        ? `#${opponent.matchupRank} scoring offense`
        : isK
          ? `#${opponent.matchupRank} against opposing kickers`
          : `#${opponent.matchupRank} vs opposing ${positionId}`
      : isDef
        ? "— offense rank"
        : isK
          ? "— vs opposing kickers"
          : `— vs opposing ${positionId}`;
  const allowedLabel =
    opponent.ptsAllowed != null
      ? `${formatPts(opponent.ptsAllowed)} ${rateUnit}`
      : `— ${rateUnit}`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${opponent.label}: ${rankLabel}, ${allowedLabel}`}
          />
        }
      >
        <Avatar size="sm" className="size-5">
          <AvatarImage
            src={getSleeperTeamLogoUrl(opponent.abbrev)}
            alt=""
          />
          <AvatarFallback>{opponent.abbrev.slice(0, 2)}</AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent className="flex flex-col items-start gap-0.5 text-left">
        <p className="font-semibold text-background">{opponent.label}</p>
        <p className="text-background/80">{rankLabel}</p>
        <p className="text-background/80">{allowedLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function WeeklyFptsTooltipContent({
  active,
  payload,
  averageFpts,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: WeeklyChartRow }>;
  averageFpts: number | null;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const opponentLabel =
    row.kind === "bye"
      ? "BYE"
      : row.kind === "dnp"
        ? "DNP"
        : row.opponentTick || row.opponent;
  const header = opponentLabel
    ? `Week ${row.week} - ${opponentLabel}`
    : `Week ${row.week}`;
  const delta =
    row.kind === "scored" && row.fpts != null && averageFpts != null
      ? row.fpts - averageFpts
      : null;

  return (
    <div className="grid min-w-36 gap-1 rounded-md bg-foreground px-3 py-2 text-xs text-background">
      <p className="font-semibold text-background">{header}</p>
      {row.kind === "bye" ? (
        <p className="text-background/80">Bye week</p>
      ) : row.kind === "dnp" ? (
        <p className="text-background/80">Did not play</p>
      ) : row.kind === "upcoming" ? (
        <p className="text-background/80">Upcoming</p>
      ) : (
        <>
          <p className="font-medium tabular-nums text-background">
            {formatPts(row.fpts)} pts
          </p>
          {delta != null ? (
            <p className="tabular-nums text-background/80">
              {delta >= 0 ? "+" : "−"}
              {Math.abs(delta).toFixed(1)} pts vs. average
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function FloorMedianTooltipContent({
  median,
  positionMedian,
  positionMedianLabel,
}: {
  median: number;
  positionMedian: number;
  positionMedianLabel: string;
}) {
  const delta = median - positionMedian;
  const absDelta = Math.abs(delta).toFixed(1);
  const positionNoun = positionMedianLabel.replace(/\s+median$/i, "");
  const headline =
    delta > 0.5
      ? `Above ${positionNoun} median`
      : delta < -0.5
        ? `Below ${positionNoun} median`
        : `Near ${positionNoun} median`;
  const detail =
    delta > 0.5
      ? `${absDelta} pts higher than a typical ${positionNoun} week (${formatPts(positionMedian)})`
      : delta < -0.5
        ? `${absDelta} pts lower than a typical ${positionNoun} week (${formatPts(positionMedian)})`
        : `In line with a typical ${positionNoun} week (${formatPts(positionMedian)})`;

  return (
    <div className="flex flex-col gap-0.5 py-0.5 text-left text-background">
      <p className="font-semibold">{headline}</p>
      <p className="text-pretty opacity-90">{detail}</p>
    </div>
  );
}

function formatEfficiencyValue(efficiency: {
  value: number;
  format: "percent" | "decimal";
  decimals: number;
}) {
  const raw = efficiency.value.toFixed(efficiency.decimals);
  return efficiency.format === "percent" ? `${raw}%` : raw;
}

function EfficiencyAvgTooltipContent({
  efficiency,
  avg,
  delta,
}: {
  efficiency: NonNullable<PlayerOverviewMetrics["efficiency"]>;
  avg: number;
  delta: number | null;
}) {
  const valueLine =
    efficiency.format === "percent"
      ? `${avg.toFixed(efficiency.decimals)}% ${efficiency.label.toLowerCase()}`
      : `${avg.toFixed(efficiency.decimals)} ${efficiency.label.toLowerCase()}`;
  const relativePct =
    delta != null && avg !== 0 ? (delta / avg) * 100 : null;

  return (
    <div className="flex flex-col gap-0.5 py-0.5 text-left">
      <p className="font-semibold">Vs league average</p>
      <p className="tabular-nums opacity-90">{valueLine}</p>
      {relativePct != null ? (
        <p className="tabular-nums opacity-80">
          {relativePct >= 0 ? "+" : "−"}
          {Math.abs(relativePct).toFixed(1)}%
        </p>
      ) : null}
    </div>
  );
}

function efficiencyScaleMax(efficiency: {
  value: number;
  format: "percent" | "decimal";
  positionAvg: number | null;
}) {
  if (efficiency.format === "percent") return 100;
  return Math.max(
    (efficiency.positionAvg ?? 4.2) * 1.6,
    efficiency.value,
    0.1,
  );
}

function efficiencyValuePct(
  value: number,
  efficiency: {
    value: number;
    format: "percent" | "decimal";
    positionAvg: number | null;
  },
) {
  const scale = efficiencyScaleMax(efficiency);
  return Math.max(0, Math.min(100, (value / scale) * 100));
}

function buildHeatGradient(greenStartPct: number) {
  const greenStart = Math.max(0, Math.min(100, greenStartPct));
  return `linear-gradient(90deg, var(--destructive) 0%, color-mix(in oklab, var(--destructive) 55%, var(--warning)) ${Math.max(greenStart * 0.45, 8)}%, var(--warning) ${Math.max(greenStart * 0.85, 12)}%, var(--success) ${greenStart}%, var(--success) 100%)`;
}

function CombinedKicksLineCard({
  playerName,
  share,
  weekly,
}: {
  playerName: string;
  share: NonNullable<PlayerOverviewMetrics["share"]>;
  weekly: NonNullable<PlayerOverviewMetrics["kickWeeklyMakes"]>;
}) {
  const seasonAvg =
    weekly.length > 0
      ? weekly.reduce((sum, row) => sum + row.made, 0) / weekly.length
      : null;
  const lineColor = efficiencyLineColor(
    seasonAvg ?? 0,
    K_LEAGUE_KICKS_PER_WEEK,
  );
  const chartConfig = {
    made: { label: playerName, color: lineColor },
    avg: { label: "Position average", color: "var(--muted-foreground)" },
  } satisfies ChartConfig;
  const yMax = (() => {
    const peak = Math.max(
      K_LEAGUE_KICKS_PER_WEEK,
      ...weekly.map((row) => row.made),
    );
    const padded = Math.max(4, Math.ceil(peak) + 1);
    return padded % 2 === 0 ? padded : padded + 1;
  })();
  const yTicks = Array.from({ length: yMax / 2 + 1 }, (_, i) => i * 2);
  const chartData = weekly.map((row) => ({
    ...row,
    avg: K_LEAGUE_KICKS_PER_WEEK,
  }));

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 rounded-xl bg-muted/30 p-3 ring-1 ring-foreground/8">
      <div className="flex flex-col gap-0.5">
        <h4 className="text-sm font-medium">Kicks made</h4>
        <p className="text-xs text-muted-foreground">
          Combined FG + XP makes by week
        </p>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums">
          {share.playerPct.toFixed(0)}%
          <span className="ms-1.5 text-sm font-normal text-muted-foreground">
            make rate
          </span>
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {share.playerTotal} / {share.teamTotal} makes
        </span>
      </div>
      <ChartContainer
        config={chartConfig}
        className="mt-auto aspect-auto h-56 min-h-52 w-full flex-1"
      >
        <LineChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 0, right: 4, top: 8, bottom: 4 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={chartAxisTick}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={28}
            ticks={yTicks}
            tick={chartAxisTick}
            allowDecimals={false}
            domain={[0, yMax]}
          />
          <ChartTooltip content={<KickMakesTooltipContent config={chartConfig} />} />
          <ChartLegend
            content={({ payload, verticalAlign }) => {
              const order = ["made", "avg"] as const;
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
          <Line
            type="monotone"
            dataKey="avg"
            stroke="var(--color-avg)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeOpacity={0.85}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="made"
            stroke="var(--color-made)"
            strokeWidth={2}
            dot={{ r: 2.5 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

function ChartSeriesTooltip({
  label,
  rows,
}: {
  label: string;
  rows: {
    key: string;
    label: string;
    value: string;
    color?: string;
  }[];
}) {
  return (
    <div className="grid min-w-40 items-start gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background">
      <div className="font-medium">{label}</div>
      <div className="grid gap-1.5">
        {rows.map((row) => (
          <div key={row.key} className="flex w-full items-center gap-2">
            {row.color ? (
              <div
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: row.color }}
              />
            ) : (
              <div className="size-2.5 shrink-0" aria-hidden />
            )}
            <div className="flex min-w-0 flex-1 items-center justify-between gap-4 leading-none">
              <span className="truncate text-background/70">{row.label}</span>
              <span className="shrink-0 font-mono font-medium tabular-nums text-background">
                {row.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KickMakesTooltipContent({
  active,
  payload,
  config,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    color?: string;
    dataKey?: string | number;
    payload?: {
      label?: string;
      week?: number;
      made?: number;
      avg?: number;
    };
  }>;
  config: ChartConfig;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const weekLabel =
    row.week != null ? `Week ${row.week}` : (row.label ?? "Week");
  const madeColor =
    payload.find((item) => item.dataKey === "made")?.color ??
    "var(--chart-1)";
  const avgColor =
    payload.find((item) => item.dataKey === "avg")?.color ??
    "var(--muted-foreground)";

  return (
    <ChartSeriesTooltip
      label={weekLabel}
      rows={[
        {
          key: "made",
          label: String(config.made?.label ?? "Player"),
          value: String(row.made ?? 0),
          color: madeColor,
        },
        {
          key: "avg",
          label: String(config.avg?.label ?? "Position average"),
          value:
            row.avg != null
              ? Number.isInteger(row.avg)
                ? String(row.avg)
                : row.avg.toFixed(1)
              : String(K_LEAGUE_KICKS_PER_WEEK),
          color: avgColor,
        },
      ]}
    />
  );
}

function WeeklyFinishTooltipContent({
  active,
  payload,
  positionId,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    payload?: {
      label?: string;
      week?: number;
      finish?: number;
      opponentTick?: string;
    };
  }>;
  positionId: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row || row.finish == null) return null;

  const finish = Math.round(row.finish);
  const opponent = row.opponentTick?.trim();
  const header =
    row.week != null
      ? opponent
        ? `Week ${row.week} - ${opponent}`
        : `Week ${row.week}`
      : (row.label ?? "Week");
  const positionLabel = positionId.trim() || "player";

  return (
    <div className="grid min-w-40 gap-1 rounded-md bg-foreground px-3 py-2 text-xs text-background">
      <p className="font-semibold text-background">{header}</p>
      <p className="text-pretty text-background/80">
        Finished {formatOrdinal(finish)} best {positionLabel}
      </p>
    </div>
  );
}

function formatOrdinal(n: number): string {
  const abs = Math.abs(Math.round(n));
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${abs}th`;
  switch (abs % 10) {
    case 1:
      return `${abs}st`;
    case 2:
      return `${abs}nd`;
    case 3:
      return `${abs}rd`;
    default:
      return `${abs}th`;
  }
}

function FgMakeRadarCard({
  playerName,
  brackets,
}: {
  playerName: string;
  brackets: NonNullable<PlayerOverviewMetrics["fgMakeRadar"]>;
}) {
  const chartConfig = {
    pct: { label: playerName, color: "var(--chart-1)" },
    leagueAvg: {
      label: "Position average",
      color: "var(--muted-foreground)",
    },
  } satisfies ChartConfig;
  const data = brackets.map((b) => ({
    bracket: b.label,
    pct: Math.round(b.pct),
    leagueAvg: Math.round(b.leagueAvgPct),
    made: b.made,
    attempts: b.attempts,
  }));

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 rounded-xl bg-muted/30 p-3 ring-1 ring-foreground/8">
      <div className="flex flex-col gap-0.5">
        <h4 className="text-sm font-medium">FG make rate by distance</h4>
        <p className="text-xs text-muted-foreground">
          Make percentage in each yardage bracket
        </p>
      </div>
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square w-full max-h-55"
      >
        <RadarChart data={data}>
          <ChartTooltip
            cursor={false}
            content={<FgMakeRadarTooltipContent config={chartConfig} />}
          />
          <PolarAngleAxis dataKey="bracket" tick={chartAxisTick} />
          <PolarGrid />
          <Radar
            dataKey="leagueAvg"
            fill="var(--color-leagueAvg)"
            fillOpacity={0.12}
            stroke="var(--color-leagueAvg)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
          <Radar
            dataKey="pct"
            fill="var(--color-pct)"
            fillOpacity={0.45}
            stroke="var(--color-pct)"
            strokeWidth={2}
            dot={{ r: 4, fillOpacity: 1 }}
          />
          <ChartLegend
            content={({ payload, verticalAlign }) => {
              const order = ["pct", "leagueAvg"] as const;
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
        </RadarChart>
      </ChartContainer>
    </div>
  );
}

function FgMakeRadarTooltipContent({
  active,
  payload,
  config,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    color?: string;
    dataKey?: string | number;
    payload?: {
      bracket?: string;
      pct?: number;
      leagueAvg?: number;
      attempts?: number;
    };
  }>;
  config: ChartConfig;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const bracket = row.bracket ?? "Distance";
  const yardsLabel =
    bracket === "50+"
      ? "50+ yards"
      : bracket === "<20"
        ? "Under 20 yards"
        : `${bracket} yards`;
  const attempts = row.attempts ?? 0;
  const playerColor =
    payload.find((item) => item.dataKey === "pct")?.color ??
    "var(--chart-1)";
  const avgColor =
    payload.find((item) => item.dataKey === "leagueAvg")?.color ??
    "var(--muted-foreground)";

  return (
    <ChartSeriesTooltip
      label={yardsLabel}
      rows={[
        {
          key: "pct",
          label: String(config.pct?.label ?? "Player"),
          value: attempts === 0 ? "—" : `${row.pct ?? 0}%`,
          color: playerColor,
        },
        {
          key: "leagueAvg",
          label: String(config.leagueAvg?.label ?? "Position average"),
          value: row.leagueAvg != null ? `${row.leagueAvg}%` : "—",
          color: avgColor,
        },
      ]}
    />
  );
}

function PtsAllowRadarCard({
  playerName,
  brackets,
}: {
  playerName: string;
  brackets: NonNullable<PlayerOverviewMetrics["ptsAllowRadar"]>;
}) {
  const chartConfig = {
    games: { label: playerName, color: "var(--chart-1)" },
    leagueAvg: {
      label: "Position average",
      color: "var(--muted-foreground)",
    },
  } satisfies ChartConfig;
  const data = brackets.map((b) => ({
    bracket: b.label,
    games: b.games,
    leagueAvg: b.leagueAvgGames,
  }));

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 rounded-xl bg-muted/30 p-3 ring-1 ring-foreground/8">
      <div className="flex flex-col gap-0.5">
        <h4 className="text-sm font-medium">Games by points allowed</h4>
        <p className="text-xs text-muted-foreground">
          NFL points conceded by bracket
        </p>
      </div>
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square w-full max-h-55"
      >
        <RadarChart data={data}>
          <ChartTooltip
            cursor={false}
            content={<PtsAllowRadarTooltipContent config={chartConfig} />}
          />
          <PolarAngleAxis dataKey="bracket" tick={chartAxisTick} />
          <PolarGrid />
          <Radar
            dataKey="leagueAvg"
            fill="var(--color-leagueAvg)"
            fillOpacity={0.12}
            stroke="var(--color-leagueAvg)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
          <Radar
            dataKey="games"
            fill="var(--color-games)"
            fillOpacity={0.45}
            stroke="var(--color-games)"
            strokeWidth={2}
            dot={{ r: 4, fillOpacity: 1 }}
          />
          <ChartLegend
            content={({ payload, verticalAlign }) => {
              const order = ["games", "leagueAvg"] as const;
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
        </RadarChart>
      </ChartContainer>
    </div>
  );
}

function PtsAllowRadarTooltipContent({
  active,
  payload,
  config,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    color?: string;
    dataKey?: string | number;
    payload?: {
      bracket?: string;
      games?: number;
      leagueAvg?: number;
    };
  }>;
  config: ChartConfig;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const bracket = row.bracket ?? "Bracket";
  const playerColor =
    payload.find((item) => item.dataKey === "games")?.color ??
    "var(--chart-1)";
  const avgColor =
    payload.find((item) => item.dataKey === "leagueAvg")?.color ??
    "var(--muted-foreground)";

  const formatGames = (n: number) =>
    Number.isInteger(n) ? `${n}` : n.toFixed(1);

  return (
    <ChartSeriesTooltip
      label={`${bracket} pts allowed`}
      rows={[
        {
          key: "games",
          label: String(config.games?.label ?? "Player"),
          value: `${formatGames(row.games ?? 0)} games`,
          color: playerColor,
        },
        {
          key: "leagueAvg",
          label: String(config.leagueAvg?.label ?? "Position average"),
          value:
            row.leagueAvg != null
              ? `${formatGames(row.leagueAvg)} games`
              : "—",
          color: avgColor,
        },
      ]}
    />
  );
}

function PtsAllowWeeklyCard({
  playerName,
  weekly,
}: {
  playerName: string;
  weekly: NonNullable<PlayerOverviewMetrics["ptsAllowWeekly"]>;
}) {
  const seasonAvg =
    weekly.length > 0
      ? weekly.reduce((sum, row) => sum + row.value, 0) / weekly.length
      : null;
  const lineColor = pointsAllowedLineColor(
    seasonAvg ?? 0,
    DEF_LEAGUE_PA_PER_WEEK,
  );
  const chartConfig = {
    value: { label: playerName, color: lineColor },
    avg: { label: "Position average", color: "var(--muted-foreground)" },
  } satisfies ChartConfig;
  const yMax = (() => {
    const peak = Math.max(
      DEF_LEAGUE_PA_PER_WEEK,
      ...weekly.map((row) => row.value),
    );
    return Math.max(10, Math.ceil(peak / 5) * 5);
  })();
  const yTicks = Array.from({ length: yMax / 5 + 1 }, (_, i) => i * 5);
  const chartData = weekly.map((row) => ({
    ...row,
    avg: DEF_LEAGUE_PA_PER_WEEK,
  }));

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 rounded-xl bg-muted/30 p-3 ring-1 ring-foreground/8">
      <div className="flex flex-col gap-0.5">
        <h4 className="text-sm font-medium">Points allowed by week</h4>
        <p className="text-xs text-muted-foreground">
          Lower is better · vs DEF position average
        </p>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums">
          {seasonAvg != null ? seasonAvg.toFixed(1) : "—"}
          <span className="ms-1.5 text-sm font-normal text-muted-foreground">
            PA/G
          </span>
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          Pos avg {DEF_LEAGUE_PA_PER_WEEK}
        </span>
      </div>
      <ChartContainer
        config={chartConfig}
        className="mt-auto aspect-auto h-56 min-h-52 w-full flex-1"
      >
        <LineChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 0, right: 4, top: 8, bottom: 4 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={chartAxisTick}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={28}
            ticks={yTicks}
            tick={chartAxisTick}
            allowDecimals={false}
            domain={[0, yMax]}
          />
          <ChartTooltip
            content={<PtsAllowWeeklyTooltipContent config={chartConfig} />}
          />
          <ChartLegend
            content={({ payload, verticalAlign }) => {
              const order = ["value", "avg"] as const;
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
          <Line
            type="monotone"
            dataKey="avg"
            stroke="var(--color-avg)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeOpacity={0.85}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={{ r: 2.5 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

function PtsAllowWeeklyTooltipContent({
  active,
  payload,
  config,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    color?: string;
    dataKey?: string | number;
    payload?: {
      label?: string;
      week?: number;
      value?: number;
      avg?: number;
      opponentTick?: string | null;
    };
  }>;
  config: ChartConfig;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const weekLabel =
    row.week != null
      ? row.opponentTick
        ? `Week ${row.week} - ${row.opponentTick}`
        : `Week ${row.week}`
      : (row.label ?? "Week");
  const valueColor =
    payload.find((item) => item.dataKey === "value")?.color ??
    "var(--chart-1)";
  const avgColor =
    payload.find((item) => item.dataKey === "avg")?.color ??
    "var(--muted-foreground)";

  return (
    <ChartSeriesTooltip
      label={weekLabel}
      rows={[
        {
          key: "value",
          label: String(config.value?.label ?? "Player"),
          value:
            row.value != null ? `${row.value.toFixed(0)} PA` : "—",
          color: valueColor,
        },
        {
          key: "avg",
          label: String(config.avg?.label ?? "Position average"),
          value:
            row.avg != null
              ? `${row.avg.toFixed(0)} PA`
              : String(DEF_LEAGUE_PA_PER_WEEK),
          color: avgColor,
        },
      ]}
    />
  );
}

function EfficiencyCard({
  playerName,
  efficiency,
}: {
  playerName: string;
  efficiency: NonNullable<PlayerOverviewMetrics["efficiency"]>;
}) {
  const avg = efficiency.positionAvg;
  const delta = avg != null ? efficiency.value - avg : null;
  const playerPct = efficiencyValuePct(efficiency.value, efficiency);
  const avgPct = avg == null ? null : efficiencyValuePct(avg, efficiency);
  /** Green begins at league average along the full track. */
  const greenStart = avgPct ?? 55;
  const heatGradient = buildHeatGradient(greenStart);
  const fillWidth = Math.max(playerPct, 2);
  const lineColor = efficiencyLineColor(efficiency.value, avg);
  const chartConfig = {
    value: { label: playerName, color: lineColor },
    avg: { label: "Position average", color: "var(--muted-foreground)" },
  } satisfies ChartConfig;
  const chartData =
    avg == null
      ? efficiency.weekly
      : efficiency.weekly.map((row) => ({ ...row, avg }));

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 rounded-xl bg-muted/30 p-3 ring-1 ring-foreground/8">
      <div className="flex flex-col gap-0.5">
        <h4 className="text-sm font-medium">{efficiency.label}</h4>
        <p className="text-xs text-muted-foreground">
          Real production efficiency
        </p>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums">
          {formatEfficiencyValue(efficiency)}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {efficiency.detail}
        </span>
      </div>
      {avg != null ? (
        <div className="flex flex-col gap-2">
          <TooltipProvider>
            <div className="relative h-2.5 rounded-full bg-muted ring-1 ring-foreground/8">
              <div
                className="absolute inset-y-0 left-0 overflow-hidden rounded-full"
                style={{ width: `${fillWidth}%` }}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${10000 / fillWidth}%`,
                    backgroundImage: heatGradient,
                  }}
                />
              </div>
              {avgPct != null ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background shadow-xs ring-2 ring-foreground outline-none"
                        style={{ left: `${avgPct}%` }}
                        aria-label={`Vs league average ${avg.toFixed(efficiency.decimals)}${efficiency.format === "percent" ? "%" : ""}`}
                      />
                    }
                  />
                  <TooltipContent className="max-w-xs">
                    <EfficiencyAvgTooltipContent
                      efficiency={efficiency}
                      avg={avg}
                      delta={delta}
                    />
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </TooltipProvider>
          <p className="text-xs text-pretty text-muted-foreground">
            {efficiency.positionAvgLabel}{" "}
            <span className="tabular-nums text-foreground">
              {formatEfficiencyValue({
                value: avg,
                format: efficiency.format,
                decimals: efficiency.decimals,
              })}
            </span>
            {delta != null ? (
              <span
                className={cn(
                  "tabular-nums",
                  delta >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {" "}
                · {delta >= 0 ? "+" : ""}
                {efficiency.format === "percent"
                  ? `${delta.toFixed(0)} pts`
                  : delta.toFixed(1)}
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      {efficiency.weekly.length > 0 ? (
        <ChartContainer
          config={chartConfig}
          className="mt-auto aspect-auto h-56 min-h-52 w-full flex-1"
        >
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 0, right: 4, top: 8, bottom: 4 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              tick={chartAxisTick}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={32}
              tickCount={6}
              tick={chartAxisTick}
              tickFormatter={(v) =>
                efficiency.format === "percent"
                  ? String(Math.round(Number(v)))
                  : Number(v).toFixed(1)
              }
              domain={
                efficiency.format === "percent"
                  ? [0, 100]
                  : [
                      (dataMin: number) => {
                        const floor = Math.floor(dataMin * 2) / 2 - 0.5;
                        return Math.max(0, floor);
                      },
                      (dataMax: number) => Math.ceil(dataMax * 2) / 2 + 0.5,
                    ]
              }
            />
            <ChartTooltip
              content={
                <EfficiencyTooltipContent
                  config={chartConfig}
                  efficiency={efficiency}
                />
              }
            />
            <ChartLegend
              content={({ payload, verticalAlign }) => {
                const order = ["value", "avg"] as const;
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
            {avg != null ? (
              <Line
                type="monotone"
                dataKey="avg"
                stroke="var(--color-avg)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeOpacity={0.85}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={{ r: 2.5 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      ) : null}
    </div>
  );
}

function EfficiencyTooltipContent({
  active,
  payload,
  config,
  efficiency,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    color?: string;
    dataKey?: string | number;
    payload?: {
      label?: string;
      week?: number;
      value?: number;
      avg?: number;
      opponentTick?: string | null;
    };
  }>;
  config: ChartConfig;
  efficiency: NonNullable<PlayerOverviewMetrics["efficiency"]>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row || row.value == null) return null;

  const opponent = row.opponentTick?.trim();
  const header =
    row.week != null
      ? opponent
        ? `Week ${row.week} - ${opponent}`
        : `Week ${row.week}`
      : (row.label ?? "Week");
  const valueColor =
    payload.find((item) => item.dataKey === "value")?.color ??
    "var(--chart-1)";
  const avgColor =
    payload.find((item) => item.dataKey === "avg")?.color ??
    "var(--muted-foreground)";

  const rows: {
    key: string;
    label: string;
    value: string;
    color?: string;
  }[] = [
    {
      key: "value",
      label: String(config.value?.label ?? "Player"),
      value: formatEfficiencyValue({
        value: row.value,
        format: efficiency.format,
        decimals: efficiency.decimals,
      }),
      color: valueColor,
    },
  ];
  if (row.avg != null) {
    rows.push({
      key: "avg",
      label: String(config.avg?.label ?? "Position average"),
      value: formatEfficiencyValue({
        value: row.avg,
        format: efficiency.format,
        decimals: efficiency.decimals,
      }),
      color: avgColor,
    });
  }

  return <ChartSeriesTooltip label={header} rows={rows} />;
}

function Section({
  title,
  description,
  action,
  children,
  footer,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card size="sm" className="min-w-0 gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle className="text-base text-balance">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-pretty">
            {description}
          </CardDescription>
        ) : null}
        {action ? <CardAction className="self-center">{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4 py-4">
        {children}
      </CardContent>
      {footer ? (
        <CardFooter className="border-t bg-muted/30 py-3">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}

function splitDeltaTextClass(delta: number): string {
  if (delta > 0.05) return "text-success";
  if (delta < -0.05) return "text-destructive";
  return "text-muted-foreground";
}

function formatSplitPts(value: number): string {
  return Math.abs(value).toFixed(1);
}

function homeAwayFooter(delta: number): ReactNode {
  if (Math.abs(delta) <= 0.05) {
    return "Scores about the same at home and away.";
  }
  const venue = delta > 0 ? "home" : "away";
  return (
    <>
      Scores on average{" "}
      <span className={cn("font-semibold tabular-nums", splitDeltaTextClass(delta))}>
        {formatSplitPts(delta)} pts
      </span>{" "}
      more per game at {venue}.
    </>
  );
}

function restFooter(delta: number): ReactNode {
  if (Math.abs(delta) <= 0.05) {
    return "Scores about the same coming off the bye week.";
  }
  const direction = delta > 0 ? "more" : "less";
  return (
    <>
      Scores{" "}
      <span className={cn("font-semibold tabular-nums", splitDeltaTextClass(delta))}>
        {formatSplitPts(delta)} pts
      </span>{" "}
      {direction} coming off the bye week.
    </>
  );
}

function outdoorIndoorFooter(delta: number) {
  const direction = delta >= 0 ? "more" : "fewer";
  return (
    <>
      Scores{" "}
      <span className={cn("font-semibold tabular-nums", splitDeltaTextClass(delta))}>
        {formatSplitPts(delta)} pts
      </span>{" "}
      {direction} per game outdoors than indoors.
    </>
  );
}

function SplitCard({
  title,
  rows,
  delta,
  kind,
}: {
  title: string;
  rows: {
    label: string;
    detail: string;
    games: number;
    fptsPerGame: number | null;
  }[];
  delta: number | null;
  kind: "homeAway" | "rest" | "outdoorIndoor";
}) {
  const footer =
    delta == null
      ? null
      : kind === "homeAway"
        ? homeAwayFooter(delta)
        : kind === "rest"
          ? restFooter(delta)
          : outdoorIndoorFooter(delta);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl bg-muted/30 p-3 ring-1 ring-foreground/8">
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {row.label}
            </span>
            <span className="text-lg font-semibold tabular-nums">
              {formatPts(row.fptsPerGame)}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.games} {row.games === 1 ? "game" : "games"}
            </span>
          </div>
        ))}
      </div>
      {footer ? (
        <p className="-mx-3 -mb-3 mt-auto rounded-b-xl border-t border-foreground/8 bg-muted/30 px-3 py-2.5 text-xs text-pretty text-muted-foreground">
          {footer}
        </p>
      ) : null}
    </div>
  );
}

type PlayerOverviewTabProps = {
  overview: PlayerOverviewMetrics;
  withoutQb1?: {
    qbLastName: string;
    qbFullName?: string;
    qbSleeperId?: string | null;
    qbNflTeam?: string | null;
    withoutGames: number;
    withoutWeeks: number[];
    overview: PlayerOverviewMetrics;
  } | null;
  /** Controlled by the toolbar toggle opposite the season select. */
  withoutActive?: boolean;
  leagueSlug?: string | null;
};

export function PlayerOverviewTab({
  overview: overviewAll,
  withoutQb1 = null,
  withoutActive = false,
  leagueSlug,
}: PlayerOverviewTabProps) {
  const isMobile = useIsMobile();
  const withoutOn =
    withoutActive &&
    withoutQb1 != null &&
    withoutQb1.withoutGames > 0;
  /** Counting stats, share, efficiency headline, floor / splits flip with the toggle. */
  const overview =
    withoutOn && withoutQb1 ? withoutQb1.overview : overviewAll;
  /**
   * Efficiency headline (catch rate / YPC) follows the toggle; the weekly
   * line chart always stays on the full-season series.
   */
  const efficiency =
    overview.efficiency == null
      ? null
      : withoutOn && overviewAll.efficiency
        ? {
            ...overview.efficiency,
            weekly: overviewAll.efficiency.weekly,
          }
        : overview.efficiency;
  /** Weekly finish and SOS stay on the full-season series. */
  const weeklyFinish = overviewAll.weeklyFinish;
  const matchupDifficulty = overviewAll.matchupDifficulty;

  const withoutWeekSet = new Set(withoutQb1?.withoutWeeks ?? []);
  const chartData: WeeklyChartRow[] = overviewAll.weeklyPoints.map((w) => {
    const opponentTick =
      formatOpponentTick(w.venue, w.opponentAbbrev) ?? "";
    /**
     * Without on: keep the without-QB1 sample full strength; fade weeks
     * QB1 played (and other non-sample weeks) so the slate stays visible.
     */
    const muted =
      withoutOn &&
      w.fpts != null &&
      !w.isBye &&
      !withoutWeekSet.has(w.week);
    if (w.isBye) {
      return {
        week: w.week,
        label: `W${w.week}`,
        opponentTick,
        opponent: w.opponent ?? "BYE",
        fpts: null,
        barValue: 0,
        kind: "bye" as const,
        muted,
      };
    }
    if (w.isDnp) {
      return {
        week: w.week,
        label: `W${w.week}`,
        opponentTick,
        opponent: w.opponent ?? "DNP",
        fpts: null,
        barValue: 0,
        kind: "dnp" as const,
        muted,
      };
    }
    if (w.fpts == null) {
      return {
        week: w.week,
        label: `W${w.week}`,
        opponentTick,
        opponent: w.opponent ?? "—",
        fpts: null,
        barValue: null,
        kind: "upcoming" as const,
        muted,
      };
    }
    return {
      week: w.week,
      label: `W${w.week}`,
      opponentTick,
      opponent: w.opponent ?? "—",
      fpts: w.fpts,
      barValue: w.fpts,
      kind: "scored" as const,
      muted,
    };
  });
  const hasWeeklyScores = chartData.some((d) => d.kind === "scored");

  const floorCeiling = overview.floorCeiling;
  const rangeMin = floorCeiling
    ? Math.min(floorCeiling.floor, floorCeiling.worst.fpts) * 0.9
    : 0;
  const rangeMax = floorCeiling
    ? Math.max(floorCeiling.ceiling, floorCeiling.best.fpts) * 1.05
    : 1;
  const rangeSpan = Math.max(rangeMax - rangeMin, 1);
  const floorRangeLeft = floorCeiling
    ? ((floorCeiling.floor - rangeMin) / rangeSpan) * 100
    : 0;
  const floorRangeWidth = floorCeiling
    ? ((floorCeiling.ceiling - floorCeiling.floor) / rangeSpan) * 100
    : 0;
  const floorMedianInRange =
    floorCeiling == null || floorCeiling.ceiling === floorCeiling.floor
      ? 50
      : ((floorCeiling.median - floorCeiling.floor) /
          (floorCeiling.ceiling - floorCeiling.floor)) *
        100;
  const floorMedianLeft = floorCeiling
    ? ((floorCeiling.median - rangeMin) / rangeSpan) * 100
    : 0;

  const finishThreshold = weeklyFinish?.startableThreshold ?? 12;
  const weekByNumber = new Map(
    overviewAll.weeklyPoints.map((w) => [w.week, w] as const),
  );
  /** Active weeks only; string `label` keeps the axis categorical (even spacing). */
  const finishSpark = weeklyFinish?.weeks.map((w) => {
    const weekRow = weekByNumber.get(w.week);
    const opponentTick = weekRow
      ? formatOpponentTick(weekRow.venue, weekRow.opponentAbbrev) ??
        weekRow.opponent ??
        ""
      : "";
    return {
      week: w.week,
      label: String(w.week),
      finish: w.finish,
      opponentTick,
    };
  });
  const finishWeekTicks = (() => {
    const labels = finishSpark?.map((row) => row.label) ?? [];
    if (labels.length === 0) return [];
    if (!isMobile || labels.length <= 9) return labels;
    const first = labels[0]!;
    const last = labels[labels.length - 1]!;
    return labels.filter(
      (label, index) => label === first || label === last || index % 2 === 0,
    );
  })();
  const finishMaxRank = weeklyFinish
    ? Math.max(
        ...weeklyFinish.weeks.map((w) => w.finish),
        finishThreshold,
      )
    : finishThreshold;
  const finishDomainMax = Math.max(
    finishThreshold,
    Math.ceil(finishMaxRank / 12) * 12,
  );
  const finishTicks = buildFinishAxisTicks(finishDomainMax, finishThreshold);
  const finishStroke = weeklyFinish
    ? finishLineColor(weeklyFinish.averageFinish, finishThreshold)
    : "var(--chart-2)";
  const finishChartConfigDynamic = {
    finish: { label: overviewAll.playerName, color: finishStroke },
  } satisfies ChartConfig;
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <Section
        title="Season Production"
        description={`${overview.seasonLabel} counting stats${
          overview.gamesPlayed > 0
            ? ` · ${overview.gamesPlayed} games scored`
            : ""
        }${
          withoutOn && withoutQb1
            ? ` · without ${withoutQb1.qbLastName}`
            : ""
        }`}
      >
        {overview.production.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {overview.production.map((stat) => (
              <div
                key={stat.key}
                className={cn(
                  "flex flex-col gap-1 rounded-lg bg-muted/40 px-2.5 py-2 ring-1 ring-foreground/8",
                  projectionAccentSurfaceClass(stat.accentTone),
                )}
              >
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {stat.label}
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      projectionAccentTextClass(stat.accentTone),
                    )}
                  >
                    {formatProjectionStat(stat.value, stat.decimals ?? 0)}
                  </span>
                  {stat.perGame != null ? (
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {formatProjectionPerGame(stat.perGame)}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty className="border-none" size="sm">
            <EmptyHeader>
              <EmptyTitle>No production yet</EmptyTitle>
              <EmptyDescription>
                Season stats appear after games are scored.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Section>

      <Section
        title="Fantasy Scoring Breakdown"
        description="Share of season fantasy points by source under your league scoring."
        footer={
          overview.scoringBreakdown.summary ? (
            <ScoringSummaryFooter
              summary={overview.scoringBreakdown.summary}
            />
          ) : undefined
        }
      >
        {overview.scoringBreakdown.segments.length > 0 ? (
          <ScoringBreakdownPanel
            breakdown={overview.scoringBreakdown}
            gamesPlayed={overview.gamesPlayed}
          />
        ) : (
          <Empty className="border-none" size="sm">
            <EmptyHeader>
              <EmptyTitle>No scoring breakdown</EmptyTitle>
              <EmptyDescription>
                Breakdown appears when season stats are available.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Section>

      <Section
        title={
          overview.ptsAllowRadar || overview.ptsAllowWeekly
            ? "Points Allowed"
            : overview.share?.kind === "kick" || overview.fgMakeRadar
              ? "Accuracy"
              : "Opportunity and Efficiency"
        }
        description={
          overview.ptsAllowRadar || overview.ptsAllowWeekly
            ? "NFL points conceded by bracket and weekly PA vs league average."
            : overview.share?.kind === "kick" || overview.fgMakeRadar
              ? "Combined kicks made by week and FG make rate by distance."
              : "Team opportunity share paired with how efficiently they convert it."
        }
      >
        {overview.ptsAllowRadar || overview.ptsAllowWeekly ? (
          <div className="grid items-stretch gap-4 sm:grid-cols-[2fr_3fr]">
            {overview.ptsAllowRadar ? (
              <PtsAllowRadarCard
                playerName={overview.playerName}
                brackets={overview.ptsAllowRadar}
              />
            ) : null}
            {overview.ptsAllowWeekly ? (
              <PtsAllowWeeklyCard
                playerName={overview.playerName}
                weekly={overview.ptsAllowWeekly}
              />
            ) : null}
          </div>
        ) : overview.share || efficiency || overview.fgMakeRadar ? (
          <div
            className={cn(
              "grid items-stretch gap-4",
              overview.share?.kind === "kick" || overview.fgMakeRadar
                ? "sm:grid-cols-[3fr_2fr]"
                : "sm:grid-cols-[2fr_3fr]",
            )}
          >
            {overview.share?.kind === "kick" && overview.kickWeeklyMakes ? (
              <CombinedKicksLineCard
                playerName={overview.playerName}
                share={overview.share}
                weekly={overview.kickWeeklyMakes}
              />
            ) : overview.share && overview.share.kind !== "kick" ? (
              <div className="flex h-full min-w-0 flex-col gap-3 rounded-xl bg-muted/30 p-3 ring-1 ring-foreground/8">
                <div className="flex flex-col gap-0.5">
                  <h4 className="text-sm font-medium">{overview.share.label}</h4>
                  <p className="text-xs text-muted-foreground">
                    Share of team opportunity
                  </p>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-semibold tabular-nums">
                    {overview.share.playerPct.toFixed(0)}%
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {overview.share.playerTotal} / {overview.share.teamTotal}
                  </span>
                </div>
                <div
                  className="grid min-h-0 w-full flex-1 grid-cols-10 grid-rows-10 gap-1"
                  role="img"
                  aria-label={`${overview.share.label}: ${overview.share.playerPct}%`}
                >
                  {overview.share.cells.map((filled, index) => (
                    <div
                      key={index}
                      className={cn(
                        "min-h-0 min-w-0 rounded-[2px]",
                        filled
                          ? "border bg-success"
                          : "bg-muted",
                      )}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Each square = 1%
                </p>
              </div>
            ) : null}

            {overview.fgMakeRadar ? (
              <FgMakeRadarCard
                playerName={overview.playerName}
                brackets={overview.fgMakeRadar}
              />
            ) : efficiency ? (
              <EfficiencyCard
                playerName={overviewAll.playerName}
                efficiency={efficiency}
              />
            ) : null}
          </div>
        ) : (
          <Empty className="border-none" size="sm">
            <EmptyHeader>
              <EmptyTitle>No opportunity data</EmptyTitle>
              <EmptyDescription>
                Share and efficiency appear when season stats are available.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Section>

      <Section
        title="Fantasy Points by Week"
        description={
          withoutOn
            ? "Full season slate — weeks with QB1 are faded; average line uses the without sample."
            : "Weekly fantasy points with season average."
        }
      >
        {hasWeeklyScores ? (
          <ChartContainer
            config={weekChartConfig}
            className="aspect-auto h-64 w-full"
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 4,
                right: 4,
                top: 8,
                bottom: isMobile ? 0 : 8,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="week"
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                interval={0}
                tick={(props) => (
                  <WeeklyOpponentTick
                    {...props}
                    rows={chartData}
                    compact={isMobile}
                  />
                )}
                height={isMobile ? 20 : 36}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={32}
                tick={chartAxisTick}
                tickFormatter={(v) => String(v)}
              />
              <ChartTooltip
                content={
                  <WeeklyFptsTooltipContent
                    averageFpts={overview.averageFpts}
                  />
                }
              />
              {overview.averageFpts != null ? (
                <ReferenceLine
                  y={overview.averageFpts}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                />
              ) : null}
              <Bar
                dataKey="barValue"
                shape={(props) => (
                  <WeeklyFptsBarShape {...props} compact={isMobile} />
                )}
                maxBarSize={28}
                isAnimationActive={false}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.week}
                    fill={
                      entry.kind === "scored" && entry.fpts != null
                        ? weeklyBarColor(entry.fpts, overview.averageFpts)
                        : "transparent"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <Empty className="border-none" size="sm">
            <EmptyHeader>
              <EmptyTitle>No weekly scores yet</EmptyTitle>
              <EmptyDescription>
                Chart fills in as weeks are scored.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Section>

      <Section
        title="Floor vs. Ceiling"
        description="15th–85th percentile outcomes from scored weeks."
        footer={
          floorCeiling ? (
            <ConsistencyFooter
              score={floorCeiling.consistencyScore}
              label={floorCeiling.consistencyLabel}
              stdev={floorCeiling.consistencyStdev}
            />
          ) : undefined
        }
      >
        {floorCeiling ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["Floor", floorCeiling.floor, "text-destructive"],
                  ["Median", floorCeiling.median, "text-foreground"],
                  ["Ceiling", floorCeiling.ceiling, "text-success"],
                ] as const
              ).map(([label, value, valueClass]) => (
                <div
                  key={label}
                  className="flex flex-col gap-0.5 rounded-lg bg-muted/40 px-2.5 py-2 ring-1 ring-foreground/8"
                >
                  <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    {label}
                  </span>
                  <span
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      valueClass,
                    )}
                  >
                    {formatPts(value)}
                  </span>
                </div>
              ))}
            </div>

            <TooltipProvider>
              <div className="relative h-3 rounded-full bg-muted ring-1 ring-foreground/8">
                <div
                  className="absolute inset-y-0 overflow-hidden rounded-full"
                  style={{
                    left: `${floorRangeLeft}%`,
                    width: `${Math.max(floorRangeWidth, 2)}%`,
                  }}
                >
                  <div
                    className="h-full w-full"
                    style={{
                      backgroundImage: buildHeatGradient(floorMedianInRange),
                    }}
                  />
                </div>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background shadow-xs ring-2 ring-foreground outline-none"
                        style={{ left: `${floorMedianLeft}%` }}
                        aria-label={`Vs ${floorCeiling.positionMedianLabel}: player median ${formatPts(floorCeiling.median)}, position median ${formatPts(floorCeiling.positionMedian)}`}
                      />
                    }
                  />
                  <TooltipContent className="max-w-xs">
                    {floorCeiling.positionMedian != null ? (
                      <FloorMedianTooltipContent
                        median={floorCeiling.median}
                        positionMedian={floorCeiling.positionMedian}
                        positionMedianLabel={floorCeiling.positionMedianLabel}
                      />
                    ) : (
                      <div className="flex flex-col gap-0.5 py-0.5 text-left">
                        <p className="font-semibold">Median</p>
                        <p className="tabular-nums opacity-90">
                          {formatPts(floorCeiling.median)} fantasy points
                        </p>
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Boom rate</span>
                <span className="font-medium tabular-nums text-success">
                  {floorCeiling.boomPct.toFixed(0)}%
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Bust rate</span>
                <span className="font-medium tabular-nums text-destructive">
                  {floorCeiling.bustPct.toFixed(0)}%
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Best</span>
                <span className="font-medium tabular-nums">
                  <span className="text-success">
                    {formatPts(floorCeiling.best.fpts)}
                  </span>
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {floorCeiling.best.opponent ?? "—"}
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Worst</span>
                <span className="font-medium tabular-nums">
                  <span className="text-destructive">
                    {formatPts(floorCeiling.worst.fpts)}
                  </span>
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {floorCeiling.worst.opponent ?? "—"}
                  </span>
                </span>
              </div>
            </div>
          </div>
        ) : (
          <Empty className="border-none" size="sm">
            <EmptyHeader>
              <EmptyTitle>Need more games</EmptyTitle>
              <EmptyDescription>
                Floor and ceiling need at least two scored weeks.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Section>

      <Section
        title="Weekly Finish"
        description="Weekly rank among players at this position."
      >
        {weeklyFinish ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  {
                    key: "avg",
                    label: "Avg",
                    valueClass:
                      FINISH_TONE_TEXT[
                        finishRankTone(
                          weeklyFinish.averageFinish,
                          finishThreshold,
                        )
                      ],
                    value: `#${weeklyFinish.averageFinish.toFixed(1)}`,
                  },
                  {
                    key: "best",
                    label: "Best",
                    valueClass:
                      FINISH_TONE_TEXT[
                        finishRankTone(
                          weeklyFinish.bestFinish,
                          finishThreshold,
                        )
                      ],
                    value: `#${Math.round(weeklyFinish.bestFinish)}`,
                  },
                  {
                    key: "worst",
                    label: "Worst",
                    valueClass:
                      FINISH_TONE_TEXT[
                        finishRankTone(
                          weeklyFinish.worstFinish,
                          finishThreshold,
                        )
                      ],
                    value: `#${Math.round(weeklyFinish.worstFinish)}`,
                  },
                  {
                    key: "startable",
                    label: `Top ${finishThreshold}`,
                    valueClass:
                      WEEKLY_TONE_TEXT[
                        finishStartableCountTone(
                          weeklyFinish.startableFinishes,
                          weeklyFinish.games,
                        )
                      ],
                    value:
                      weeklyFinish.games > 0
                        ? `${Math.round((weeklyFinish.startableFinishes / weeklyFinish.games) * 100)}%`
                        : "—",
                    detail: `${weeklyFinish.startableFinishes}/${weeklyFinish.games}`,
                  },
                ] as const
              ).map((metric) => (
                <div
                  key={metric.key}
                  className="flex flex-col gap-0.5 rounded-lg bg-muted/40 px-2.5 py-2 ring-1 ring-foreground/8"
                >
                  <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    {metric.label}
                  </span>
                  <span
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      metric.valueClass,
                    )}
                  >
                    {metric.value}
                    {"detail" in metric && metric.detail ? (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {metric.detail}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
            {finishSpark && finishSpark.length > 0 ? (
              <ChartContainer
                config={finishChartConfigDynamic}
                className="aspect-auto h-64 w-full"
              >
                <LineChart
                  accessibilityLayer
                  data={finishSpark}
                  margin={{ left: 4, right: 4, top: 8, bottom: 4 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    ticks={finishWeekTicks}
                    interval={0}
                    allowDuplicatedCategory={false}
                    tick={chartAxisTick}
                  />
                  <YAxis
                    reversed
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    domain={[1, finishDomainMax]}
                    ticks={finishTicks}
                    allowDecimals={false}
                    tick={chartAxisTick}
                  />
                  <ChartTooltip
                    content={
                      <WeeklyFinishTooltipContent
                        positionId={overview.primaryPositionId}
                      />
                    }
                  />
                  <ReferenceLine
                    y={finishThreshold}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="4 4"
                    strokeOpacity={0.55}
                  />
                  <Line
                    type="linear"
                    dataKey="finish"
                    stroke="var(--color-finish)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: finishStroke }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>
            ) : null}
          </div>
        ) : (
          <Empty className="border-none" size="sm">
            <EmptyHeader>
              <EmptyTitle>No weekly finishes</EmptyTitle>
              <EmptyDescription>
                Position finishes appear once weekly ranks are available.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Section>

      {overview.homeAway || overview.restImpact || overview.outdoorIndoor ? (
        <Section
          title="Splits"
          description={
            overview.outdoorIndoor
              ? "Home/away and outdoors vs indoors."
              : "Home/away and rest impact."
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            {overview.homeAway ? (
              <SplitCard
                title="Home vs away"
                rows={[overview.homeAway.home, overview.homeAway.away]}
                delta={overview.homeAway.delta}
                kind="homeAway"
              />
            ) : null}
            {overview.outdoorIndoor ? (
              <SplitCard
                title="Outdoors vs indoors"
                rows={[
                  overview.outdoorIndoor.outdoor,
                  overview.outdoorIndoor.indoor,
                ]}
                delta={overview.outdoorIndoor.delta}
                kind="outdoorIndoor"
              />
            ) : null}
            {overview.restImpact ? (
              <SplitCard
                title="Rest"
                rows={[
                  overview.restImpact.offBye,
                  overview.restImpact.normal,
                ]}
                delta={overview.restImpact.delta}
                kind="rest"
              />
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section
        title="Strength of Schedule"
        description={
          overview.primaryPositionId === "DEF"
            ? "Buckets by opposing offense scoring rank (1–8 Hard · 9–23 Average · 24–32 Easy); gold arc marks fantasy playoffs."
            : overview.primaryPositionId === "K"
              ? "Buckets by FPts defenses allow to kickers (1–8 Easy · 9–23 Average · 24–32 Hard); gold arc marks fantasy playoffs."
              : "Buckets by FPts defenses allow to fantasy-relevant players at this position; gold arc marks fantasy playoffs."
        }
      >
        {matchupDifficulty ? (
          <div className="grid items-center gap-6 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-3">
              {matchupDifficulty.scheduleSummary ? (
                <span className="text-2xl font-semibold text-balance">
                  {matchupDifficulty.scheduleSummary.headline}
                  <span className="ms-1.5 text-sm font-normal text-muted-foreground">
                    {matchupDifficulty.scheduleSummary.label}
                  </span>
                </span>
              ) : null}
              <ScheduleWheel data={matchupDifficulty} />
            </div>
            <TooltipProvider>
              <ul className="flex flex-col gap-2">
                {matchupDifficulty.buckets.map((bucket) => {
                  const tone =
                    bucket.id === "easy"
                      ? "bg-success"
                      : bucket.id === "hard"
                        ? "bg-destructive"
                        : "bg-muted-foreground";
                  return (
                    <li
                      key={bucket.id}
                      className="flex gap-3 rounded-lg bg-muted/30 px-3 py-2.5 ring-1 ring-foreground/8"
                    >
                      <span
                        className={cn(
                          "w-1 shrink-0 self-stretch rounded-full",
                          tone,
                        )}
                        aria-hidden
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">
                            {bucket.label}
                          </span>
                          <span className="text-sm font-semibold tabular-nums">
                            {formatPts(bucket.fptsPerGame)}
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              {sosRateUnitLabel(overview.primaryPositionId)}
                            </span>
                          </span>
                        </div>
                        {bucket.opponents.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {bucket.opponents.map((opponent) => (
                              <SosOpponentBadge
                                key={`${bucket.id}-${opponent.week}-${opponent.abbrev}`}
                                opponent={opponent}
                                positionId={overview.primaryPositionId}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </TooltipProvider>
          </div>
        ) : (
          <Empty className="border-none" size="sm">
            <EmptyHeader>
              <EmptyTitle>No schedule tiers yet</EmptyTitle>
              <EmptyDescription>
                Strength of schedule appears with opponent difficulty context.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Section>

      <Section
        title="Vs. Your Roster"
        description="Fantasy comparison against your players at this position."
      >
        {overview.rosterCompare.length > 0 ? (
          <RosterCompareTable
            rows={overview.rosterCompare}
            showRbUsage={overview.share?.kind === "carry"}
            startableThreshold={
              weeklyFinish?.startableThreshold ?? 12
            }
            leagueSlug={leagueSlug}
          />
        ) : (
          <Empty className="border-none" size="sm">
            <EmptyHeader>
              <EmptyTitle>No roster compare yet</EmptyTitle>
              <EmptyDescription>
                Open a player from your league to compare them with your roster
                at this position.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Section>
    </div>
  );
}
