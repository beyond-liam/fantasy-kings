import type { Metadata } from "next";
import { Suspense } from "react";

import { RankingsTable } from "@/components/rankings/rankings-table";
import { parsePositionFilter } from "@/lib/rankings/column-config";
import {
  DEFAULT_SORT_COLUMN,
  DEFAULT_SORT_DESC,
} from "@/lib/rankings/sort-params";
import { parseScoringPreset } from "@/lib/rankings/scoring-preset";
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
  }>;
};

export const metadata: Metadata = {
  title: "Rankings",
};

export default async function RankingsPage({ searchParams }: RankingsPageProps) {
  const [params, state] = await Promise.all([searchParams, getNflState()]);

  const currentSeason = state.season;
  const previousSeason = state.previous_season;
  const kind =
    params.kind === "stats" ? ("stats" as const) : ("projection" as const);
  const defaultSeason = kind === "stats" ? previousSeason : currentSeason;

  const season = params.season ?? defaultSeason;
  const weekParam = params.week ?? "season";
  const week =
    weekParam === "season" || weekParam === "0" ? 0 : Number(weekParam);
  const position = parsePositionFilter(params.position);
  const team = params.team ?? "ALL";
  const rookiesOnly = params.rookies === "1";
  const scoring = parseScoringPreset(params.scoring);
  const sort =
    params.sort === "pts_ppr" ? DEFAULT_SORT_COLUMN : (params.sort ?? DEFAULT_SORT_COLUMN);
  const sortDesc = params.sortDir ? params.sortDir !== "asc" : DEFAULT_SORT_DESC;
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
          week={week}
          weekParam={weekParam}
          kind={kind}
          position={position}
          team={team}
          rookiesOnly={rookiesOnly}
          scoring={scoring}
          sort={sort}
          sortDesc={sortDesc}
        />
      </Suspense>
    </div>
  );
}
