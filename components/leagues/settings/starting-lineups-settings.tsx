"use client";

import { useRouter } from "next/navigation";

import { TeamRosterSections } from "@/components/team/roster-sections";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import type { TeamRosterPlayer } from "@/lib/leagues/roster-fill";

export type LineupTeamOption = {
  id: string;
  name: string;
};

type StartingLineupsSettingsProps = {
  slug: string;
  leagueName: string;
  teams: LineupTeamOption[];
  selectedTeamId: string;
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  irEligibleStatuses?: string[];
  taxiEnabled: boolean;
  taxiSlots: number;
  players: TeamRosterPlayer[];
};

export function StartingLineupsSettings({
  slug,
  leagueName,
  teams,
  selectedTeamId,
  rosterSlots,
  benchSlots,
  irEnabled,
  irSlots,
  irEligibleStatuses,
  taxiEnabled,
  taxiSlots,
  players,
}: StartingLineupsSettingsProps) {
  const router = useRouter();
  const selectedTeam = teams.find((team) => team.id === selectedTeamId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Set Starting Lineups
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {leagueName} · Edit any team&apos;s lineup as commissioner.
        </p>
      </div>

      {teams.length === 0 ? (
        <Alert>
          <AlertDescription>
            No teams yet. Invite managers before setting lineups.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <FieldGroup>
            <Field>
              <FieldLabel>Team</FieldLabel>
              <FieldDescription>
                Choose whose roster to edit.
              </FieldDescription>
              <Select
                items={teams.map((team) => ({
                  value: team.id,
                  label: team.name,
                }))}
                value={selectedTeamId}
                onValueChange={(value) => {
                  if (!value) return;
                  router.push(
                    `/league/${slug}/settings/lineups?team=${encodeURIComponent(value)}`,
                  );
                }}
              >
                <SelectTrigger className="max-w-sm">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          {selectedTeam ? (
            <TeamRosterSections
              key={selectedTeamId}
              rosterSlots={rosterSlots}
              benchSlots={benchSlots}
              irEnabled={irEnabled}
              irSlots={irSlots}
              irEligibleStatuses={irEligibleStatuses}
              taxiEnabled={taxiEnabled}
              taxiSlots={taxiSlots}
              players={players}
              leagueSlug={slug}
              actionsEnabled
              rowActionsEnabled={false}
              tradesEnabled={false}
              commissionerTeamId={selectedTeamId}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
