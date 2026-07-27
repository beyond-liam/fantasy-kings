import { NextResponse } from "next/server";

import { assertCronAuthorized } from "@/lib/cron/auth";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import { finalizeDueMatchupsAfterScoreSync } from "@/lib/leagues/matchups/finalize";
import { shouldFinalizeAfterSync } from "@/lib/leagues/matchups/finalize-gates";
import { syncEspnLiveScores } from "@/lib/scores/sync-espn-scores";
import { shouldAutoRunNflverse } from "@/lib/scores/nflverse-run-gate";
import { syncNflverseWeekScores } from "@/lib/scores/sync-nflverse-scores";
import { syncCurrentWeekScores } from "@/lib/scores/sync-sleeper-scores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Sleeper + ESPN + nflverse fetch + bulk upsert can exceed default limits. */
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

  // Default on: merge ESPN boxscores after Sleeper for live/final games.
  const espnParam = url.searchParams.get("espn");
  const includeEspn =
    espnParam !== "0" &&
    espnParam !== "false" &&
    espnParam !== "off";

  // Default on for completed weeks (no live games): official nflverse replace.
  // Pass nflverse=0 to skip; nflverse=1 to force even during live games.
  const nflverseParam = url.searchParams.get("nflverse");
  const forceNflverse =
    nflverseParam === "1" ||
    nflverseParam === "true" ||
    nflverseParam === "on";
  const skipNflverse =
    nflverseParam === "0" ||
    nflverseParam === "false" ||
    nflverseParam === "off";

  try {
    const sleeper = await syncCurrentWeekScores({
      week,
      season,
      kinds: includeProjections ? ["stats", "projection"] : ["stats"],
    });

    const espn =
      includeEspn && !sleeper.skipped
        ? await syncEspnLiveScores({
            week: sleeper.week,
            season: sleeper.season,
          })
        : null;

    let nflverse: Awaited<ReturnType<typeof syncNflverseWeekScores>> | null =
      null;
    if (!sleeper.skipped && !skipNflverse) {
      let shouldRun = forceNflverse;
      if (!shouldRun) {
        const seasonYear = Number.parseInt(sleeper.season, 10);
        if (Number.isFinite(seasonYear)) {
          const board = await getNflScoreboard({
            season: seasonYear,
            week: sleeper.week,
          }).catch(() => null);
          const scoreboardOk = board !== null;
          const games = board?.games ?? [];
          shouldRun = shouldAutoRunNflverse({
            force: forceNflverse,
            scoreboardOk,
            games,
          });
        }
      }
      if (shouldRun) {
        nflverse = await syncNflverseWeekScores({
          week: sleeper.week,
          season: sleeper.season,
        });
      }
    }

    const upserted =
      sleeper.upserted +
      (espn && !espn.skipped ? espn.upserted : 0) +
      (nflverse && !nflverse.skipped ? nflverse.upserted : 0);

    let finalize: Awaited<
      ReturnType<typeof finalizeDueMatchupsAfterScoreSync>
    > | null = null;
    if (
      shouldFinalizeAfterSync({
        sleeperSkipped: sleeper.skipped,
        upserted,
      })
    ) {
      finalize = await finalizeDueMatchupsAfterScoreSync({
        seasonYear: sleeper.season,
        week: sleeper.week,
      });
    }

    return NextResponse.json({ ...sleeper, espn, nflverse, finalize });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Score sync failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * Near-live Sleeper (+ ESPN boxscores) and post-week nflverse official stats
 * → `player_scores`. Vercel Cron + cron-job.org on game days.
 */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
