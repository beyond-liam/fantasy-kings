import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
} from "@/lib/queries/leagues";
import { getLeagueTeamById } from "@/lib/queries/team";
import { loadRosterWeekDisplay } from "@/lib/roster-enrichment/load-roster-week-display";
import { parseWeekQueryParam } from "@/lib/leagues/matchup-week";

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
  const teamId = url.searchParams.get("teamId")?.trim() ?? "";
  const weekParam = url.searchParams.get("week");
  const currentWeekParam = url.searchParams.get("currentWeek");

  if (!teamId) {
    return NextResponse.json({ ok: false, error: "Missing teamId." }, { status: 400 });
  }

  const fantasyWeek = parseWeekQueryParam(weekParam ?? undefined);
  const currentWeek = parseWeekQueryParam(currentWeekParam ?? undefined);
  if (fantasyWeek == null || currentWeek == null) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid week parameters." },
      { status: 400 },
    );
  }

  const team = await getLeagueTeamById(season.id, teamId);
  if (!team) {
    return NextResponse.json({ ok: false, error: "Team not found." }, { status: 404 });
  }

  const scoringRules = resolveScoringRuleDefinitions(
    season.scoringPreset as ScoringPreset,
    season.settings.scoringRules,
  );

  const payload = await loadRosterWeekDisplay({
    teamId: team.id,
    leagueSeasonId: season.id,
    seasonYear: season.seasonYear,
    schedule: season.settings.schedule,
    transactionRules: season.settings.transactionRules,
    scoringRules,
    fantasyWeek,
    currentWeek,
  });

  if (!payload.ok) {
    return NextResponse.json(payload, { status: 500 });
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
