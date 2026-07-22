"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowTurnBackwardIcon,
  PauseIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  pauseDraft,
  revertLastDraftPick,
  startDraft,
} from "@/lib/actions/draft";

type DraftStatus = "scheduled" | "live" | "paused" | "complete" | null;

type DraftActionOptions = {
  successMessage?: string;
  optimisticStatus?: DraftStatus;
};

function useDraftActions(
  slug: string,
  status: DraftStatus,
  onStatusOptimistic?: (status: DraftStatus) => void,
) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const run = (
    action: () => Promise<{ success: boolean; error?: string }>,
    options?: DraftActionOptions,
  ) => {
    const previousStatus = status;
    if (options?.optimisticStatus != null) {
      onStatusOptimistic?.(options.optimisticStatus);
    }
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        if (options?.optimisticStatus != null) {
          onStatusOptimistic?.(previousStatus);
        }
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      if (options?.successMessage) {
        toast.success(options.successMessage);
      }
      router.refresh();
    });
  };

  return { isPending, run };
}

type DraftRevertControlProps = {
  slug: string;
  isCommissioner: boolean;
  status: DraftStatus;
  canRevert: boolean;
  onStatusOptimistic?: (status: DraftStatus) => void;
};

/** Commissioner revert — shown under the page title. */
export function DraftRevertControl({
  slug,
  isCommissioner,
  status,
  canRevert,
  onStatusOptimistic,
}: DraftRevertControlProps) {
  const { isPending, run } = useDraftActions(
    slug,
    status,
    onStatusOptimistic,
  );

  if (
    !isCommissioner ||
    !canRevert ||
    (status !== "live" && status !== "paused")
  ) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        run(() => revertLastDraftPick(slug), {
          successMessage: "Pick reverted.",
        })
      }
    >
      <HugeiconsIcon
        icon={ArrowTurnBackwardIcon}
        strokeWidth={2}
        data-icon="inline-start"
      />
      Revert pick
    </Button>
  );
}

type DraftClockToggleProps = {
  slug: string;
  isCommissioner: boolean;
  status: DraftStatus;
  startHint?: string | null;
  onStatusOptimistic?: (status: DraftStatus) => void;
};

/** Play / pause icon opposite the clock card heading. */
export function DraftClockToggle({
  slug,
  isCommissioner,
  status,
  startHint,
  onStatusOptimistic,
}: DraftClockToggleProps) {
  const { isPending, run } = useDraftActions(
    slug,
    status,
    onStatusOptimistic,
  );

  if (
    !isCommissioner ||
    status === "complete" ||
    (status !== "live" &&
      status !== "paused" &&
      status !== null &&
      status !== "scheduled")
  ) {
    return null;
  }

  const isLive = status === "live";
  const label = isLive
    ? "Pause draft"
    : status === "paused"
      ? "Resume draft"
      : "Start draft";
  const hint =
    !isLive && status !== "paused" && startHint ? startHint : label;

  const button = (
    <Button
      type="button"
      variant="default"
      size="icon-sm"
      disabled={isPending}
      aria-label={label}
      onClick={() => {
        if (isLive) {
          run(() => pauseDraft(slug), {
            optimisticStatus: "paused",
            successMessage: "Draft paused.",
          });
          return;
        }
        run(() => startDraft(slug), {
          optimisticStatus: "live",
          successMessage:
            status === "paused" ? "Draft resumed." : "Draft started.",
        });
      }}
    >
      <HugeiconsIcon
        icon={isLive ? PauseIcon : PlayIcon}
        strokeWidth={2}
      />
    </Button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={button} />
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
