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
import { serializePositionalSosTable } from "@/lib/players/serialize-positional-sos";
import { loadPositionalSosForRoster } from "@/lib/roster-enrichment/load-positional-sos-for-roster";

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
  const positionsParam = url.searchParams.get("positions")?.trim() ?? "";
  const positionIds = positionsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (positionIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing positions." },
      { status: 400 },
    );
  }

  const scoringRules = resolveScoringRuleDefinitions(
    season.scoringPreset as ScoringPreset,
    season.settings.scoringRules,
  );

  try {
    const table = await loadPositionalSosForRoster({
      seasonYear: season.seasonYear,
      positionIds,
      scoringRules,
    });

    return NextResponse.json(
      { ok: true, table: serializePositionalSosTable(table) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Positional SOS load failed",
      },
      { status: 500 },
    );
  }
}
