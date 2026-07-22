"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RosterCutCandidate } from "@/lib/actions/roster";
import { fileWaiverClaim } from "@/lib/actions/waivers";
import type { WaiverActionResult } from "@/lib/actions/waivers";

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

function playerSubtitle(player: RosterCutCandidate) {
  const team = player.nflTeam?.trim() || "FA";
  return `${team} ${player.primaryPositionId}`;
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
  const candidates = state?.cutCandidates ?? [];
  const selected =
    candidates.find((player) => player.id === dropPlayerId) ?? null;
  const isFaab = state?.waiverType === "faab";

  useEffect(() => {
    if (!open) return;
    setDropPlayerId(null);
    setBid("0");
  }, [open, state?.playerId]);

  const handleConfirm = () => {
    if (!state) return;
    if (state.requiresDrop && !dropPlayerId) return;

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
                {state?.requiresDrop
                  ? "Player to drop"
                  : "Optional drop"}
              </Label>
              {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No eligible players to drop.
                </p>
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
                  <SelectTrigger className="w-full" aria-label="Player to drop">
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
              Boolean(state?.requiresDrop && candidates.length === 0)
            }
            onClick={handleConfirm}
          >
            <HugeiconsIcon
              icon={TickDouble02Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            File claim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
