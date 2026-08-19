import { Suspense } from "react";

import type { leagues, leagueSeasons } from "@/db/schema";
import { InviteLinkCard } from "@/components/leagues/invite-link-card";
import { LeagueSettingsTabs } from "@/components/leagues/settings/league-settings-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { MembershipOwnerOption } from "@/lib/leagues/membership";
import type { NonKeeperClearanceTeam } from "@/lib/leagues/keepers/clearance";
import type { KeeperTeamOption } from "@/lib/queries/keepers";

type LeagueSettingsProps = {
  league: typeof leagues.$inferSelect;
  season: typeof leagueSeasons.$inferSelect | undefined;
  memberCount: number;
  vacantSlotCount: number;
  regularSeasonFinished: boolean;
  boxScoresEditable: boolean;
  owners: MembershipOwnerOption[];
  keeperTeams?: KeeperTeamOption[];
  clearanceTeams?: NonKeeperClearanceTeam[];
  keepersLocked?: boolean;
  keepersMaxConfigured?: boolean;
};

export function LeagueSettings({
  league,
  season,
  memberCount,
  vacantSlotCount,
  regularSeasonFinished,
  boxScoresEditable,
  owners,
  keeperTeams = [],
  clearanceTeams = [],
  keepersLocked = false,
  keepersMaxConfigured = false,
}: LeagueSettingsProps) {
  const hasOpenSlots = season ? memberCount < season.teamCount : true;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        Settings
      </h1>

      {hasOpenSlots ? <InviteLinkCard inviteCode={league.inviteCode} /> : null}

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <LeagueSettingsTabs
          slug={league.publicId}
          leagueName={league.name}
          seasonStatus={season?.status ?? "setup"}
          freeAgencyOpen={season?.freeAgencyOpen ?? false}
          vacantSlotCount={vacantSlotCount}
          divisionCount={season?.divisionCount ?? 1}
          leagueType={season?.leagueType ?? "redraft"}
          regularSeasonFinished={regularSeasonFinished}
          boxScoresEditable={boxScoresEditable}
          owners={owners}
          keeperTeams={keeperTeams}
          clearanceTeams={clearanceTeams}
          keepersLocked={keepersLocked}
          keepersMaxConfigured={keepersMaxConfigured}
        />
      </Suspense>
    </div>
  );
}
