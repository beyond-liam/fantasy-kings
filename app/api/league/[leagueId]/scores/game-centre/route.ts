import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
  getLeagueBySlug,
  getLeagueMembership,
} from "@/lib/queries/leagues";
import { getGameCentreLivePatch } from "@/lib/queries/game-centre-live";

type RouteContext = {
  params: Promise<{ leagueId: string }>;
};

/**
 * Slim Game Centre patch for live soft updates. Clients poll freshness,
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
  const matchup = url.searchParams.get("matchup")?.trim() ?? "";
  if (!matchup) {
    return NextResponse.json({ error: "Missing matchup." }, { status: 400 });
  }

  const patch = await getGameCentreLivePatch({
    matchupId: matchup,
    leagueSlug: slug,
    userId: user.id,
  });

  if (!patch) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(patch, {
    headers: { "Cache-Control": "no-store" },
  });
}
