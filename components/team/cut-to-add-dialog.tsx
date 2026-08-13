"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cancel01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { formatPlayerSubtitle } from "@/components/rankings/player-identity";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cutAndAddPlayer,
  type RosterCutCandidate,
} from "@/lib/actions/roster";
import { compareRosterPositions } from "@/lib/leagues/roster-position-order";

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

function CutPlayerOption({ player }: { player: RosterCutCandidate }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <PlayerAvatar
        fullName={player.fullName}
        sleeperId={player.sleeperId}
        primaryPositionId={player.primaryPositionId}
        nflTeam={player.nflTeam}
        size="sm"
      />
      <span className="flex min-w-0 flex-col text-left">
        <span className="truncate font-medium">{player.fullName}</span>
        <span className="truncate text-[11px] leading-tight text-muted-foreground">
          {formatPlayerSubtitle({
            primaryPositionId: player.primaryPositionId,
            nflTeam: player.nflTeam,
            byeWeek: player.byeWeek,
          })}
        </span>
      </span>
    </span>
  );
}

function sortCandidates(rows: RosterCutCandidate[]) {
  return rows.toSorted((a, b) => {
    const byPosition = compareRosterPositions(
      a.primaryPositionId,
      b.primaryPositionId,
    );
    if (byPosition !== 0) return byPosition;
    return a.fullName.localeCompare(b.fullName);
  });
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
  const { eligible, ineligible } = useMemo(() => {
    const rows = state?.cutCandidates ?? [];
    return {
      eligible: sortCandidates(rows.filter((row) => !row.minimumBlocked)),
      ineligible: sortCandidates(rows.filter((row) => row.minimumBlocked)),
    };
  }, [state?.cutCandidates]);
  const candidates = useMemo(
    () => [...eligible, ...ineligible],
    [eligible, ineligible],
  );
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
    if (selected?.minimumBlocked) {
      toast.error(
        selected.minimumBlockReason ??
          "That cut would leave you under a roster minimum.",
      );
      return;
    }

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
          <Empty className="border-none" size="sm">
            <EmptyHeader>
              <EmptyTitle>No eligible cuts</EmptyTitle>
              <EmptyDescription>
                No roster players can be cut for this move.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
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
            <SelectTrigger
              className="h-auto min-h-9 w-full py-1.5"
              aria-label="Player to cut"
            >
              <SelectValue placeholder="Select a player to cut">
                {selected ? <CutPlayerOption player={selected} /> : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {eligible.length > 0 ? (
                <SelectGroup>
                  {ineligible.length > 0 ? (
                    <SelectLabel>Eligible</SelectLabel>
                  ) : null}
                  {eligible.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      <CutPlayerOption player={player} />
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {ineligible.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Below roster minimum</SelectLabel>
                  {ineligible.map((player) => (
                    <SelectItem
                      key={player.id}
                      value={player.id}
                      disabled
                      className="opacity-60"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <CutPlayerOption player={player} />
                        {player.minimumBlockReason ? (
                          <span className="text-[10px] text-muted-foreground">
                            {player.minimumBlockReason}
                          </span>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
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
            disabled={
              isPending ||
              !cutPlayerId ||
              eligible.length === 0 ||
              Boolean(selected?.minimumBlocked)
            }
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
