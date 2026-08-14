import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { LeaguePlayersTable } from "@/components/leagues/players/league-players-table";
import { parseDataTablePageSize } from "@/components/ui/data-table/page-size";
import { getSessionUser } from "@/lib/auth/session";
import {
  resolveScoringRuleDefinitions,
} from "@/lib/leagues/scoring";
import type { ScoringPreset } from "@/lib/leagues/scoring";
import {
  parsePositionFilter,
  positionFiltersFromRosterSlots,
} from "@/lib/rankings/column-config";
import { parsePlayersPage } from "@/lib/rankings/players-page";
import {
  parseRequestedSort,
  resolvePlayersTableKind,
} from "@/lib/rankings/sort-params";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
} from "@/lib/queries/leagues";
import { resolvePlayerScorePoint } from "@/lib/leagues/schedule/player-score-point";
import { countingGamesHaveStarted } from "@/lib/rankings/table-rank-source";
import { getNflState } from "@/lib/sleeper/api";

type LeaguePlayersPageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{
    season?: string;
    week?: string;
    kind?: string;
    position?: string;
    team?: string;
    rookies?: string;
    fa?: string;
    sort?: string;
    sortDir?: string;
    page?: string;
    pageSize?: string;
    q?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Players",
};

export default async function LeaguePlayersPage({
  params,
  searchParams,
}: LeaguePlayersPageProps) {
  const [{ leagueId: slug }, query, user] = await Promise.all([
    params,
    searchParams,
    getSessionUser(),
  ]);

  if (!user) {
    redirect(`/login?next=/league/${slug}/players`);
  }

  const [league, state] = await Promise.all([
    getLeagueBySlug(slug),
    getNflState(),
  ]);

  if (!league) {
    redirect("/leagues");
  }

  const [membership, season] = await Promise.all([
    getLeagueMembership(league.id, user.id),
    getLeagueSeason(league.id),
  ]);

  if (!membership) {
    redirect("/leagues");
  }

  if (!season) {
    redirect(`/league/${slug}`);
  }

  const currentSeason = state.season;
  const previousSeason = state.previous_season;
  const seasonYear = query.season ?? currentSeason;
  const weekParam = query.week ?? "season";
  const week =
    weekParam === "season" || weekParam === "0" ? 0 : Number(weekParam);
  const statsPoint = resolvePlayerScorePoint({
    selectedWeek: week,
    kind: "stats",
    nfl: state,
    schedule: season.settings.schedule,
    seasonYear: Number(seasonYear),
  });
  const seasonStarted = countingGamesHaveStarted(statsPoint);
  const kind = resolvePlayersTableKind(query.kind, seasonStarted);
  const positionOptions = positionFiltersFromRosterSlots(
    season.settings.rosterSlots,
  );
  const position = parsePositionFilter(query.position, positionOptions);
  const team = query.team ?? "ALL";
  const rookiesOnly = query.rookies === "1";
  const freeAgentsOnly = query.fa !== "0";
  const { sort, sortDesc } = parseRequestedSort(query.sort, query.sortDir);
  const page = parsePlayersPage(query.page);
  const pageSize = parseDataTablePageSize(query.pageSize);
  const search = query.q?.trim() || undefined;

  const scoringPreset = season.scoringPreset as ScoringPreset;
  const scoringRules = resolveScoringRuleDefinitions(
    scoringPreset,
    season.settings.scoringRules,
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        Players
      </h1>

      <Suspense fallback={null}>
        <LeaguePlayersTable
          slug={slug}
          userId={user.id}
          seasonId={season.id}
          seasonStatus={season.status}
          freeAgencyOpen={season.freeAgencyOpen}
          seasonYear={seasonYear}
          week={week}
          weekParam={weekParam}
          kind={kind}
          position={position}
          positions={positionOptions}
          team={team}
          rookiesOnly={rookiesOnly}
          freeAgentsOnly={freeAgentsOnly}
          scoringPreset={scoringPreset}
          scoringRules={scoringRules}
          sort={sort}
          sortDesc={sortDesc}
          page={page}
          pageSize={pageSize}
          search={search}
          currentSeason={currentSeason}
          previousSeason={previousSeason}
          waiversEnabled={season.waiversEnabled}
          tradesEnabled={season.tradesEnabled}
          seasonSettings={season.settings}
          benchSlots={season.benchSlots}
          isCommissioner={
            membership.role === "commissioner" ||
            membership.role === "co_commissioner"
          }
          nflState={state}
        />
      </Suspense>
    </div>
  );
}
