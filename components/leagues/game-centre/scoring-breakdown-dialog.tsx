"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PlayerPointsExplanation } from "@/lib/leagues/scoring/calculate";

type ScoringBreakdownDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
  week: number;
  explanation: PlayerPointsExplanation | null;
};

export function ScoringBreakdownDialog({
  open,
  onOpenChange,
  playerName,
  week,
  explanation,
}: ScoringBreakdownDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{playerName}</DialogTitle>
          <DialogDescription>Week {week} scoring breakdown</DialogDescription>
        </DialogHeader>

                {!explanation || explanation.lines.length === 0 ? (
          <p className="text-sm text-pretty text-muted-foreground">
            No scoring detail available for this player yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
              {explanation.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 text-pretty">
                    <span className="text-foreground">{line.label}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      ({line.statValue})
                    </span>
                  </span>
                  <span
                    className={
                      line.points < 0
                        ? "shrink-0 tabular-nums text-destructive"
                        : "shrink-0 tabular-nums font-medium"
                    }
                  >
                    {line.points > 0 ? "+" : ""}
                    {line.points.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {explanation.total.toFixed(2)}
              </span>
            </div>
          </div>
        )}
              </DialogContent>
    </Dialog>
  );
}
