"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar03Icon,
  Cancel01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
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
import { startNewSeason } from "@/lib/actions/start-new-season";

type StartNewSeasonAlertProps = {
  slug: string;
  nextSeasonYear: number;
};

export function StartNewSeasonAlert({
  slug,
  nextSeasonYear,
}: StartNewSeasonAlertProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setError(null);
  };

  const handleStart = () => {
    setError(null);
    startTransition(async () => {
      const result = await startNewSeason(slug);
      if (!result.success) {
        setError(result.error ?? "Could not start the next season.");
        return;
      }
      toast.success(`Started the ${result.seasonYear ?? nextSeasonYear} season.`);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Alert variant="info">
        <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />
        <AlertTitle>Start the {nextSeasonYear} season</AlertTitle>
        <AlertDescription>
          Keepers carry over, FAAB resets, and draft order is reverse
          regular-season finish. Future draft picks are minted for each team.
        </AlertDescription>
        <AlertAction>
          <Button type="button" size="sm" onClick={() => handleOpenChange(true)}>
            <HugeiconsIcon
              icon={Calendar03Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Start new season
          </Button>
        </AlertAction>
      </Alert>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-balance">
              Start the {nextSeasonYear} season?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              Creates the {nextSeasonYear} season, carries keepers onto new
              rosters, resets FAAB, sets waiver order from reverse finish (1st
              place picks last), and mints future draft picks. Configure the
              draft after this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p className="text-sm text-pretty text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              <HugeiconsIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleStart}
            >
              <HugeiconsIcon
                icon={Tick02Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Start new season
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
