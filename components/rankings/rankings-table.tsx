import { PlayersDataTable } from "@/components/rankings/players-data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getNflTeams, getRankedPlayers } from "@/lib/queries/players";
import type { PositionFilter } from "@/lib/rankings/column-config";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";

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
}: RankingsTableProps) {
  const [playersResult, teams] = await Promise.all([
    getRankedPlayers({
      season,
      week,
      kind,
      scoringPreset: scoring,
      position,
      team: team !== "ALL" ? team : undefined,
      rookiesOnly: rookiesOnly || undefined,
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

  return (
    <PlayersDataTable
      currentSeason={currentSeason}
      data={playersResult.rows}
      previousSeason={previousSeason}
      seasons={seasons}
      teams={teams}
      view={{
        season,
        week: weekParam === "0" ? "season" : weekParam,
        kind,
        position,
        team,
        rookiesOnly,
        freeAgentsOnly: false,
        scoring,
        sort,
        sortDesc,
      }}
    />
  );
}
