import { TeamStatsTable } from "@/components/team/stats-table";
import { groupRosterPlayersForStats } from "@/lib/leagues/team-stats";
import type { RankedPlayerRow } from "@/lib/queries/players";

type TeamStatsSectionsProps = {
  players: RankedPlayerRow[];
  leagueSlug?: string | null;
};

export function TeamStatsSections({
  players,
  leagueSlug,
}: TeamStatsSectionsProps) {
  const sections = groupRosterPlayersForStats(players);

  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <TeamStatsTable
          key={section.id}
          section={section}
          leagueSlug={leagueSlug}
        />
      ))}
    </div>
  );
}
