import type { Metadata } from "next";
import { Suspense } from "react";

import { RankingsTable } from "@/components/rankings/rankings-table";
import { parseDataTablePageSize } from "@/components/ui/data-table/page-size";
import { parsePositionFilter } from "@/lib/rankings/column-config";
import { parsePlayersPage } from "@/lib/rankings/players-page";
import {
  parseRequestedSort,
  resolvePlayersTableKind,
} from "@/lib/rankings/sort-params";
import { parseScoringPreset } from "@/lib/rankings/scoring-preset";
import {
  countingGamesHaveStarted,
  resolveTablePositionRanks,
} from "@/lib/rankings/table-rank-source";
import { resolvePlayerScorePoint } from "@/lib/leagues/schedule/player-score-point";
import { getNflState } from "@/lib/sleeper/api";

type RankingsPageProps = {
  searchParams: Promise<{
    season?: string;
    week?: string;
    kind?: string;
    position?: string;
    team?: string;
    rookies?: string;
    scoring?: string;
    sort?: string;
    sortDir?: string;
    page?: string;
    pageSize?: string;
    q?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Rankings",
};

export default async function RankingsPage({ searchParams }: RankingsPageProps) {
  const [params, state] = await Promise.all([searchParams, getNflState()]);

  const currentSeason = state.season;
  const previousSeason = state.previous_season;
  const weekParam = params.week ?? "season";
  const selectedWeek =
    weekParam === "season" || weekParam === "0" ? 0 : Number(weekParam);
  const statsPoint = resolvePlayerScorePoint({
    selectedWeek,
    kind: "stats",
    nfl: state,
    seasonYear: Number(params.season ?? currentSeason),
  });
  const seasonStarted = countingGamesHaveStarted(statsPoint);
  const kind = resolvePlayersTableKind(params.kind, seasonStarted);
  // Prior-year projections are not seeded; keep projection views on the
  // current NFL season so IDP/offense ranks are not empty after a stats browse.
  const season =
    kind === "projection"
      ? currentSeason
      : (params.season ?? currentSeason);
  const scorePoint = resolvePlayerScorePoint({
    selectedWeek,
    kind,
    nfl: state,
    seasonYear: Number(season),
  });
  const countingStatsPoint = resolvePlayerScorePoint({
    selectedWeek: 0,
    kind: "stats",
    nfl: state,
    seasonYear: Number(season),
  });
  const position = parsePositionFilter(params.position);
  const team = params.team ?? "ALL";
  const rookiesOnly = params.rookies === "1";
  const scoring = parseScoringPreset(params.scoring);
  const { sort, sortDesc } = parseRequestedSort(params.sort, params.sortDir);
  const page = parsePlayersPage(params.page);
  const pageSize = parseDataTablePageSize(params.pageSize);
  const search = params.q?.trim() || undefined;
  const seasons = Array.from(new Set([currentSeason, previousSeason]));

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        Rankings
      </h1>
      <Suspense fallback={null}>
        <RankingsTable
          currentSeason={currentSeason}
          previousSeason={previousSeason}
          seasons={seasons}
          season={season}
          week={scorePoint.week}
          weekParam={weekParam}
          kind={kind}
          seasonType={scorePoint.seasonType}
          positionRanks={resolveTablePositionRanks({
            kind,
            scorePoint,
            statsPoint: countingStatsPoint,
            isCurrentSeason: season === currentSeason,
          })}
          seasonStarted={seasonStarted}
          position={position}
          team={team}
          rookiesOnly={rookiesOnly}
          scoring={scoring}
          sort={sort}
          sortDesc={sortDesc}
          page={page}
          pageSize={pageSize}
          search={search}
        />
      </Suspense>
    </div>
  );
}
