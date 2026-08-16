"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { formatPlayerSubtitle } from "@/components/rankings/player-identity";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RosterCutCandidate } from "@/lib/actions/roster";
import { fileWaiverClaim } from "@/lib/actions/waivers";
import type { WaiverActionResult } from "@/lib/actions/waivers";
import { compareRosterPositions } from "@/lib/leagues/roster-position-order";
import { cn } from "@/lib/utils";

export type ClaimPlayerDialogState = {
  open: boolean;
  playerId: string;
  playerName: string;
  cutCandidates: RosterCutCandidate[];
  requiresDrop: boolean;
  waiverType: "priority" | "faab";
  faabRemaining: number | null;
  allowZeroBids: boolean;
};

type ClaimPlayerDialogProps = {
  leagueSlug: string;
  state: ClaimPlayerDialogState | null;
  onOpenChange: (open: boolean) => void;
};

function DropPlayerOption({ player }: { player: RosterCutCandidate }) {
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

export function ClaimPlayerDialog({
  leagueSlug,
  state,
  onOpenChange,
}: ClaimPlayerDialogProps) {
  const router = useRouter();
  const [dropPlayerId, setDropPlayerId] = useState<string | null>(null);
  const [bid, setBid] = useState("0");
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
    candidates.find((player) => player.id === dropPlayerId) ?? null;
  const isFaab = state?.waiverType === "faab";

  const openKey = open ? `${state?.playerId}` : null;
  const [resetKey, setResetKey] = useState<string | null>(null);
  if (openKey !== resetKey) {
    setResetKey(openKey);
    if (openKey) {
      setDropPlayerId(null);
      setBid("0");
    }
  }

  const handleConfirm = () => {
    if (!state) return;
    if (state.requiresDrop && !dropPlayerId) return;
    if (selected?.minimumBlocked) {
      toast.error(
        selected.minimumBlockReason ??
          "That drop would leave you under a roster minimum.",
      );
      return;
    }

    const parsedBid = isFaab ? Number(bid) : null;
    if (isFaab && (!Number.isFinite(parsedBid) || parsedBid === null)) {
      toast.error("Enter a valid bid.");
      return;
    }

    startTransition(async () => {
      const result: WaiverActionResult = await fileWaiverClaim(leagueSlug, {
        playerId: state.playerId,
        bid: parsedBid,
        dropPlayerId,
      });

      if (!result.success) {
        toast.error(result.error ?? "Could not file claim.");
        return;
      }

      const name =
        result.playerName?.trim() || state.playerName.trim() || "Player";
      toast.success(`Claim filed for ${name}`);
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDropPlayerId(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Claim {state?.playerName ?? "player"}</DialogTitle>
          <DialogDescription>
            {isFaab
              ? `File a FAAB claim. Remaining budget: $${state?.faabRemaining ?? 0}.`
              : "File a priority waiver claim. Winning claims move you to the bottom of the order."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {isFaab ? (
            <div className="grid gap-2">
              <Label htmlFor="faab-bid">Bid ($)</Label>
              <Input
                id="faab-bid"
                type="number"
                min={state?.allowZeroBids ? 0 : 1}
                max={state?.faabRemaining ?? undefined}
                step={1}
                value={bid}
                onChange={(event) => setBid(event.target.value)}
              />
            </div>
          ) : null}

          {state?.requiresDrop || candidates.length > 0 ? (
            <div className="grid gap-2">
              <Label>
                {state?.requiresDrop ? "Player to drop" : "Optional drop"}
              </Label>
              {candidates.length === 0 ? (
                <Empty className="border-none" size="sm">
                  <EmptyHeader>
                    <EmptyTitle>No eligible drops</EmptyTitle>
                    <EmptyDescription>
                      No roster players can be dropped for this claim.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Select
                  items={candidates.map((player) => ({
                    value: player.id,
                    label: player.fullName,
                  }))}
                  value={dropPlayerId}
                  onValueChange={(value) => {
                    setDropPlayerId(value ? String(value) : null);
                  }}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label="Player to drop"
                  >
                    <SelectValue
                      placeholder={
                        state?.requiresDrop
                          ? "Select a player to drop"
                          : "Optional — select a player to drop"
                      }
                    >
                      {selected ? selected.fullName : null}
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
                            <DropPlayerOption player={player} />
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
                              <DropPlayerOption player={player} />
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
              {eligible.length === 0 && ineligible.length > 0 ? (
                <p className={cn("text-xs text-muted-foreground")}>
                  Every drop would leave you under a roster minimum.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              isPending ||
              Boolean(state?.requiresDrop && !dropPlayerId) ||
              Boolean(state?.requiresDrop && eligible.length === 0) ||
              Boolean(selected?.minimumBlocked)
            }
            onClick={handleConfirm}
          >
            <HugeiconsIcon
              icon={TickDouble02Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Claim Player
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
