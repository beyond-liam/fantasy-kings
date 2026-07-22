import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
  getDraftBySeasonId,
  getDraftPickEventsAfter,
} from "@/lib/queries/draft";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
  isDraftUnderway,
} from "@/lib/queries/leagues";

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
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  const [membership, season] = await Promise.all([
    getLeagueMembership(league.id, user.id),
    getLeagueSeason(league.id),
  ]);

  if (!membership) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (!season) {
    return NextResponse.json({
      status: null,
      afterOverall: 0,
      picks: [],
    });
  }

  const draft = await getDraftBySeasonId(season.id);
  if (!draft || !isDraftUnderway(draft.status)) {
    return NextResponse.json({
      status: draft?.status ?? null,
      afterOverall: draft?.currentPickIndex ?? 0,
      picks: [],
    });
  }

  const url = new URL(request.url);
  const afterParam = Number(url.searchParams.get("after") ?? "0");
  const afterOverall = Number.isFinite(afterParam)
    ? Math.max(0, Math.floor(afterParam))
    : 0;

  const picks = await getDraftPickEventsAfter(draft.id, afterOverall);

  return NextResponse.json({
    status: draft.status,
    afterOverall: draft.currentPickIndex,
    picks,
  });
}
