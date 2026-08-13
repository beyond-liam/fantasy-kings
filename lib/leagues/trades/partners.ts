export type ProposeTradePartner = {
  id: string;
  name: string;
  slug: string;
};

type MemberTeam = {
  teamId: string | null;
  teamName: string | null;
  teamSlug?: string | null;
  teamPublicId?: string | null;
};

type SeasonTeam = {
  teamId: string | null;
  teamName: string | null;
  teamPublicId?: string | null;
};

/** Other teams you can propose a trade to (season teams, excluding yours). */
export function resolveTradePartners(input: {
  myTeamId: string;
  members: MemberTeam[];
  seasonTeams?: SeasonTeam[];
}): ProposeTradePartner[] {
  const slugByTeamId = new Map<string, string>();
  for (const member of input.members) {
    if (!member.teamId) continue;
    slugByTeamId.set(
      member.teamId,
      member.teamSlug ?? member.teamPublicId ?? member.teamId,
    );
  }

  const fromSeason = (input.seasonTeams ?? [])
    .filter(
      (row): row is SeasonTeam & { teamId: string } =>
        row.teamId != null && row.teamId !== input.myTeamId,
    )
    .map((row) => ({
      id: row.teamId,
      name: row.teamName ?? "Team",
      slug: slugByTeamId.get(row.teamId) ?? row.teamPublicId ?? row.teamId,
    }));

  if (fromSeason.length > 0) {
    return fromSeason;
  }

  // Fallback when standings teams were not loaded.
  return input.members
    .filter(
      (member): member is MemberTeam & { teamId: string } =>
        member.teamId != null && member.teamId !== input.myTeamId,
    )
    .map((member) => ({
      id: member.teamId,
      name: member.teamName ?? "Team",
      slug: member.teamSlug ?? member.teamPublicId ?? member.teamId,
    }));
}
