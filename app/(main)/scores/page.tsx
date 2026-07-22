import type { Metadata } from "next";
import { Suspense } from "react";

import { LiveRefresh } from "@/components/scores/live-refresh";
import { ScheduleList } from "@/components/scores/schedule-list";
import { WeekFilter } from "@/components/scores/week-filter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import { getDefaultScheduleWeek } from "@/lib/nfl/schedule-week";
import { getNflState } from "@/lib/sleeper/api";

type NflScoresPageProps = {
  searchParams: Promise<{
    week?: string;
  }>;
};

function parseWeekParam(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const week = Number(raw);
  if (!Number.isFinite(week) || week < 1 || week > 18) {
    return null;
  }
  return week;
}

export const metadata: Metadata = {
  title: "NFL scores",
};

export default async function NflScoresPage({
  searchParams,
}: NflScoresPageProps) {
  const [params, state] = await Promise.all([searchParams, getNflState()]);
  const season = Number(state.season);
  const requestedWeek = parseWeekParam(params.week);

  let scoreboard: Awaited<ReturnType<typeof getNflScoreboard>> | null = null;
  let error: string | null = null;

  try {
    const bootstrap = await getNflScoreboard({
      season,
      week: requestedWeek ?? 1,
    });

    const defaultWeek = getDefaultScheduleWeek(bootstrap.weeks);
    const week =
      requestedWeek &&
      bootstrap.weeks.some((entry) => entry.number === requestedWeek)
        ? requestedWeek
        : defaultWeek;

    scoreboard =
      week === bootstrap.week
        ? bootstrap
        : await getNflScoreboard({ season, week });
  } catch (caught) {
    error =
      caught instanceof Error ? caught.message : "Failed to load NFL schedule";
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          NFL Scores
        </h1>
        {scoreboard ? (
          <Suspense
            fallback={
              <div className="flex h-8 shrink-0 items-center justify-end">
                <Spinner />
              </div>
            }
          >
            <WeekFilter
              weeks={scoreboard.weeks.map((week) => ({
                number: week.number,
                label: week.label,
                rangeLabel: week.rangeLabel,
              }))}
              value={scoreboard.week}
            />
          </Suspense>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t load schedule</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : scoreboard ? (
        <>
          <LiveRefresh enabled={scoreboard.hasLiveGames} />
          <ScheduleList games={scoreboard.games} week={scoreboard.week} />
        </>
      ) : null}
    </div>
  );
}
