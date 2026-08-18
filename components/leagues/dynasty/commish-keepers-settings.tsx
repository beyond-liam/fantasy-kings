"use client";

import { useRouter } from "next/navigation";
import { LoyaltyCardIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { SettingsFormCard } from "@/components/leagues/settings/settings-form-card";
import { KeepersSelection } from "@/components/team/keepers-selection";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import type { DynastySettings } from "@/db/schema/league-seasons";
import type { KeeperSelectionPlayer } from "@/components/team/keepers-selection";
import type { KeeperTeamOption } from "@/lib/queries/keepers";

type CommishKeepersSettingsProps = {
  slug: string;
  teams: KeeperTeamOption[];
  selectedTeamId: string;
  players: KeeperSelectionPlayer[];
  dynasty: DynastySettings;
};

export function CommishKeepersSettings({
  slug,
  teams,
  selectedTeamId,
  players,
  dynasty,
}: CommishKeepersSettingsProps) {
  const router = useRouter();
  const selectedTeam = teams.find((team) => team.teamId === selectedTeamId);

  return (
    <div className="flex flex-col gap-6">
      <SettingsFormCard
        title="Set Keepers"
        description={
          selectedTeam
            ? `${selectedTeam.teamName}${selectedTeam.ownerName ? ` · ${selectedTeam.ownerName}` : " · Open slot"}`
            : "Choose a team to set keepers."
        }
        contentClassName="flex flex-col gap-6"
      >
        {teams.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={LoyaltyCardIcon} strokeWidth={2} />
              </EmptyMedia>
              <EmptyTitle>No teams yet</EmptyTitle>
              <EmptyDescription>
                Invite managers before setting keepers.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <FieldGroup>
              <Field>
                <FieldLabel>Team</FieldLabel>
                <FieldDescription>
                  Choose whose keepers to set.
                </FieldDescription>
                <Select
                  items={teams.map((team) => ({
                    value: team.teamId,
                    label: team.ownerName
                      ? `${team.teamName} · ${team.ownerName}`
                      : `${team.teamName} · Open slot`,
                  }))}
                  value={selectedTeamId}
                  onValueChange={(value) => {
                    if (!value) return;
                    router.push(
                      `/league/${slug}/settings/keepers?team=${encodeURIComponent(value)}`,
                    );
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {teams.map((team) => (
                        <SelectItem key={team.teamId} value={team.teamId}>
                          {team.ownerName
                            ? `${team.teamName} · ${team.ownerName}`
                            : `${team.teamName} · Open slot`}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>

            <KeepersSelection
              slug={slug}
              leagueSlug={slug}
              players={players}
              dynasty={dynasty}
              locked={dynasty.keepersLocked}
              targetTeamId={selectedTeamId}
              actor="commissioner"
            />
          </>
        )}
      </SettingsFormCard>
    </div>
  );
}
