import { KeepersSelection } from "@/components/team/keepers-selection";
import { resolveDynastySettings } from "@/lib/leagues/dynasty-settings";
import { processDueKeeperDeadline } from "@/lib/leagues/keepers/process";
import type { DynastySettings } from "@/db/schema/league-seasons";
import {
  ensureTeamRosterSlotsAssignedForWeek,
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
  currentWeek: number;
};

export async function MyTeamKeepersPanel({
  slug,
  teamId,
  dynasty,
  rosterSlots,
  benchSlots,
  irEnabled,
  taxiEnabled,
  currentWeek,
}: MyTeamKeepersPanelProps) {
  const deadline = await processDueKeeperDeadline(slug);
  await ensureTeamRosterSlotsAssignedForWeek({
    teamId,
    rosterSlots,
    benchSlots,
    irEnabled,
    taxiEnabled,
    currentWeek,
  });
  const players = await getTeamRosterPlayers(teamId);
  const settings = deadline.dynasty ?? resolveDynastySettings(dynasty);

  return (
    <KeepersSelection
      slug={slug}
      leagueSlug={slug}
      players={players}
      dynasty={settings}
      locked={settings.keepersLocked}
    />
  );
}
