"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  IterationCwIcon,
  ShuffleIcon,
  TickDouble02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { TeamRosterTable } from "@/components/team/roster-table";
import { TeamSummaryPanel } from "@/components/team/team-summary-panel";
import { PageFormActions } from "@/components/layout/page-form-actions";
import { Button } from "@/components/ui/button";
import { updateRosterSlots, commissionerUpdateRosterSlots } from "@/lib/actions/roster";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { computeOptimumLineup } from "@/lib/leagues/game-centre/optimum";
import { resolveIrEligibleStatuses } from "@/lib/leagues/ir-eligibility";
import { buildRosterAssignmentOptions } from "@/lib/leagues/roster-display";
import {
  buildFilledRosterSections,
  type TeamRosterPlayer,
} from "@/lib/leagues/roster-fill";
import {
  applyLocalSlotAssignment,
  applyLocalSlotSwap,
} from "@/lib/leagues/roster-slots";
import {
  buildTeamSummaryRosterBreakdown,
  type TeamSummaryMatchupRef,
} from "@/lib/leagues/team-summary";

type TeamRosterSectionsProps = {
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  irEligibleStatuses?: string[];
  taxiEnabled: boolean;
  taxiSlots: number;
  taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
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
  /** NFL teams whose games have started — locks suggested-lineup moves. */
  startedNflTeams?: string[];
  /** When set, shows the sticky team summary beside the roster. */
  summary?: {
    waiverPriorityLabel: string | null;
    ownerName: string | null;
    ownerUserId?: string | null;
    previous: TeamSummaryMatchupRef | null;
    current: TeamSummaryMatchupRef | null;
    myTeamSlug?: string | null;
  };
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
  taxiMaxYearsExp,
  players,
  leagueSlug,
  actionsEnabled = false,
  rowActionsEnabled,
  actionsVariant = "mine",
  partnerTeamSlug,
  tradesEnabled = true,
  commissionerTeamId,
  startedNflTeams = [],
  summary,
}: TeamRosterSectionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draftPlayers, setDraftPlayers] = useState(players);
  const serverKey = slotsFingerprint(players);
  const resolvedIrEligible = resolveIrEligibleStatuses(irEligibleStatuses);
  const showRowActions = rowActionsEnabled ?? actionsEnabled;
  const startedTeams = useMemo(
    () => new Set(startedNflTeams),
    [startedNflTeams],
  );

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

  const rosterBreakdown = summary
    ? buildTeamSummaryRosterBreakdown({
        players: draftPlayers,
        rosterSlots,
        benchSlots,
        irEnabled,
        irSlots,
        irEligibleStatuses: resolvedIrEligible,
        taxiEnabled,
        taxiSlots,
        taxiMaxYearsExp,
      })
    : null;

  const handleSlotChange = (playerId: string, slotPositionId: string) => {
    setDraftPlayers((current) => {
      const result = applyLocalSlotAssignment(
        current,
        playerId,
        slotPositionId,
        rosterSlots,
        benchSlots,
        resolvedIrEligible,
        taxiMaxYearsExp ?? 0,
      );
      if ("error" in result) {
        toast.error(result.error);
        return current;
      }
      return result.players;
    });
  };

  const handleSwap = (playerId: string, otherPlayerId: string) => {
    setDraftPlayers((current) => {
      const result = applyLocalSlotSwap(
        current,
        playerId,
        otherPlayerId,
        rosterSlots,
        benchSlots,
        resolvedIrEligible,
        taxiMaxYearsExp ?? 0,
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

  const handleSuggestedLineup = () => {
    const projectedById = new Map(
      draftPlayers.map((player) => [player.id, player.projectedPts ?? null]),
    );
    const optimum = computeOptimumLineup({
      lineup: sections.lineup,
      rosterPlayers: draftPlayers,
      projectedById,
      startedTeams,
      irEligibleStatuses: resolvedIrEligible,
    });

    if (!optimum.canApply) {
      toast.message("Suggested lineup matches your starters (or all are locked).");
      return;
    }

    const byId = new Map(draftPlayers.map((player) => [player.id, player]));
    const next: TeamRosterPlayer[] = [];
    for (const assignment of optimum.assignments) {
      const player = byId.get(assignment.playerId);
      if (!player) {
        toast.error("Could not apply suggested lineup.");
        return;
      }
      next.push({
        ...player,
        slotPositionId: assignment.slotPositionId,
      });
    }

    if (next.length !== draftPlayers.length) {
      toast.error("Could not apply suggested lineup.");
      return;
    }

    setDraftPlayers(next);
    toast.success("Suggested lineup applied — review and update roster.");
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
    taxiMaxYearsExp,
    onSlotChange: handleSlotChange,
    onSwap: handleSwap,
  } as const;

  const rosterColumn = (
    <div className="flex min-w-0 flex-1 flex-col gap-8">
      <TeamRosterTable section="lineup" slots={sections.lineup} {...tableProps} />
      <TeamRosterTable section="bench" slots={sections.bench} {...tableProps} />
      {sections.ir ? (
        <TeamRosterTable section="ir" slots={sections.ir} {...tableProps} />
      ) : null}
      {sections.taxi ? (
        <TeamRosterTable section="taxi" slots={sections.taxi} {...tableProps} />
      ) : null}
      {actionsEnabled ? (
        <>
          {!isDirty ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={handleSuggestedLineup}
              >
                <HugeiconsIcon
                  icon={ShuffleIcon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Use Suggested Lineup
              </Button>
            </div>
          ) : null}
          <PageFormActions float={isDirty}>
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
              variant="outline"
              disabled={isPending}
              onClick={handleSuggestedLineup}
            >
              <HugeiconsIcon
                icon={ShuffleIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Use Suggested Lineup
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
              Update Roster
            </Button>
          </PageFormActions>
        </>
      ) : null}
    </div>
  );

  if (!summary || !rosterBreakdown) {
    return rosterColumn;
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      {rosterColumn}
      <TeamSummaryPanel
        className="lg:sticky lg:top-20 lg:w-64 lg:shrink-0"
        leagueSlug={leagueSlug}
        waiverPriorityLabel={summary.waiverPriorityLabel}
        ownerName={summary.ownerName}
        ownerUserId={summary.ownerUserId}
        previous={summary.previous}
        current={summary.current}
        breakdown={rosterBreakdown}
      />
    </div>
  );
}
