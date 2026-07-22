import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { LeaguePlayersTable } from "@/components/leagues/players/league-players-table";
import { getSessionUser } from "@/lib/auth/session";
import {
  resolveScoringRuleDefinitions,
} from "@/lib/leagues/scoring";
import type { ScoringPreset } from "@/lib/leagues/scoring";
import { parsePositionFilter } from "@/lib/rankings/column-config";
import {
  DEFAULT_SORT_COLUMN,
  DEFAULT_SORT_DESC,
} from "@/lib/rankings/sort-params";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
} from "@/lib/queries/leagues";
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
  const kind =
    query.kind === "stats" ? ("stats" as const) : ("projection" as const);
  const defaultSeason = kind === "stats" ? previousSeason : currentSeason;

  const seasonYear = query.season ?? defaultSeason;
  const weekParam = query.week ?? "season";
  const week =
    weekParam === "season" || weekParam === "0" ? 0 : Number(weekParam);
  const position = parsePositionFilter(query.position);
  const team = query.team ?? "ALL";
  const rookiesOnly = query.rookies === "1";
  const freeAgentsOnly = query.fa !== "0";
  const sort =
    query.sort === "pts_ppr"
      ? DEFAULT_SORT_COLUMN
      : (query.sort ?? DEFAULT_SORT_COLUMN);
  const sortDesc = query.sortDir ? query.sortDir !== "asc" : DEFAULT_SORT_DESC;

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
          team={team}
          rookiesOnly={rookiesOnly}
          freeAgentsOnly={freeAgentsOnly}
          scoringPreset={scoringPreset}
          scoringRules={scoringRules}
          sort={sort}
          sortDesc={sortDesc}
          currentSeason={currentSeason}
          previousSeason={previousSeason}
          waiversEnabled={season.waiversEnabled}
          tradesEnabled={season.tradesEnabled}
          seasonSettings={season.settings}
          nflState={state}
        />
      </Suspense>
    </div>
  );
}
