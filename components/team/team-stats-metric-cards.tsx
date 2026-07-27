"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPoints } from "@/lib/leagues/standings";
import type {
  ConsistencyAverageMetric,
  ConsistencyRating,
  SimpleAverageMetric,
  TeamStatsKpis,
} from "@/lib/leagues/team-stats-charts";

function formatSignedPoints(value: number) {
  const body = formatPoints(Math.abs(value));
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

function consistencyLabel(rating: ConsistencyRating) {
  switch (rating) {
    case "excellent":
      return "excellent consistency";
    case "good":
      return "good consistency";
    case "fair":
      return "fair consistency";
    case "poor":
      return "poor consistency";
  }
}

function AverageValue({
  metric,
  signed,
}: {
  metric: SimpleAverageMetric;
  signed?: boolean;
}) {
  if (metric.average == null) {
    return (
      <p className="text-3xl font-semibold tracking-tight text-muted-foreground">
        —
      </p>
    );
  }

  return (
    <p className="text-3xl font-semibold tracking-tight">
      {signed
        ? formatSignedPoints(metric.average)
        : formatPoints(metric.average)}
    </p>
  );
}

function ConsistencyValue({ metric }: { metric: ConsistencyAverageMetric }) {
  if (
    metric.consistencyPlusMinus == null ||
    metric.consistency == null
  ) {
    return (
      <p className="text-3xl font-semibold tracking-tight text-muted-foreground">
        —
      </p>
    );
  }

  return (
    <p className="text-3xl font-semibold text-balance">
      <span>+/- {formatPoints(metric.consistencyPlusMinus)}</span>
      <span className="ml-2 text-sm font-normal text-muted-foreground">
        {consistencyLabel(metric.consistency)}
      </span>
    </p>
  );
}

type MetricCardProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

function MetricCard({ title, description, children }: MetricCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

type TeamStatsMetricCardsProps = {
  kpis: TeamStatsKpis;
};

export function TeamStatsMetricCards({ kpis }: TeamStatsMetricCardsProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        title="Average Win Margin"
        description="How much you typically win by."
      >
        <AverageValue metric={kpis.avgWinMargin} signed />
      </MetricCard>
      <MetricCard
        title="Average Loss Margin"
        description="How much you typically lose by."
      >
        <AverageValue metric={kpis.avgLossMargin} signed />
      </MetricCard>
      <MetricCard
        title="Scoring Consistency"
        description="How steady your weekly scoring is."
      >
        <ConsistencyValue metric={kpis.avgWeeklyScore} />
      </MetricCard>
    </div>
  );
}
