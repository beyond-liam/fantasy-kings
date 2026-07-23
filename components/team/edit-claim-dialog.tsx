"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { PlayerIdentity } from "@/components/rankings/player-identity";
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
import { updateWaiverClaimBid } from "@/lib/actions/waivers";

export type EditClaimDialogState = {
  open: boolean;
  claimId: string;
  playerName: string;
  sleeperId: string | null;
  primaryPositionId: string;
  nflTeam: string | null;
  bid: number;
};

type EditClaimDialogProps = {
  leagueSlug: string;
  state: EditClaimDialogState | null;
  faabRemaining: number;
  allowZeroBids: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditClaimDialog({
  leagueSlug,
  state,
  faabRemaining,
  allowZeroBids,
  onOpenChange,
}: EditClaimDialogProps) {
  const router = useRouter();
  const [bid, setBid] = useState("0");
  const [isPending, startTransition] = useTransition();

  const open = Boolean(state?.open);

  const openKey = open ? state?.claimId : null;
  const [resetKey, setResetKey] = useState<string | undefined | null>(null);
  if (openKey !== resetKey) {
    setResetKey(openKey);
    if (openKey && state) {
      setBid(String(state.bid));
    }
  }

  const handleSave = () => {
    if (!state) {
      return;
    }

    const parsedBid = Number(bid);
    if (!Number.isFinite(parsedBid)) {
      toast.error("Enter a valid bid.");
      return;
    }

    startTransition(async () => {
      const result = await updateWaiverClaimBid(
        leagueSlug,
        state.claimId,
        parsedBid,
      );

      if (!result.success) {
        toast.error(result.error ?? "Could not update claim.");
        return;
      }

      toast.success(
        result.playerName
          ? `Updated bid for ${result.playerName}`
          : "Claim updated",
      );
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit claim</DialogTitle>
          <DialogDescription>
            Update your FAAB bid. Remaining budget: ${faabRemaining}.
            {!allowZeroBids ? " Zero-dollar bids are not allowed." : null}
          </DialogDescription>
        </DialogHeader>

        {state ? (
                    <div className="flex flex-col gap-4">
            <PlayerIdentity
              fullName={state.playerName}
              sleeperId={state.sleeperId}
              primaryPositionId={state.primaryPositionId}
              nflTeam={state.nflTeam}
              size="sm"
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-faab-bid">Bid ($)</Label>
              <Input
                id="edit-faab-bid"
                type="number"
                min={allowZeroBids ? 0 : 1}
                max={faabRemaining}
                step={1}
                value={bid}
                onChange={(event) => setBid(event.target.value)}
              />
            </div>
          </div>
                  ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
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
          <Button type="button" disabled={isPending} onClick={handleSave}>
            <HugeiconsIcon
              icon={TickDouble02Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Save bid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
