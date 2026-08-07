import type { Metadata } from "next";
import { Suspense } from "react";

import { LiveRefresh } from "@/components/scores/live-refresh";
import { NflStandingsPanel } from "@/components/scores/nfl-standings-panel";
import { ScheduleList } from "@/components/scores/schedule-list";
import { WeekFilter } from "@/components/scores/week-filter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  calendarSeasonTypesForSchedule,
  DEFAULT_SCHEDULE_SETTINGS,
  filterScheduleWeeks,
  type ScheduleSettingsValues,
} from "@/lib/account/schedule-settings";
import { getSessionUser } from "@/lib/auth/session";
import {
  getNflScoreboard,
  type EspnSeasonType,
} from "@/lib/espn/scoreboard";
import { getNflStandings, type NflStandings } from "@/lib/espn/standings";
import { getDefaultScheduleWeekEntry } from "@/lib/nfl/schedule-week";
import { getProfileByUserId } from "@/lib/queries/profile";
import { getNflState } from "@/lib/sleeper/api";

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

async function getScheduleSettings(): Promise<ScheduleSettingsValues> {
  const user = await getSessionUser();
  if (!user) {
    return DEFAULT_SCHEDULE_SETTINGS;
  }
  const profile = await getProfileByUserId(user.id);
  if (!profile) {
    return DEFAULT_SCHEDULE_SETTINGS;
  }
  return {
    includePreseason:
      profile.includePreseason ?? DEFAULT_SCHEDULE_SETTINGS.includePreseason,
    preseasonStartWeek:
      profile.preseasonStartWeek ??
      DEFAULT_SCHEDULE_SETTINGS.preseasonStartWeek,
  };
}

export const metadata: Metadata = {
  title: "NFL scores",
};

export default async function NflScoresPage({
  searchParams,
}: NflScoresPageProps) {
  const [params, state, scheduleSettings] = await Promise.all([
    searchParams,
    getNflState(),
    getScheduleSettings(),
  ]);
  const season = Number(state.season);
  const requestedWeek = parseWeekParam(params.week);
  const requestedSeasonType = parseSeasonTypeParam(params.seasontype);
  const calendarSeasonTypes = calendarSeasonTypesForSchedule(scheduleSettings);

  let scoreboard: Awaited<ReturnType<typeof getNflScoreboard>> | null = null;
  let standings: NflStandings | null = null;
  let error: string | null = null;

  try {
    const bootstrapSeasonType =
      requestedSeasonType ??
      (scheduleSettings.includePreseason && state.season_type === "pre"
        ? 1
        : 2);
    const [bootstrap, standingsResult] = await Promise.all([
      getNflScoreboard({
        season,
        week: requestedWeek ?? 1,
        seasonType: bootstrapSeasonType,
        calendarSeasonTypes,
      }),
      getNflStandings(season).catch(() => null),
    ]);
    standings = standingsResult;

    const weeks = filterScheduleWeeks(bootstrap.weeks, scheduleSettings);
    const defaultWeek = getDefaultScheduleWeekEntry(weeks);
    const matched =
      requestedWeek != null
        ? weeks.find(
            (entry) =>
              entry.number === requestedWeek &&
              entry.seasonType === (requestedSeasonType ?? 2),
          )
        : undefined;

    const selected = matched ?? defaultWeek ?? weeks[0];
    const week = selected?.number ?? 1;
    const seasonType = selected?.seasonType ?? 2;

    const loaded =
      week === bootstrap.week && seasonType === bootstrap.seasonType
        ? bootstrap
        : await getNflScoreboard({
            season,
            week,
            seasonType,
            calendarSeasonTypes,
          });

    scoreboard = {
      ...loaded,
      weeks: filterScheduleWeeks(loaded.weeks, scheduleSettings),
    };
  } catch (caught) {
    error =
      caught instanceof Error ? caught.message : "Failed to load NFL schedule";
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        NFL Scores
      </h1>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t load schedule</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : scoreboard ? (
        <>
          <LiveRefresh enabled={scoreboard.hasLiveGames} />
          <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)] lg:items-start">
            <div className="order-1 flex min-h-8 items-center">
              <Suspense
                fallback={
                  <div className="flex h-8 items-center">
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
            </div>
            {standings ? (
              <h2 className="order-3 flex min-h-8 items-center text-sm font-medium text-muted-foreground lg:order-2">
                Standings
              </h2>
            ) : null}
            <div className="order-2 lg:order-3">
              <ScheduleList
                games={scoreboard.games}
                week={scoreboard.week}
                seasonType={scoreboard.seasonType}
              />
            </div>
            {standings ? (
              <div className="order-4">
                <NflStandingsPanel standings={standings} />
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
