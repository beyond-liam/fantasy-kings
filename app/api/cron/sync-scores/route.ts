import { NextResponse } from "next/server";

import { assertCronAuthorized } from "@/lib/cron/auth";
import { finalizeDueMatchupsAfterScoreSync } from "@/lib/leagues/matchups/finalize";
import { syncCurrentWeekScores } from "@/lib/scores/sync-sleeper-scores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Sleeper fetch + bulk upsert can exceed default serverless limits. */
export const maxDuration = 60;

async function handle(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const weekParam = url.searchParams.get("week");
  const week =
    weekParam != null && weekParam !== ""
      ? Number.parseInt(weekParam, 10)
      : undefined;
  if (week != null && (!Number.isFinite(week) || week < 1 || week > 18)) {
    return NextResponse.json(
      { ok: false, error: "Invalid week (expected 1–18)." },
      { status: 400 },
    );
  }

  const seasonParam = url.searchParams.get("season")?.trim();
  const season =
    seasonParam && /^\d{4}$/.test(seasonParam) ? seasonParam : undefined;
  if (seasonParam && !season) {
    return NextResponse.json(
      { ok: false, error: "Invalid season (expected YYYY)." },
      { status: 400 },
    );
  }

  const includeProjections =
    url.searchParams.get("projections") === "1" ||
    url.searchParams.get("projections") === "true";

  try {
    const result = await syncCurrentWeekScores({
      week,
      season,
      kinds: includeProjections ? ["stats", "projection"] : ["stats"],
    });

    let finalize: Awaited<
      ReturnType<typeof finalizeDueMatchupsAfterScoreSync>
    > | null = null;
    if (!result.skipped && result.upserted > 0) {
      finalize = await finalizeDueMatchupsAfterScoreSync({
        seasonYear: result.season,
        week: result.week,
      });
    }

    return NextResponse.json({ ...result, finalize });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Score sync failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * Near-live Sleeper stats → `player_scores`.
 * Vercel Cron (hourly) + cron-job.org every 2–5 min on game days.
 */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
