import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { getPlayerScoresFreshness } from "@/lib/queries/score-freshness";

/**
 * Tiny freshness probe for live score pages. Clients poll this and only
 * `router.refresh()` when `updatedAt` advances — avoids reloading board /
 * Game Centre trees every interval while scores are unchanged.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const season = url.searchParams.get("season")?.trim() ?? "";
  const weekRaw = url.searchParams.get("week");
  const week = weekRaw != null ? Number.parseInt(weekRaw, 10) : NaN;
  const kindParam = url.searchParams.get("kind");
  const kind =
    kindParam === "projection" || kindParam === "stats" ? kindParam : "stats";
  const seasonType = url.searchParams.get("seasonType")?.trim() || "regular";

  if (!/^\d{4}$/.test(season) || !Number.isFinite(week) || week < 1 || week > 22) {
    return NextResponse.json(
      { error: "Invalid season/week." },
      { status: 400 },
    );
  }

  const updatedAt = await getPlayerScoresFreshness({
    season,
    week,
    kind,
    seasonType,
  });

  return NextResponse.json(
    { updatedAt: updatedAt?.toISOString() ?? null },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
