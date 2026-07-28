import { TeamDraftPicksList } from "@/components/team/team-draft-picks-list";
import { getDraftedRosterForTeam } from "@/lib/queries/draft";

export type MyTeamDraftPicksPanelProps = {
  teamId: string;
};

export async function MyTeamDraftPicksPanel({
  teamId,
}: MyTeamDraftPicksPanelProps) {
  const draftedPicks = await getDraftedRosterForTeam(teamId);

  return (
    <TeamDraftPicksList
      picks={draftedPicks.map((pick) => ({
        overall: pick.overall,
        playerName: pick.fullName,
        positionId: pick.primaryPositionId,
        nflTeam: pick.nflTeam,
      }))}
    />
  );
}
