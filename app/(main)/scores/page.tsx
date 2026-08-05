import type { Metadata } from "next";
import { Suspense } from "react";

import { LiveRefresh } from "@/components/scores/live-refresh";
import { ScheduleList } from "@/components/scores/schedule-list";
import { WeekFilter } from "@/components/scores/week-filter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  getNflScoreboard,
  type EspnSeasonType,
} from "@/lib/espn/scoreboard";
import { getDefaultScheduleWeekEntry } from "@/lib/nfl/schedule-week";
import { getNflState } from "@/lib/sleeper/api";

const NFL_SCORES_CALENDAR: EspnSeasonType[] = [1, 2];

type NflScoresPageProps = {
  searchParams: Promise<{
    week?: string;
    seasontype?: string;
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

function parseSeasonTypeParam(raw: string | undefined): EspnSeasonType | null {
  if (!raw) {
    return null;
  }
  const seasonType = Number(raw);
  if (seasonType === 1 || seasonType === 2) {
    return seasonType;
  }
  return null;
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
  const requestedSeasonType = parseSeasonTypeParam(params.seasontype);

  let scoreboard: Awaited<ReturnType<typeof getNflScoreboard>> | null = null;
  let error: string | null = null;

  try {
    const bootstrapSeasonType =
      requestedSeasonType ?? (state.season_type === "pre" ? 1 : 2);
    const bootstrap = await getNflScoreboard({
      season,
      week: requestedWeek ?? 1,
      seasonType: bootstrapSeasonType,
      calendarSeasonTypes: NFL_SCORES_CALENDAR,
    });

    const defaultWeek = getDefaultScheduleWeekEntry(bootstrap.weeks);
    const matched =
      requestedWeek != null
        ? bootstrap.weeks.find(
            (entry) =>
              entry.number === requestedWeek &&
              entry.seasonType === (requestedSeasonType ?? 2),
          )
        : undefined;

    const selected = matched ?? defaultWeek ?? bootstrap.weeks[0];
    const week = selected?.number ?? 1;
    const seasonType = selected?.seasonType ?? 2;

    scoreboard =
      week === bootstrap.week && seasonType === bootstrap.seasonType
        ? bootstrap
        : await getNflScoreboard({
            season,
            week,
            seasonType,
            calendarSeasonTypes: NFL_SCORES_CALENDAR,
          });
  } catch (caught) {
    error =
      caught instanceof Error ? caught.message : "Failed to load NFL schedule";
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          NFL Scores
        </h1>
        {scoreboard ? (
          <Suspense
            fallback={
              <div className="flex h-8 shrink-0 items-center md:justify-end">
                <Spinner />
              </div>
            }
          >
            <WeekFilter
              weeks={scoreboard.weeks.map((week) => ({
                number: week.number,
                seasonType: week.seasonType,
                label: week.label,
                rangeLabel: week.rangeLabel,
              }))}
              value={scoreboard.week}
              seasonType={scoreboard.seasonType}
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
          <ScheduleList
            games={scoreboard.games}
            week={scoreboard.week}
            seasonType={scoreboard.seasonType}
          />
        </>
      ) : null}
    </div>
  );
}
