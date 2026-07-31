import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
  getLeagueBySlug,
  getLeagueMembership,
} from "@/lib/queries/leagues";
import { getLeaguePresence } from "@/lib/queries/presence";

type RouteContext = {
  params: Promise<{ leagueId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
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

  const presence = await getLeaguePresence(league.id);
  return NextResponse.json(presence);
}
