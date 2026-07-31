"use client";

import { useState } from "react";

import { ArrowDataTransferVerticalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import type { TeamRosterPlayer } from "@/lib/leagues/roster-fill";
import {
  positionToneClass,
  slotBadgeLabel,
} from "@/lib/leagues/position-colors";
import {
  effectiveSlotPositionId,
  findSwapCandidates,
  isReserveSlot,
} from "@/lib/leagues/roster-slots";
import { cn } from "@/lib/utils";

const BADGE_CLASSNAME =
  "inline-flex h-6 min-w-9 shrink-0 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold ring-1 ring-inset tabular-nums";

type RosterSlotSwapProps = {
  slotPositionId: string;
  player: TeamRosterPlayer | null;
  rosterPlayers: TeamRosterPlayer[];
  rosterSlots: RosterSlotConfig[];
  irEligibleStatuses?: readonly string[];
  taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
  /** Moves a single player into a slot (used for empty slots and benching). */
  onSlotChange?: (playerId: string, slotPositionId: string) => void;
  /** Trades two players' slots. */
  onSwap?: (playerId: string, otherPlayerId: string) => void;
  disabled?: boolean;
};

function candidateSortKey(player: TeamRosterPlayer) {
  return player.projectedPts ?? -1;
}

/** Mobile slot badge — tap to swap the player in this slot with another. */
export function RosterSlotSwap({
  slotPositionId,
  player,
  rosterPlayers,
  rosterSlots,
  irEligibleStatuses,
  taxiMaxYearsExp,
  onSlotChange,
  onSwap,
  disabled,
}: RosterSlotSwapProps) {
  const [open, setOpen] = useState(false);
  const slot = player ? effectiveSlotPositionId(player) : slotPositionId;
  const badge = (
    <span className={cn(BADGE_CLASSNAME, positionToneClass(slot))}>
      {slotBadgeLabel(slot)}
    </span>
  );

  if (disabled || (!onSwap && !onSlotChange)) {
    return <span className="md:hidden">{badge}</span>;
  }

  const candidates = findSwapCandidates(
    rosterPlayers,
    slot,
    player?.id ?? null,
    { irEligibleStatuses, taxiMaxYearsExp },
  ).toSorted((a, b) => {
    const reserveDiff =
      Number(isReserveSlot(effectiveSlotPositionId(b))) -
      Number(isReserveSlot(effectiveSlotPositionId(a)));
    if (reserveDiff !== 0) return reserveDiff;
    const pointsDiff = candidateSortKey(b) - candidateSortKey(a);
    if (pointsDiff !== 0) return pointsDiff;
    return a.fullName.localeCompare(b.fullName);
  });

  const canBench =
    player != null &&
    !isReserveSlot(slot) &&
    onSlotChange != null &&
    rosterSlots.some((config) => config.positionId === "BN");

  const handleSelect = (candidate: TeamRosterPlayer) => {
    if (player) {
      onSwap?.(player.id, candidate.id);
      return;
    }
    onSlotChange?.(candidate.id, slot);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <DrawerTrigger
        render={
          <button
            type="button"
            aria-label={
              player
                ? `Swap ${player.fullName} out of ${slot}`
                : `Fill empty ${slot} slot`
            }
            className={cn(
              BADGE_CLASSNAME,
              positionToneClass(slot),
              "md:hidden",
              "transition-transform active:scale-[0.96]",
            )}
          />
        }
      >
        {slotBadgeLabel(slot)}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Swap with</DrawerTitle>
          <DrawerDescription>
            {player
              ? `${player.fullName} · ${slotBadgeLabel(slot)}`
              : `Empty ${slotBadgeLabel(slot)} slot`}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-col gap-1 overflow-y-auto p-4 pt-2">
          {candidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No eligible players to swap in.
            </p>
          ) : (
            candidates.map((candidate) => {
              const candidateSlot = effectiveSlotPositionId(candidate);

              return (
                <DrawerClose
                  key={candidate.id}
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-14 w-full justify-start gap-3 px-3"
                      onClick={() => handleSelect(candidate)}
                    />
                  }
                >
                  <span
                    className={cn(
                      BADGE_CLASSNAME,
                      positionToneClass(candidateSlot),
                    )}
                  >
                    {slotBadgeLabel(candidateSlot)}
                  </span>
                  <PlayerAvatar
                    fullName={candidate.fullName}
                    sleeperId={candidate.sleeperId}
                    primaryPositionId={candidate.primaryPositionId}
                    nflTeam={candidate.nflTeam}
                    injuryStatus={candidate.injuryStatus}
                    size="sm"
                  />
                  <span className="flex min-w-0 flex-col items-start">
                    <span className="truncate font-medium">
                      {candidate.fullName}
                    </span>
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {candidate.primaryPositionId}
                      {candidate.nflTeam ? ` - ${candidate.nflTeam}` : ""}
                    </span>
                  </span>
                </DrawerClose>
              );
            })
          )}

          {canBench ? (
            <DrawerClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-11 w-full justify-center"
                  onClick={() => onSlotChange?.(player.id, "BN")}
                />
              }
            >
              <HugeiconsIcon
                icon={ArrowDataTransferVerticalIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Move to bench
            </DrawerClose>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
