"use client";

import dynamic from "next/dynamic";

import { TeamStatsMetricCards } from "@/components/team/team-stats-metric-cards";
import type { TeamStatsChartsData } from "@/lib/queries/team-stats-charts";

const PointsByWeekChart = dynamic(
  () =>
    import("@/components/team/charts/points-by-week-chart").then(
      (m) => m.PointsByWeekChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 animate-pulse rounded-xl bg-muted/40" />
    ),
  },
);

const PointsByPositionChart = dynamic(
  () =>
    import("@/components/team/charts/points-by-position-chart").then(
      (m) => m.PointsByPositionChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 animate-pulse rounded-xl bg-muted/40" />
    ),
  },
);

const MatchupLuckChart = dynamic(
  () =>
    import("@/components/team/charts/matchup-luck-chart").then(
      (m) => m.MatchupLuckChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 animate-pulse rounded-xl bg-muted/40" />
    ),
  },
);

const BenchWasteChart = dynamic(
  () =>
    import("@/components/team/charts/bench-waste-chart").then(
      (m) => m.BenchWasteChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 animate-pulse rounded-xl bg-muted/40" />
    ),
  },
);

type TeamStatsDashboardProps = {
  charts: TeamStatsChartsData;
};

export function TeamStatsDashboard({ charts }: TeamStatsDashboardProps) {
  return (
    <div className="flex flex-col gap-6">
      <TeamStatsMetricCards kpis={charts.kpis} />
      <div className="grid gap-6 md:grid-cols-2">
        <PointsByWeekChart
          data={charts.weeklyPoints}
          avgWeeklyScore={charts.kpis.avgWeeklyScore}
        />
        <PointsByPositionChart data={charts.positionMix} />
        <MatchupLuckChart data={charts.weeklyLuck} />
        <BenchWasteChart data={charts.benchWaste} />
      </div>
    </div>
  );
}
