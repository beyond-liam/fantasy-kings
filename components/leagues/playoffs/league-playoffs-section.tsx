import { LeagueStandingsTable } from "@/components/leagues/standings/standings-table";
import { PlayoffBracketView } from "@/components/leagues/playoffs/playoff-bracket";
import type { PlayoffBracket } from "@/lib/leagues/playoff-bracket";
import type { LeaguePlayoffStandingsRow } from "@/lib/leagues/playoff-standings";

type LeaguePlayoffsSectionProps = {
  rows: LeaguePlayoffStandingsRow[];
  showFaabBudget?: boolean;
  leagueSlug: string;
  myTeamPublicId?: string | null;
  playoffCutoffSeed: number | null;
  bracket: PlayoffBracket | null;
};

export function LeaguePlayoffsSection({
  rows,
  showFaabBudget,
  leagueSlug,
  myTeamPublicId,
  playoffCutoffSeed,
  bracket,
}: LeaguePlayoffsSectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <LeagueStandingsTable
        rows={rows}
        showFaabBudget={showFaabBudget}
        leagueSlug={leagueSlug}
        myTeamSlug={myTeamPublicId}
        title="Playoffs"
        showSeed
        playoffCutoffSeed={playoffCutoffSeed}
      />
      {bracket ? (
        <PlayoffBracketView
          bracket={bracket}
          myTeamPublicId={myTeamPublicId}
        />
      ) : null}
    </div>
  );
}
