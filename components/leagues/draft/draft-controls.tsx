"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowTurnBackwardIcon,
  CheckmarkCircle02Icon,
  PauseIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  pauseDraft,
  revertLastDraftPick,
  startDraft,
} from "@/lib/actions/draft";
import type { DraftScheduleSlot } from "@/lib/leagues/draft/board";

type DraftControlsProps = {
  slug: string;
  isCommissioner: boolean;
  status: "scheduled" | "live" | "paused" | "complete" | null;
  onTheClock: DraftScheduleSlot | null;
  canStart: boolean;
  canRevert: boolean;
  startBlockedReason?: string | null;
};

export function DraftControls({
  slug,
  isCommissioner,
  status,
  onTheClock,
  canStart,
  canRevert,
  startBlockedReason,
}: DraftControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const run = (
    action: () => Promise<{ success: boolean; error?: string }>,
    successMessage?: string,
  ) => {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      if (successMessage) {
        toast.success(successMessage);
      }
      router.refresh();
    });
  };

  const showControls =
    isCommissioner &&
    (status === "live" ||
      status === "paused" ||
      status === null ||
      status === "scheduled");

  if (status === "complete") {
    return (
      <Alert variant="success">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
        <AlertTitle>Draft complete</AlertTitle>
        <AlertDescription>
          All picks are in. Rosters are ready for the season.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {onTheClock ? (
          <p className="text-sm">
            <span className="text-muted-foreground">On the clock: </span>
            <span className="font-medium">{onTheClock.teamName}</span>
            <span className="text-muted-foreground">
              {" "}
              · Round {onTheClock.round}, Pick {onTheClock.overall}
            </span>
            {status === "paused" ? (
              <span className="text-warning"> · Paused</span>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Draft has not started yet.
          </p>
        )}
      </div>

      {showControls ? (
        <div className="flex flex-wrap gap-2">
          {canRevert ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                run(() => revertLastDraftPick(slug), "Pick reverted.")
              }
            >
              <HugeiconsIcon
                icon={ArrowTurnBackwardIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Revert pick
            </Button>
          ) : null}
          {status === "live" ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() => run(() => pauseDraft(slug))}
            >
              <HugeiconsIcon
                icon={PauseIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Pause draft
            </Button>
          ) : (
            <Button
              type="button"
              disabled={isPending || (!canStart && status !== "paused")}
              title={
                !canStart && status !== "paused"
                  ? (startBlockedReason ?? undefined)
                  : undefined
              }
              onClick={() => run(() => startDraft(slug))}
            >
              <HugeiconsIcon
                icon={PlayIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              {status === "paused" ? "Resume draft" : "Start draft"}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
