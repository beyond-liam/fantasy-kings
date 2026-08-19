import "server-only";

import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { getRosterEvaluationByModeMock } from "@/lib/leagues/roster-evaluation/mock";
import { getTeamStatsChartsMock } from "@/lib/leagues/team-stats-charts-mock";
import { getRosterEvaluationByMode } from "@/lib/queries/roster-evaluation";
import { getTeamStatsCharts } from "@/lib/queries/team-stats-charts";
import type { StatsOptionalEnrichmentPayload } from "@/lib/roster-enrichment/types";
import { ROSTER_ENRICHMENT_VERSION } from "@/lib/roster-enrichment/types";

export type LoadStatsOptionalEnrichmentInput = {
  slug: string;
  teamId: string;
  fantasyWeek: number;
  useChartsMock: boolean;
};

function warnSubqueryFailure(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[loadStatsOptionalEnrichment] ${scope} failed: ${message}`);
}

/** Charts and roster evaluation — deferred from the stats tab initial render. */
export async function loadStatsOptionalEnrichment(
  input: LoadStatsOptionalEnrichmentInput,
): Promise<StatsOptionalEnrichmentPayload> {
  const { slug, teamId, fantasyWeek, useChartsMock } = input;

  try {
    const [charts, rosterEvaluationByMode] = await Promise.all([
      useChartsMock
        ? Promise.resolve(getTeamStatsChartsMock())
        : getTeamStatsCharts({
            leagueSlug: slug,
            teamId,
          }).catch((error) => {
            warnSubqueryFailure("team stats charts", error);
            return null;
          }),
      useChartsMock
        ? Promise.resolve(getRosterEvaluationByModeMock())
        : getRosterEvaluationByMode({
            leagueSlug: slug,
            teamId,
            upcomingWeek: fantasyWeek,
          }).catch((error) => {
            warnSubqueryFailure("roster evaluation", error);
            return null;
          }),
    ]);

    return {
      ok: true,
      version: ROSTER_ENRICHMENT_VERSION,
      charts,
      rosterEvaluationByMode,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Stats optional enrichment failed",
    };
  }
}
