"use client";

import { useEffect, useState } from "react";

import { TeamStatsSections } from "@/components/team/stats-sections";
import type { RankedPlayerRow } from "@/lib/queries/players";
import type { StatsOptionalEnrichmentPayload } from "@/lib/roster-enrichment/types";
import type {
  RosterEvaluationData,
  RosterEvaluationMode,
} from "@/lib/leagues/roster-evaluation/types";
import type { TeamStatsChartsData } from "@/lib/queries/team-stats-charts";

type StatsChartsHydratorProps = {
  players: RankedPlayerRow[];
  chartsUrl: string;
  leagueSlug: string;
  upcomingWeek: number;
};

export function StatsChartsHydrator({
  players,
  chartsUrl,
  leagueSlug,
  upcomingWeek,
}: StatsChartsHydratorProps) {
  const [charts, setCharts] = useState<TeamStatsChartsData | null>(null);
  const [rosterEvaluationByMode, setRosterEvaluationByMode] = useState<Record<
    RosterEvaluationMode,
    RosterEvaluationData
  > | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(chartsUrl, { cache: "no-store" })
      .then(
        async (response) =>
          response.json() as Promise<StatsOptionalEnrichmentPayload>,
      )
      .then((payload) => {
        if (cancelled) return;
        if (!payload.ok) {
          console.warn(
            `[StatsChartsHydrator] charts unavailable: ${payload.error}`,
          );
          return;
        }
        setCharts(payload.charts);
        setRosterEvaluationByMode(payload.rosterEvaluationByMode);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[StatsChartsHydrator] charts fetch failed: ${message}`);
      });

    return () => {
      cancelled = true;
    };
  }, [chartsUrl]);

  return (
    <TeamStatsSections
      players={players}
      leagueSlug={leagueSlug}
      charts={charts}
      upcomingWeek={upcomingWeek}
      rosterEvaluationByMode={rosterEvaluationByMode}
    />
  );
}
