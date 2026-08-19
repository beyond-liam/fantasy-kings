import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
} from "@/lib/queries/leagues";
import { getLeagueTeamById } from "@/lib/queries/team";
import { loadMyTeamNflContext } from "@/components/team/panels/load-my-team-nfl-context";
import { loadStatsOptionalEnrichment } from "@/lib/roster-enrichment/load-stats-optional-enrichment";

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
  if (!teamId) {
    return NextResponse.json({ ok: false, error: "Missing teamId." }, { status: 400 });
  }

  const team = await getLeagueTeamById(season.id, teamId);
  if (!team) {
    return NextResponse.json({ ok: false, error: "Team not found." }, { status: 404 });
  }

  const useChartsMock = url.searchParams.get("mock") === "1";
  const { fantasyWeek } = await loadMyTeamNflContext({
    seasonYear: season.seasonYear,
    schedule: season.settings.schedule,
  });

  const payload = await loadStatsOptionalEnrichment({
    slug,
    teamId: team.id,
    fantasyWeek,
    useChartsMock,
  });

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
