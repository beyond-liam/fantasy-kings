"use client";

import { useState } from "react";
import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerIdentity } from "@/components/rankings/player-identity";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TradeAcceptCandidate } from "@/lib/actions/trades";

type TradeAcceptDialogProps = {
  open: boolean;
  loading: boolean;
  loadError: string | null;
  dropsNeeded: number;
  candidates: TradeAcceptCandidate[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (dropIds: string[]) => void;
};

export function TradeAcceptDialog({
  open,
  loading,
  loadError,
  dropsNeeded,
  candidates,
  onOpenChange,
  onConfirm,
}: TradeAcceptDialogProps) {
  const [dropIds, setDropIds] = useState<Set<string>>(new Set());

  const dropsReady = dropIds.size >= dropsNeeded;

  function toggleDrop(playerId: string) {
    setDropIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) {
        next.delete(playerId);
        return next;
      }
      if (next.size >= dropsNeeded) {
        return next;
      }
      next.add(playerId);
      return next;
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDropIds(new Set());
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Accept trade</DialogTitle>
          <DialogDescription>
            {dropsNeeded > 0
              ? `Select ${dropsNeeded} player(s) to drop for roster room.`
              : "Confirm you want to accept this trade."}
          </DialogDescription>
        </DialogHeader>

                {loading ? (
          <p className="text-sm text-muted-foreground">Loading roster…</p>
        ) : null}

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : null}

        {!loading && dropsNeeded > 0 ? (
          <ul className="space-y-2 rounded-lg border p-3">
            {candidates.map((player) => (
              <li key={player.id} className="flex items-center gap-2">
                <Checkbox
                  checked={dropIds.has(player.id)}
                  onCheckedChange={() => toggleDrop(player.id)}
                  aria-label={`Drop ${player.fullName}`}
                />
                <PlayerIdentity
                  fullName={player.fullName}
                  primaryPositionId={player.primaryPositionId}
                  nflTeam={player.nflTeam}
                  size="sm"
                />
              </li>
            ))}
          </ul>
        ) : null}

        {!loading && dropsNeeded > 0 ? (
          <p className="text-xs text-muted-foreground">
            Selected {dropIds.size} of {dropsNeeded} required.
          </p>
        ) : null}
        
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
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
            disabled={loading || Boolean(loadError) || !dropsReady}
            onClick={() => onConfirm([...dropIds])}
          >
            <HugeiconsIcon
              icon={TickDouble02Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Confirm accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
