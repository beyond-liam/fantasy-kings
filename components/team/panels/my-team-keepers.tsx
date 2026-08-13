import { KeepersSelection } from "@/components/team/keepers-selection";
import { resolveDynastySettings } from "@/lib/leagues/dynasty-settings";
import type { DynastySettings } from "@/db/schema/league-seasons";
import {
  ensureTeamRosterSlotsAssigned,
  getTeamRosterPlayers,
} from "@/lib/queries/team-roster";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";

type MyTeamKeepersPanelProps = {
  slug: string;
  teamId: string;
  dynasty: DynastySettings | null | undefined;
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  taxiEnabled: boolean;
};

export async function MyTeamKeepersPanel({
  slug,
  teamId,
  dynasty,
  rosterSlots,
  benchSlots,
  irEnabled,
  taxiEnabled,
}: MyTeamKeepersPanelProps) {
  await ensureTeamRosterSlotsAssigned({
    teamId,
    rosterSlots,
    benchSlots,
    irEnabled,
    taxiEnabled,
  });
  const players = await getTeamRosterPlayers(teamId);
  const settings = resolveDynastySettings(dynasty);

  return (
    <KeepersSelection
      slug={slug}
      leagueSlug={slug}
      players={players}
      dynasty={settings}
      locked={false}
    />
  );
}
