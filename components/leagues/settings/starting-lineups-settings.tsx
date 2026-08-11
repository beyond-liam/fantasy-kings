"use client";

import { useRouter } from "next/navigation";

import { UserRemove01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { SettingsFormCard } from "@/components/leagues/settings/settings-form-card";
import { TeamRosterSections } from "@/components/team/roster-sections";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
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
  taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
  taxiPreventReaddAfterActivation?: boolean;
  players: TeamRosterPlayer[];
};

export function StartingLineupsSettings({
  slug,
  teams,
  selectedTeamId,
  rosterSlots,
  benchSlots,
  irEnabled,
  irSlots,
  irEligibleStatuses,
  taxiEnabled,
  taxiSlots,
  taxiMaxYearsExp,
  taxiPreventReaddAfterActivation,
  players,
}: StartingLineupsSettingsProps) {
  const router = useRouter();
  const selectedTeam = teams.find((team) => team.id === selectedTeamId);

  return (
    <div className="flex flex-col gap-6">
      <SettingsFormCard
        title="Set Starting Lineups"
        contentClassName="flex flex-col gap-6"
      >
        {teams.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={UserRemove01Icon} strokeWidth={2} />
              </EmptyMedia>
              <EmptyTitle>No teams yet</EmptyTitle>
              <EmptyDescription>
                Invite managers before setting lineups.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
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
                <SelectTrigger className="w-full">
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
              taxiMaxYearsExp={taxiMaxYearsExp}
              taxiPreventReaddAfterActivation={taxiPreventReaddAfterActivation}
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
      </SettingsFormCard>
    </div>
  );
}
