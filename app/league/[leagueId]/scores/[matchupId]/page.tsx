import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";

import { GameCentre } from "@/components/leagues/game-centre/game-centre";
import { LiveRefresh } from "@/components/scores/live-refresh";
import { ScoresUpdatedLabel } from "@/components/scores/scores-updated-label";
import { Spinner } from "@/components/ui/spinner";
import { getSessionUser } from "@/lib/auth/session";
import { getDefaultScheduleWeek } from "@/lib/nfl/schedule-week";
import { resolveFantasyMatchupWeek } from "@/lib/leagues/matchup-week";
import { getGameCentreData } from "@/lib/queries/game-centre";
import { getPlayerScoresFreshness } from "@/lib/queries/score-freshness";

type MatchupPageProps = {
  params: Promise<{ leagueId: string; matchupId: string }>;
};

export const metadata: Metadata = {
  title: "Matchup",
};

export default async function MatchupPage({ params }: MatchupPageProps) {
  const [{ leagueId: slug, matchupId }, user] = await Promise.all([
    params,
    getSessionUser(),
  ]);

  if (!user) {
    redirect(`/login?next=/league/${slug}/scores/${matchupId}`);
  }

  const data = await getGameCentreData({
    matchupId,
    leagueSlug: slug,
    userId: user.id,
  });

  if (!data) {
    notFound();
  }

  const [freshness, resolved] = await Promise.all([
    getPlayerScoresFreshness({
      season: String(data.seasonYear),
      week: data.week,
      kind: "stats",
    }).catch(() => null),
    resolveFantasyMatchupWeek({
      seasonYear: data.seasonYear,
      maxWeek: 18,
    }).catch(() => null),
  ]);

  const currentWeek = resolved
    ? getDefaultScheduleWeek(resolved.calendarWeeks)
    : data.week;
  const liveRefresh = data.week === currentWeek;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            Game Centre
          </h1>
          <p className="text-sm text-pretty text-muted-foreground">
            Week {data.week} · {data.away.teamName} vs {data.home.teamName}
          </p>
        </div>
        <ScoresUpdatedLabel
          updatedAt={freshness?.toISOString() ?? null}
        />
      </div>

      <LiveRefresh enabled={liveRefresh} intervalMs={30_000} />

      <Suspense fallback={<Spinner />}>
        <GameCentre data={data} />
      </Suspense>
    </div>
  );
}
