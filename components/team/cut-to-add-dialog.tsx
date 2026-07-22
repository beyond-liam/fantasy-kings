"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cancel01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cutAndAddPlayer,
  type RosterCutCandidate,
} from "@/lib/actions/roster";

export type CutToAddDialogState = {
  open: boolean;
  reason: "roster_full" | "position_max";
  pendingPlayerId: string;
  pendingPlayerName: string;
  cutCandidates: RosterCutCandidate[];
};

type CutToAddDialogProps = {
  leagueSlug: string;
  state: CutToAddDialogState | null;
  onOpenChange: (open: boolean) => void;
};

function playerSubtitle(player: RosterCutCandidate) {
  const team = player.nflTeam?.trim() || "FA";
  return `${team} ${player.primaryPositionId}`;
}

export function CutToAddDialog({
  leagueSlug,
  state,
  onOpenChange,
}: CutToAddDialogProps) {
  const router = useRouter();
  const [cutPlayerId, setCutPlayerId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = Boolean(state?.open);
  const candidates = state?.cutCandidates ?? [];
  const selected =
    candidates.find((player) => player.id === cutPlayerId) ?? null;

  const title =
    state?.reason === "position_max"
      ? "Position limit reached"
      : "Roster is full";

  const description =
    state?.reason === "position_max"
      ? `You must cut a player before adding ${state.pendingPlayerName}. Choose someone to drop from this position.`
      : `You must cut a player before adding ${state?.pendingPlayerName ?? "this player"}. Choose someone to drop from your roster.`;

  const handleConfirm = () => {
    if (!state || !cutPlayerId) return;

    startTransition(async () => {
      const result = await cutAndAddPlayer(
        leagueSlug,
        cutPlayerId,
        state.pendingPlayerId,
      );

      if (!result.success) {
        toast.error(result.error ?? "Could not update roster.");
        return;
      }

      const name =
        result.playerName?.trim() || state.pendingPlayerName.trim() || "Player";
      toast.success(`${name} added to your roster`);
      setCutPlayerId(null);
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setCutPlayerId(null);
        }
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
                <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No eligible players to cut.
          </p>
        ) : (
          <Select
            items={candidates.map((player) => ({
              value: player.id,
              label: player.fullName,
            }))}
            value={cutPlayerId}
            onValueChange={(value) => {
              setCutPlayerId(value ? String(value) : null);
            }}
          >
            <SelectTrigger className="w-full" aria-label="Player to cut">
              <SelectValue placeholder="Select a player to cut">
                {selected ? selected.fullName : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {candidates.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    <span className="font-medium">{player.fullName}</span>
                    <span className="text-xs text-muted-foreground">
                      {playerSubtitle(player)}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost" disabled={isPending}>
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Cancel
          </AlertDialogCancel>
          <Button
            type="button"
            disabled={isPending || !cutPlayerId || candidates.length === 0}
            onClick={handleConfirm}
          >
            <HugeiconsIcon
              icon={UserAdd01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Add player
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
