"use client";

import { PlusSignSquareIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  useIsQueued,
  useToggleDraftQueue,
} from "@/components/leagues/draft/draft-queue-provider";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DraftQueueToggleProps = {
  playerId: string;
  disabled?: boolean;
};

export function DraftQueueToggle({
  playerId,
  disabled,
}: DraftQueueToggleProps) {
  const queued = useIsQueued(playerId);
  const toggle = useToggleDraftQueue();

  const control = (
    <Toggle
      size="sm"
      variant="default"
      pressed={queued}
      disabled={disabled}
      onPressedChange={() => toggle(playerId)}
      className={cn(
        "relative size-8 min-w-8 p-0",
        "after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2",
        "data-pressed:bg-transparent dark:data-pressed:bg-transparent",
      )}
      aria-label={queued ? "Remove from queue" : "Add player to queue"}
    >
      <HugeiconsIcon
        icon={PlusSignSquareIcon}
        strokeWidth={2}
        className={cn(
          queued ? "text-warning" : "text-muted-foreground",
          queued && "fill-warning/20",
        )}
      />
    </Toggle>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={control} />
        <TooltipContent>
          {queued ? "Remove from queue" : "Add player to queue"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
