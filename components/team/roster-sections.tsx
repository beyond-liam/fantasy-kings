"use client";

import dynamic from "next/dynamic";
import { Suspense, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  IterationCwIcon,
  TickDouble02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { TeamRosterTable } from "@/components/team/roster-table";
import { TeamSummaryPanel } from "@/components/team/team-summary-panel";
import { PageFormActions } from "@/components/layout/page-form-actions";
import {
  WeekFilter,
  type WeekFilterOption,
} from "@/components/scores/week-filter";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { updateRosterSlots, commissionerUpdateRosterSlots } from "@/lib/actions/roster";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";
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
import { lineupWeekRelation } from "@/lib/leagues/lineup-plans";
import { explainPlayerPoints } from "@/lib/leagues/scoring/calculate";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import {
  buildTeamSummaryRosterBreakdown,
  type TeamSummaryMatchupRef,
} from "@/lib/leagues/team-summary";

const ScoringBreakdownDialog = dynamic(
  () =>
    import("@/components/leagues/game-centre/scoring-breakdown-dialog").then(
      (m) => m.ScoringBreakdownDialog,
    ),
  { ssr: false },
);

type TeamRosterSectionsProps = {
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
  leagueSlug: string;
  actionsEnabled?: boolean;
  /** When false, slot editing stays on but cut/trade row actions are hidden. */
  rowActionsEnabled?: boolean;
  /** When false, Cut is disabled (trades may still show). Defaults to actionsEnabled. */
  cutActionsEnabled?: boolean;
  actionsVariant?: "mine" | "opponent";
  partnerTeamSlug?: string;
  tradesEnabled?: boolean;
  /** Commissioner editing another team's lineup. */
  commissionerTeamId?: string;
  /** Player IDs locked after their NFL game has started (cut + slot). */
  gameLockedPlayerIds?: string[];
  /** When set, shows the sticky team summary beside the roster. */
  summary?: {
    waiverPriorityLabel: string | null;
    ownerName: string | null;
    previous: TeamSummaryMatchupRef | null;
    current: TeamSummaryMatchupRef | null;
    myTeamSlug?: string | null;
  };
  scoringRules?: ScoringRuleDefinition[];
  scoringWeek?: number;
  week?: number;
  currentWeek?: number;
  weeks?: WeekFilterOption[];
};

function slotsFingerprint(players: TeamRosterPlayer[]) {
  return players
    .map((player) => `${player.id}:${player.slotPositionId ?? ""}`)
    .sort()
    .join("|");
}

function weekDisplayFingerprint(players: TeamRosterPlayer[]) {
  return players
    .map((player) =>
      [
        player.id,
        player.projectedPts ?? "",
        player.actualPts ?? "",
        player.opponent?.label ?? "",
        player.opponent?.kickoffLabel ?? "",
        player.opponent?.gameId ?? "",
      ].join(":"),
    )
    .sort()
    .join("|");
}

function mergeWeekDisplay(
  draft: TeamRosterPlayer[],
  server: TeamRosterPlayer[],
): TeamRosterPlayer[] {
  const byId = new Map(server.map((player) => [player.id, player]));
  return draft.map((player) => {
    const next = byId.get(player.id);
    if (!next) return player;
    return { ...next, slotPositionId: player.slotPositionId };
  });
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
  taxiPreventReaddAfterActivation = false,
  players,
  leagueSlug,
  actionsEnabled = false,
  rowActionsEnabled,
  cutActionsEnabled,
  actionsVariant = "mine",
  partnerTeamSlug,
  tradesEnabled = true,
  commissionerTeamId,
  gameLockedPlayerIds = [],
  summary,
  scoringRules,
  scoringWeek,
  week,
  currentWeek,
  weeks,
}: TeamRosterSectionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draftPlayers, setDraftPlayers] = useState(players);
  const [breakdownPlayerId, setBreakdownPlayerId] = useState<string | null>(
    null,
  );
  const serverKey = `${week ?? ""}:${slotsFingerprint(players)}`;
  const displayKey = `${week ?? ""}:${weekDisplayFingerprint(players)}`;
  const resolvedIrEligible = resolveIrEligibleStatuses(irEligibleStatuses);
  const showRowActions = rowActionsEnabled ?? actionsEnabled;
  const canCut = cutActionsEnabled ?? actionsEnabled;
  const gameLockedIdSet = new Set(gameLockedPlayerIds);
  const weekRelation =
    week != null && currentWeek != null
      ? lineupWeekRelation(week, currentWeek)
      : "current";
  const slotLockedIdSet =
    weekRelation === "future"
      ? new Set<string>()
      : weekRelation === "past"
        ? new Set(draftPlayers.map((player) => player.id))
        : gameLockedIdSet;

  // Reset the draft when persisted slots change. Overlay Opp/PTS when the
  // selected week (or live scores) updates so unsaved lineup edits stay.
  const [syncedServerKey, setSyncedServerKey] = useState(serverKey);
  const [syncedDisplayKey, setSyncedDisplayKey] = useState(displayKey);
  if (serverKey !== syncedServerKey) {
    setSyncedServerKey(serverKey);
    setSyncedDisplayKey(displayKey);
    setDraftPlayers(players);
  } else if (displayKey !== syncedDisplayKey) {
    setSyncedDisplayKey(displayKey);
    setDraftPlayers(mergeWeekDisplay(draftPlayers, players));
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
        taxiPreventReaddAfterActivation,
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
        taxiPreventReaddAfterActivation,
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
            week,
          )
        : await updateRosterSlots(leagueSlug, assignments, week);
      if (!result.success) {
        toast.error(result.error ?? "Could not update roster.");
        return;
      }
      toast.success(
        result.scheduledWeek != null
          ? `Lineup saved for Week ${result.scheduledWeek}`
          : "Roster updated",
      );
      router.refresh();
    });
  };

  const tableProps = {
    assignmentOptions,
    leagueSlug,
    actionsEnabled,
    rowActionsEnabled: showRowActions,
    cutActionsEnabled: canCut,
    actionsVariant,
    partnerTeamSlug,
    tradesEnabled,
    irEligibleStatuses: resolvedIrEligible,
    rosterSlots,
    benchSlots,
    rosterPlayers: draftPlayers,
    taxiMaxYearsExp,
    taxiPreventReaddAfterActivation,
    gameLockedPlayerIds: gameLockedIdSet,
    slotLockedPlayerIds: slotLockedIdSet,
    onSlotChange: handleSlotChange,
    onSwap: handleSwap,
    onActualClick:
      scoringRules && scoringWeek != null
        ? (player: TeamRosterPlayer) => setBreakdownPlayerId(player.id)
        : undefined,
  } as const;

  const breakdownPlayer = breakdownPlayerId
    ? (draftPlayers.find((player) => player.id === breakdownPlayerId) ?? null)
    : null;
  const breakdownExplanation = useMemo(() => {
    if (!breakdownPlayer || !scoringRules || breakdownPlayer.actualPts == null) {
      return null;
    }
    return explainPlayerPoints(
      breakdownPlayer.weekStats ?? {},
      breakdownPlayer.primaryPositionId,
      scoringRules,
    );
  }, [breakdownPlayer, scoringRules]);

  const breakdownDialog =
    scoringRules && scoringWeek != null ? (
      <ScoringBreakdownDialog
        open={breakdownPlayer != null}
        onOpenChange={(open) => {
          if (!open) setBreakdownPlayerId(null);
        }}
        playerName={breakdownPlayer?.fullName ?? ""}
        week={scoringWeek}
        explanation={breakdownExplanation}
      />
    ) : null;

  const weekFilter =
    weeks && weeks.length > 0 && week != null ? (
      <Suspense fallback={<Spinner />}>
        <WeekFilter weeks={weeks} value={week} />
      </Suspense>
    ) : null;

  const rosterColumn = (
    <div className="flex min-w-0 flex-1 flex-col gap-8">
      <TeamRosterTable
        section="lineup"
        slots={sections.lineup}
        headerEnd={weekFilter}
        {...tableProps}
      />
      <TeamRosterTable section="bench" slots={sections.bench} {...tableProps} />
      {sections.ir ? (
        <TeamRosterTable section="ir" slots={sections.ir} {...tableProps} />
      ) : null}
      {sections.taxi ? (
        <TeamRosterTable section="taxi" slots={sections.taxi} {...tableProps} />
      ) : null}
      {actionsEnabled ? (
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
            Reset Changes
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
      ) : null}
    </div>
  );

  if (!summary || !rosterBreakdown) {
    return (
      <>
        {rosterColumn}
        {breakdownDialog}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {rosterColumn}
        <TeamSummaryPanel
          className="lg:sticky lg:top-20 lg:w-64 lg:shrink-0"
          leagueSlug={leagueSlug}
          waiverPriorityLabel={summary.waiverPriorityLabel}
          ownerName={summary.ownerName}
          previous={summary.previous}
          current={summary.current}
          breakdown={rosterBreakdown}
        />
      </div>
      {breakdownDialog}
    </>
  );
}
