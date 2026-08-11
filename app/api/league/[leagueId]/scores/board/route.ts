import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
  getLeagueBySlug,
  getLeagueMembership,
} from "@/lib/queries/leagues";
import { getLeagueMatchupBoardLivePatch } from "@/lib/queries/week-matchup-board-live";

type RouteContext = {
  params: Promise<{ leagueId: string }>;
};

/**
 * Slim matchup-board patch for live soft updates. Clients poll freshness,
 * then fetch this instead of `router.refresh()` when scores advance.
 */
export async function GET(request: Request, context: RouteContext) {
  const { leagueId: slug } = await context.params;
  const [user, league] = await Promise.all([
    getSessionUser(),
    getLeagueBySlug(slug),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  const membership = await getLeagueMembership(league.id, user.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const url = new URL(request.url);
  const weekRaw = url.searchParams.get("week");
  const yearRaw = url.searchParams.get("year");
  const week =
    weekRaw != null && weekRaw !== ""
      ? Number.parseInt(weekRaw, 10)
      : undefined;
  const year =
    yearRaw != null && yearRaw !== ""
      ? Number.parseInt(yearRaw, 10)
      : undefined;

  if (
    (week != null && (!Number.isFinite(week) || week < 1 || week > 30)) ||
    (year != null && (!Number.isFinite(year) || year < 2000 || year > 2100))
  ) {
    return NextResponse.json({ error: "Invalid week/year." }, { status: 400 });
  }

  const patch = await getLeagueMatchupBoardLivePatch({
    leagueSlug: slug,
    week,
    year,
  });

  if (!patch) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(patch, {
    headers: { "Cache-Control": "no-store" },
  });
}
