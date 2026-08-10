import { PlayersDataTable } from "@/components/rankings/players-data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getNflTeams, getRankedPlayers } from "@/lib/queries/players";
import type { PositionFilter } from "@/lib/rankings/column-config";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";
import {
  PLAYERS_PAGE_SIZE,
  playersPageOffset,
} from "@/lib/rankings/players-page";

type RankingsTableProps = {
  currentSeason: string;
  previousSeason: string;
  seasons: string[];
  season: string;
  week: number;
  weekParam: string;
  kind: "projection" | "stats";
  position: PositionFilter;
  team: string;
  rookiesOnly: boolean;
  scoring: ScoringPreset;
  sort: string;
  sortDesc: boolean;
  page: number;
  search?: string;
};

/** Fetches ranked players inside Suspense so the page shell can stream first. */
export async function RankingsTable({
  currentSeason,
  previousSeason,
  seasons,
  season,
  week,
  weekParam,
  kind,
  position,
  team,
  rookiesOnly,
  scoring,
  sort,
  sortDesc,
  page,
  search,
}: RankingsTableProps) {
  const offset = playersPageOffset(page);
  // Fetch one extra row to detect whether another page exists without a count query.
  const fetchLimit = PLAYERS_PAGE_SIZE + 1;

  const [playersResult, teams] = await Promise.all([
    getRankedPlayers({
      season,
      week,
      kind,
      scoringPreset: scoring,
      position,
      team: team !== "ALL" ? team : undefined,
      rookiesOnly: rookiesOnly || undefined,
      search,
      sort,
      sortDesc,
      limit: fetchLimit,
      offset,
    }).then(
      (rows) => ({ ok: true as const, rows }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
    getNflTeams(),
  ]);

  if (!playersResult.ok) {
    const message =
      playersResult.error instanceof Error
        ? playersResult.error.message
        : "Database error";
    const setupError =
      message.includes("player_scores") || message.includes("does not exist")
        ? "Score data is not set up yet. Run: pnpm db:push && pnpm db:seed:scores"
        : message;

    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load rankings</AlertTitle>
        <AlertDescription>{setupError}</AlertDescription>
      </Alert>
    );
  }

  const hasNext = playersResult.rows.length > PLAYERS_PAGE_SIZE;
  const pageRows = hasNext
    ? playersResult.rows.slice(0, PLAYERS_PAGE_SIZE)
    : playersResult.rows;
  // Approximate total for pagination UI (exact only when on last page).
  const totalCount = hasNext
    ? offset + PLAYERS_PAGE_SIZE + 1
    : offset + pageRows.length;

  return (
    <PlayersDataTable
      currentSeason={currentSeason}
      data={pageRows}
      previousSeason={previousSeason}
      seasons={seasons}
      teams={teams}
      page={page}
      pageSize={PLAYERS_PAGE_SIZE}
      totalCount={totalCount}
      view={{
        season,
        week: weekParam,
        kind,
        position,
        team,
        rookiesOnly,
        freeAgentsOnly: false,
        scoring,
        sort,
        sortDesc,
        search: search ?? "",
      }}
    />
  );
}
