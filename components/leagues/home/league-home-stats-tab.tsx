import { LeagueStatsTable } from "@/components/leagues/stats/league-stats-table";
import { getLeaguePositionStats } from "@/lib/queries/league-stats";

type LeagueHomeStatsTabProps = {
  leagueSlug: string;
  userId: string;
  myTeamPublicId: string | null;
};

export async function LeagueHomeStatsTab({
  leagueSlug,
  userId,
  myTeamPublicId,
}: LeagueHomeStatsTabProps) {
  const stats = await getLeaguePositionStats(leagueSlug, userId);
  if (!stats) {
    return null;
  }

  return (
    <LeagueStatsTable
      rows={stats.rows}
      positionColumns={stats.positionColumns}
      leagueSlug={leagueSlug}
      myTeamPublicId={myTeamPublicId}
      week={stats.week}
      scoresAvailable={stats.scoresAvailable}
    />
  );
}
