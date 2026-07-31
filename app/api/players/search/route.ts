import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
  PLAYER_SEARCH_PAGE_SIZE,
  searchPlayersPage,
} from "@/lib/queries/player-search";
import { parseScoringPreset } from "@/lib/rankings/scoring-preset";
import { getNflState } from "@/lib/sleeper/api";

export async function GET(request: Request) {
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
  const scoringPreset = parseScoringPreset(url.searchParams.get("scoring"));

  const nfl = await getNflState();
  const result = await searchPlayersPage({
    season: url.searchParams.get("season") || nfl.season,
    query,
    offset: Number.isFinite(offset) ? offset : 0,
    limit: Number.isFinite(limit) ? limit : PLAYER_SEARCH_PAGE_SIZE,
    scoringPreset,
  });

  return NextResponse.json(result);
}
