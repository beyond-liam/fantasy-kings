"use client";

import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";

type TradeAcceptDialogProps = {
  open: boolean;
  loading: boolean;
  loadError: string | null;
  dropsNeeded: number;
  candidates: TradeAcceptCandidate[];
  leagueSlug: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dropIds: string[]) => void;
};

export function TradeAcceptDialog({
  open,
  loading,
  loadError,
  dropsNeeded,
  candidates,
  leagueSlug,
  onOpenChange,
  onConfirm,
}: TradeAcceptDialogProps) {
  const [dropIds, setDropIds] = useState<Set<string>>(new Set());

  const { eligible, ineligible } = useMemo(() => {
    const nextEligible: TradeAcceptCandidate[] = [];
    const nextIneligible: TradeAcceptCandidate[] = [];
    for (const player of candidates) {
      if (player.minimumBlocked) {
        nextIneligible.push(player);
      } else {
        nextEligible.push(player);
      }
    }
    return { eligible: nextEligible, ineligible: nextIneligible };
  }, [candidates]);

  const dropsReady = dropIds.size >= dropsNeeded;

  function toggleDrop(playerId: string) {
    const player = candidates.find((row) => row.id === playerId);
    if (player?.minimumBlocked) {
      return;
    }
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

  function renderCandidate(player: TradeAcceptCandidate, blocked: boolean) {
    return (
      <li
        key={player.id}
        className={cn("flex items-center gap-2", blocked && "opacity-60")}
      >
        <Checkbox
          checked={dropIds.has(player.id)}
          disabled={blocked}
          onCheckedChange={() => toggleDrop(player.id)}
          aria-label={
            blocked
              ? `${player.fullName} (below roster minimum)`
              : `Drop ${player.fullName}`
          }
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <PlayerIdentity
            fullName={player.fullName}
            primaryPositionId={player.primaryPositionId}
            nflTeam={player.nflTeam}
            size="sm"
            playerId={player.id}
            leagueSlug={leagueSlug}
          />
          {blocked && player.minimumBlockReason ? (
            <span className="text-[10px] text-muted-foreground">
              {player.minimumBlockReason}
            </span>
          ) : null}
        </div>
      </li>
    );
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
          <div className="space-y-3 rounded-lg border p-3">
            {eligible.length > 0 ? (
              <ul className="space-y-2">
                {ineligible.length > 0 ? (
                  <li className="text-xs font-medium text-muted-foreground">
                    Eligible
                  </li>
                ) : null}
                {eligible.map((player) => renderCandidate(player, false))}
              </ul>
            ) : null}
            {ineligible.length > 0 ? (
              <ul className="space-y-2">
                <li className="text-xs font-medium text-muted-foreground">
                  Below roster minimum
                </li>
                {ineligible.map((player) => renderCandidate(player, true))}
              </ul>
            ) : null}
          </div>
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
