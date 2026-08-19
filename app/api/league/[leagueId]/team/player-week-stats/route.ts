import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import { parseWeekQueryParam } from "@/lib/leagues/matchup-week";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
} from "@/lib/queries/leagues";
import { loadPlayerWeekStatsForBreakdown } from "@/lib/roster-enrichment/load-player-week-stats";

type RouteContext = {
  params: Promise<{ leagueId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { leagueId: slug } = await context.params;
  const [user, league] = await Promise.all([
    getSessionUser(),
    getLeagueBySlug(slug),
  ]);

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!league) {
    return NextResponse.json({ ok: false, error: "League not found." }, { status: 404 });
  }

  const membership = await getLeagueMembership(league.id, user.id);
  if (!membership) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return NextResponse.json({ ok: false, error: "Season not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const playerId = url.searchParams.get("playerId")?.trim() ?? "";
  const fantasyWeek = parseWeekQueryParam(url.searchParams.get("week") ?? undefined);

  if (!playerId) {
    return NextResponse.json({ ok: false, error: "Missing playerId." }, { status: 400 });
  }
  if (fantasyWeek == null) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid week." },
      { status: 400 },
    );
  }

  const scoringRules = resolveScoringRuleDefinitions(
    season.scoringPreset as ScoringPreset,
    season.settings.scoringRules,
  );

  try {
    const stats = await loadPlayerWeekStatsForBreakdown({
      seasonYear: season.seasonYear,
      schedule: season.settings.schedule,
      fantasyWeek,
      playerId,
      scoringRules,
    });

    return NextResponse.json(
      { ok: true, stats },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Player week stats failed",
      },
      { status: 500 },
    );
  }
}
