import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LiveRefresh } from "@/components/scores/live-refresh";
import { ScoresUpdatedLabel } from "@/components/scores/scores-updated-label";
import { WeekMatchupsList } from "@/components/leagues/matchups/week-matchups-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import {
  getFinalMatchupsForSeason,
  persistEnrichedMatchups,
  recordsFromFinalMatchups,
} from "@/lib/leagues/matchups/finalize";
import {
  parseWeekQueryParam,
  parseYearQueryParam,
  resolveFantasyMatchupWeek,
} from "@/lib/leagues/matchup-week";
import { resolveScoringRuleDefinitions } from "@/lib/leagues/scoring/rules";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";
import { getDefaultScheduleWeek } from "@/lib/nfl/schedule-week";
import {
  getLeagueHomeData,
  getLeagueSeasonByYear,
  getLeagueSeasonYears,
} from "@/lib/queries/leagues";
import { getWeekMatchups } from "@/lib/queries/matchups";
import { getPlayerScoresFreshness } from "@/lib/queries/score-freshness";
import { enrichWeekMatchupBoard } from "@/lib/queries/week-matchup-board";

type FantasyScoresPageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ week?: string; year?: string }>;
};

export const metadata: Metadata = {
  title: "Matchups",
};

export default async function FantasyScoresPage({
  params,
  searchParams,
}: FantasyScoresPageProps) {
  const [{ leagueId: slug }, query, user] = await Promise.all([
    params,
    searchParams,
    getSessionUser(),
  ]);

  if (!user) {
    redirect(`/login?next=/league/${slug}/scores`);
  }

  const data = await getLeagueHomeData(slug, user.id);
  if (!data || !data.isMember) {
    redirect("/leagues");
  }

  const years = await getLeagueSeasonYears(data.league.id);
  const requestedYear = parseYearQueryParam(query.year);
  const year =
    requestedYear != null && years.includes(requestedYear)
      ? requestedYear
      : (years[0] ?? data.season?.seasonYear);

  if (year == null) {
    redirect(`/league/${slug}`);
  }

  const season =
    data.season?.seasonYear === year
      ? data.season
      : await getLeagueSeasonByYear(data.league.id, year);

  if (!season) {
    redirect(`/league/${slug}`);
  }

  const requestedWeek = parseWeekQueryParam(query.week);
  let week = 1;
  let weeks: Awaited<ReturnType<typeof resolveFantasyMatchupWeek>>["weeks"] =
    [];
  let weekError: string | null = null;
  let rows: Awaited<ReturnType<typeof getWeekMatchups>> = [];
  let currentWeek = 1;
  let scoreboardGames: Awaited<
    ReturnType<typeof getNflScoreboard>
  >["games"] = [];
  let scoresUpdatedAt: string | null = null;

  try {
    const resolved = await resolveFantasyMatchupWeek({
      seasonYear: season.seasonYear,
      maxWeek: season.regularSeasonEndWeek,
      requestedWeek,
    });
    week = resolved.week;
    weeks = resolved.weeks;
    currentWeek = Math.min(
      getDefaultScheduleWeek(resolved.calendarWeeks),
      season.regularSeasonEndWeek,
    );

    const [matchups, scoreboard, freshness, finals] = await Promise.all([
      getWeekMatchups(season.id, week),
      getNflScoreboard({
        season: season.seasonYear,
        week,
      }).catch(() => null),
      getPlayerScoresFreshness({
        season: String(season.seasonYear),
        week,
        kind: "stats",
      }).catch(() => null),
      getFinalMatchupsForSeason(season.id).catch(() => []),
    ]);
    rows = matchups;
    scoreboardGames = scoreboard?.games ?? [];
    scoresUpdatedAt = freshness?.toISOString() ?? null;

    const scoringPreset = season.scoringPreset as ScoringPreset;
    const scoringRules = resolveScoringRuleDefinitions(
      scoringPreset,
      season.settings.scoringRules,
    );

    const recordsByTeamId = recordsFromFinalMatchups(finals);

    const games = await enrichWeekMatchupBoard({
      matchups: rows,
      week,
      currentWeek,
      seasonYear: String(season.seasonYear),
      scoringRules,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
      irEnabled: season.irEnabled,
      irSlots: season.irSlots,
      irEligibleStatuses: season.settings.irEligibleStatuses,
      taxiEnabled: season.taxiEnabled,
      taxiSlots: season.taxiSlots,
      scoreboardGames,
      recordsByTeamId,
    }).catch(() =>
      rows.map((row) => ({
        id: row.id,
        publicId: row.publicId,
        week: row.week,
        resultFinal: false,
        away: {
          teamId: row.awayTeamId,
          teamName: row.awayTeamName,
          teamSlug: row.awayTeamSlug,
          logoUrl: row.awayTeamLogoUrl,
          wins: 0,
          losses: 0,
          ties: 0,
          winChance: null,
          projectedPts: null,
          actualPts: null,
          isLoser: false,
        },
        home: {
          teamId: row.homeTeamId,
          teamName: row.homeTeamName,
          teamSlug: row.homeTeamSlug,
          logoUrl: row.homeTeamLogoUrl,
          wins: 0,
          losses: 0,
          ties: 0,
          winChance: null,
          projectedPts: null,
          actualPts: null,
          isLoser: false,
        },
      })),
    );

    if (games.length > 0 && week <= currentWeek) {
      await persistEnrichedMatchups(games).catch(() => null);
    }

    const myTeamSlug =
      data.members.find((member) => member.userId === user.id)?.teamPublicId ??
      null;

    const liveRefresh = week === currentWeek;

    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            Matchups
          </h1>
          <ScoresUpdatedLabel updatedAt={scoresUpdatedAt} />
        </div>

        {weekError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load NFL week calendar</AlertTitle>
            <AlertDescription>{weekError}</AlertDescription>
          </Alert>
        ) : null}

        <LiveRefresh enabled={liveRefresh} intervalMs={30_000} />

        <WeekMatchupsList
          games={games}
          week={week}
          weeks={weeks}
          year={year}
          years={years.length > 0 ? years : [year]}
          leagueSlug={slug}
          myTeamSlug={myTeamSlug}
        />
      </div>
    );
  } catch (caught) {
    weekError =
      caught instanceof Error
        ? caught.message
        : "Failed to resolve the current matchup week";
    week = requestedWeek ?? 1;
    currentWeek = week;
    weeks = Array.from({ length: season.regularSeasonEndWeek }, (_, index) => ({
      number: index + 1,
      label: `Week ${index + 1}`,
      rangeLabel: "",
    }));
    rows = await getWeekMatchups(season.id, week).catch(() => []);
  }

  // Fallback path when week calendar failed — still render board with defaults.
  const scoringPreset = season.scoringPreset as ScoringPreset;
  const scoringRules = resolveScoringRuleDefinitions(
    scoringPreset,
    season.settings.scoringRules,
  );

  const finals = await getFinalMatchupsForSeason(season.id).catch(() => []);
  const recordsByTeamId = recordsFromFinalMatchups(finals);

  const games = await enrichWeekMatchupBoard({
    matchups: rows,
    week,
    currentWeek,
    seasonYear: String(season.seasonYear),
    scoringRules,
    rosterSlots: season.settings.rosterSlots,
    benchSlots: season.benchSlots,
    irEnabled: season.irEnabled,
    irSlots: season.irSlots,
    irEligibleStatuses: season.settings.irEligibleStatuses,
    taxiEnabled: season.taxiEnabled,
    taxiSlots: season.taxiSlots,
    scoreboardGames,
    recordsByTeamId,
  }).catch(() =>
    rows.map((row) => ({
      id: row.id,
      publicId: row.publicId,
      week: row.week,
      resultFinal: false,
      away: {
        teamId: row.awayTeamId,
        teamName: row.awayTeamName,
        teamSlug: row.awayTeamSlug,
        logoUrl: row.awayTeamLogoUrl,
        wins: 0,
        losses: 0,
        ties: 0,
        winChance: null,
        projectedPts: null,
        actualPts: null,
        isLoser: false,
      },
      home: {
        teamId: row.homeTeamId,
        teamName: row.homeTeamName,
        teamSlug: row.homeTeamSlug,
        logoUrl: row.homeTeamLogoUrl,
        wins: 0,
        losses: 0,
        ties: 0,
        winChance: null,
        projectedPts: null,
        actualPts: null,
        isLoser: false,
      },
    })),
  );

  if (games.length > 0 && week <= currentWeek) {
    await persistEnrichedMatchups(games).catch(() => null);
  }

  const myTeamSlug =
    data.members.find((member) => member.userId === user.id)?.teamPublicId ??
    null;

  const liveRefresh = week === currentWeek;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Matchups
        </h1>
        <ScoresUpdatedLabel updatedAt={scoresUpdatedAt} />
      </div>

      {weekError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load NFL week calendar</AlertTitle>
          <AlertDescription>{weekError}</AlertDescription>
        </Alert>
      ) : null}

      <LiveRefresh enabled={liveRefresh} intervalMs={30_000} />

      <WeekMatchupsList
        games={games}
        week={week}
        weeks={weeks}
        year={year}
        years={years.length > 0 ? years : [year]}
        leagueSlug={slug}
        myTeamSlug={myTeamSlug}
      />
    </div>
  );
}
