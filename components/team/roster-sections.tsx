"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IterationCwIcon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { TeamRosterTable } from "@/components/team/roster-table";
import { PageFormActions } from "@/components/layout/page-form-actions";
import { Button } from "@/components/ui/button";
import { updateRosterSlots, commissionerUpdateRosterSlots } from "@/lib/actions/roster";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { resolveIrEligibleStatuses } from "@/lib/leagues/ir-eligibility";
import { buildRosterAssignmentOptions } from "@/lib/leagues/roster-display";
import {
  buildFilledRosterSections,
  type TeamRosterPlayer,
} from "@/lib/leagues/roster-fill";
import { applyLocalSlotAssignment } from "@/lib/leagues/roster-slots";

type TeamRosterSectionsProps = {
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  irEligibleStatuses?: string[];
  taxiEnabled: boolean;
  taxiSlots: number;
  players: TeamRosterPlayer[];
  leagueSlug: string;
  actionsEnabled?: boolean;
  /** When false, slot editing stays on but cut/trade row actions are hidden. */
  rowActionsEnabled?: boolean;
  actionsVariant?: "mine" | "opponent";
  partnerTeamSlug?: string;
  tradesEnabled?: boolean;
  /** Commissioner editing another team's lineup. */
  commissionerTeamId?: string;
};

function slotsFingerprint(players: TeamRosterPlayer[]) {
  return players
    .map((player) => `${player.id}:${player.slotPositionId ?? ""}`)
    .sort()
    .join("|");
}

export function TeamRosterSections({
  rosterSlots,
  benchSlots,
  irEnabled,
  irSlots,
  irEligibleStatuses,
  taxiEnabled,
  taxiSlots,
  players,
  leagueSlug,
  actionsEnabled = false,
  rowActionsEnabled,
  actionsVariant = "mine",
  partnerTeamSlug,
  tradesEnabled = true,
  commissionerTeamId,
}: TeamRosterSectionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draftPlayers, setDraftPlayers] = useState(players);
  const serverKey = slotsFingerprint(players);
  const resolvedIrEligible = resolveIrEligibleStatuses(irEligibleStatuses);
  const showRowActions = rowActionsEnabled ?? actionsEnabled;

  // Only reset the draft when persisted slot assignments change.
  const [syncedServerKey, setSyncedServerKey] = useState(serverKey);
  if (serverKey !== syncedServerKey) {
    setSyncedServerKey(serverKey);
    setDraftPlayers(players);
  }

  const serverSlots = new Map(
    players.map((player) => [player.id, player.slotPositionId ?? ""]),
  );
  const isDirty = draftPlayers.some(
    (player) =>
      (player.slotPositionId ?? "") !== (serverSlots.get(player.id) ?? ""),
  );

  const sections = buildFilledRosterSections({
    rosterSlots,
    benchSlots,
    irEnabled,
    irSlots,
    taxiEnabled,
    taxiSlots,
    players: draftPlayers,
    irEligibleStatuses: resolvedIrEligible,
  });
  const assignmentOptions = buildRosterAssignmentOptions({
    rosterSlots,
    irEnabled,
    taxiEnabled,
  });

  const handleSlotChange = (playerId: string, slotPositionId: string) => {
    setDraftPlayers((current) => {
      const result = applyLocalSlotAssignment(
        current,
        playerId,
        slotPositionId,
        rosterSlots,
        benchSlots,
        resolvedIrEligible,
      );
      if ("error" in result) {
        toast.error(result.error);
        return current;
      }
      return result.players;
    });
  };

  const handleReset = () => {
    setDraftPlayers(players);
  };

  const handleUpdate = () => {
    if (!isDirty || isPending) return;

    const assignments = draftPlayers.map((player) => ({
      playerId: player.id,
      slotPositionId: player.slotPositionId ?? player.primaryPositionId,
    }));

    startTransition(async () => {
      const result = commissionerTeamId
        ? await commissionerUpdateRosterSlots(
            leagueSlug,
            commissionerTeamId,
            assignments,
          )
        : await updateRosterSlots(leagueSlug, assignments);
      if (!result.success) {
        toast.error(result.error ?? "Could not update roster.");
        return;
      }
      toast.success("Roster updated");
      router.refresh();
    });
  };

  const tableProps = {
    assignmentOptions,
    leagueSlug,
    actionsEnabled,
    rowActionsEnabled: showRowActions,
    actionsVariant,
    partnerTeamSlug,
    tradesEnabled,
    irEligibleStatuses: resolvedIrEligible,
    rosterSlots,
    benchSlots,
    rosterPlayers: draftPlayers,
    onSlotChange: handleSlotChange,
  } as const;

  return (
    <div className="flex flex-col gap-8">
      <TeamRosterTable section="lineup" slots={sections.lineup} {...tableProps} />
      <TeamRosterTable section="bench" slots={sections.bench} {...tableProps} />
      {sections.ir ? (
        <TeamRosterTable section="ir" slots={sections.ir} {...tableProps} />
      ) : null}
      {sections.taxi ? (
        <TeamRosterTable section="taxi" slots={sections.taxi} {...tableProps} />
      ) : null}
      {actionsEnabled ? (
        <PageFormActions>
          <Button
            type="button"
            variant="outline"
            disabled={!isDirty || isPending}
            onClick={handleReset}
          >
            <HugeiconsIcon
              icon={IterationCwIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Reset
          </Button>
          <Button
            type="button"
            disabled={!isDirty || isPending}
            onClick={handleUpdate}
          >
            <HugeiconsIcon
              icon={TickDouble02Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Update roster
          </Button>
        </PageFormActions>
      ) : null}
    </div>
  );
}
