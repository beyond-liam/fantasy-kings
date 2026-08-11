import { TeamDraftPicksList } from "@/components/team/team-draft-picks-list";
import { getDraftedRosterForTeam } from "@/lib/queries/draft";

export type MyTeamDraftPicksPanelProps = {
  teamId: string;
  leagueSlug: string;
};

export async function MyTeamDraftPicksPanel({
  teamId,
  leagueSlug,
}: MyTeamDraftPicksPanelProps) {
  const draftedPicks = await getDraftedRosterForTeam(teamId);

  return (
    <TeamDraftPicksList
      leagueSlug={leagueSlug}
      picks={draftedPicks.map((pick) => ({
        overall: pick.overall,
        playerId: pick.playerId,
        playerName: pick.fullName,
        positionId: pick.primaryPositionId,
        nflTeam: pick.nflTeam,
      }))}
    />
  );
}
