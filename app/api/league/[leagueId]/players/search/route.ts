import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
  PLAYER_SEARCH_PAGE_SIZE,
  searchLeaguePlayersPage,
} from "@/lib/queries/player-search";

type RouteContext = {
  params: Promise<{ leagueId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { leagueId: slug } = await context.params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? undefined;
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number(
    url.searchParams.get("limit") ?? String(PLAYER_SEARCH_PAGE_SIZE),
  );

  const result = await searchLeaguePlayersPage({
    slug,
    userId: user.id,
    query,
    offset: Number.isFinite(offset) ? offset : 0,
    limit: Number.isFinite(limit) ? limit : PLAYER_SEARCH_PAGE_SIZE,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    players: result.players,
    offset: result.offset,
    limit: result.limit,
    total: result.total,
    hasMore: result.hasMore,
    kind: result.kind,
    actionsEnabled: result.actionsEnabled,
    tradesEnabled: result.tradesEnabled,
  });
}
