import { PowerRankingRow } from "@/components/leagues/power-rankings/power-ranking-row";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { PowerRankingTeamRow } from "@/lib/leagues/power-rankings/types";

type PowerRankingsListProps = {
  rows: PowerRankingTeamRow[];
  leagueSlug: string;
};

export function PowerRankingsList({
  rows,
  leagueSlug,
}: PowerRankingsListProps) {
  if (rows.length === 0) {
    return (
      <Empty size="sm">
        <EmptyHeader>
          <EmptyTitle>No teams yet</EmptyTitle>
          <EmptyDescription>
            Power rankings will appear once teams are in this league.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.teamId}>
          <PowerRankingRow row={row} leagueSlug={leagueSlug} />
        </li>
      ))}
    </ul>
  );
}
