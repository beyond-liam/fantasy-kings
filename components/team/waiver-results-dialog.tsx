"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { markWaiverResultsSeen } from "@/lib/actions/waivers";
import type { UnseenWaiverResult } from "@/lib/queries/activity";

type WaiverResultsDialogProps = {
  leagueSlug: string;
  results: UnseenWaiverResult[];
  waiverType: "priority" | "faab";
};

export function WaiverResultsDialog({
  leagueSlug,
  results,
  waiverType,
}: WaiverResultsDialogProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [prevResults, setPrevResults] = useState(results);
  const [isPending, startTransition] = useTransition();

  if (results !== prevResults) {
    setPrevResults(results);
    setDismissed(false);
  }

  const open = !dismissed && results.length > 0;

  if (results.length === 0) {
    return null;
  }

  const awarded = results.filter((row) => row.status === "awarded");
  const failed = results.filter((row) => row.status === "failed");

  const dismiss = () => {
    startTransition(async () => {
      await markWaiverResultsSeen(leagueSlug);
      setDismissed(true);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          dismiss();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Waiver results</DialogTitle>
          <DialogDescription>
            Here&apos;s what happened with your claims from the latest
            processing run.
          </DialogDescription>
        </DialogHeader>

                <div className="grid gap-4">
          {awarded.length > 0 ? (
            <section className="grid gap-2">
              <h3 className="text-sm font-medium">Successful</h3>
              <ul className="divide-y rounded-lg border">
                {awarded.map((row) => (
                  <li key={row.id} className="px-3 py-2 text-sm">
                    <p className="font-medium">{row.playerName}</p>
                    <p className="text-muted-foreground">
                      {[
                        waiverType === "faab" && row.bid != null
                          ? `$${row.bid}`
                          : null,
                        row.dropPlayerName
                          ? `Dropped ${row.dropPlayerName}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Claim awarded"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {failed.length > 0 ? (
            <section className="grid gap-2">
              <h3 className="text-sm font-medium">Unsuccessful</h3>
              <ul className="divide-y rounded-lg border">
                {failed.map((row) => (
                  <li key={row.id} className="px-3 py-2 text-sm">
                    <p className="font-medium">{row.playerName}</p>
                    <p className="text-muted-foreground">
                      {row.failReason?.trim() || "Claim failed."}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        
        <DialogFooter>
          <Button type="button" disabled={isPending} onClick={dismiss}>
            <HugeiconsIcon
              icon={TickDouble02Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
