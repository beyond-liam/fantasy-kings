"use client";

import {
  ArrowRight02Icon,
  Cancel01Icon,
  CheckmarkCircle03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { updateRosterSlots } from "@/lib/actions/roster";
import type { OptimumLineupResult } from "@/lib/leagues/game-centre/optimum";

type OptimumLineupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueSlug: string;
  optimum: OptimumLineupResult | null;
};

export function OptimumLineupDialog({
  open,
  onOpenChange,
  leagueSlug,
  optimum,
}: OptimumLineupDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleApply = () => {
    if (!optimum?.canApply) return;
    startTransition(async () => {
      const result = await updateRosterSlots(leagueSlug, optimum.assignments);
      if (!result.success) {
        toast.error(result.error ?? "Could not set optimum lineup.");
        return;
      }
      toast.success("Optimum lineup set");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Optimum lineup</DialogTitle>
          <DialogDescription>
            Best available starters by this week&apos;s projections. Players
            already in games stay locked.
          </DialogDescription>
        </DialogHeader>

                {!optimum ? (
          <p className="text-sm text-muted-foreground">
            Optimum lineup is only available for your team.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current projected</span>
              <span className="tabular-nums font-medium">
                {optimum.currentProjectedTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Optimum projected</span>
              <span className="tabular-nums font-semibold">
                {optimum.optimumProjectedTotal.toFixed(2)}
              </span>
            </div>

            <ScrollArea className="max-h-64 rounded-lg border">
            <ul>
              {optimum.slots.map((slot, index) => {
                const changed =
                  !slot.locked &&
                  slot.currentPlayerId !== slot.suggestedPlayerId;
                return (
                  <li
                    key={`${slot.slotPositionId}-${index}`}
                    className="flex items-start justify-between gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{slot.slotLabel}</div>
                      <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        <span className="truncate">
                          {slot.currentPlayerName ?? "Empty"}
                        </span>
                        {changed ? (
                          <>
                            <HugeiconsIcon
                              icon={ArrowRight02Icon}
                              strokeWidth={1.5}
                              className="size-3.5 shrink-0"
                              aria-hidden
                            />
                            <span className="truncate text-foreground">
                              {slot.suggestedPlayerName ?? "Empty"}
                            </span>
                          </>
                        ) : null}
                        {slot.locked ? (
                          <span className="shrink-0 text-xs">(locked)</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 tabular-nums text-muted-foreground">
                      {(
                        slot.suggestedProjectedPts ??
                        slot.currentProjectedPts ??
                        0
                      ).toFixed(1)}
                    </div>
                  </li>
                );
              })}
            </ul>
            </ScrollArea>
          </div>
        )}
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={1.5}
              data-icon="inline-start"
            />
            Close
          </Button>
          <Button
            onClick={handleApply}
            disabled={!optimum?.canApply || isPending}
          >
            <HugeiconsIcon
              icon={CheckmarkCircle03Icon}
              strokeWidth={1.5}
              data-icon="inline-start"
            />
            Set optimum lineup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
