"use client";

import { Bookmark02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  useIsWatched,
  useToggleWatchlist,
} from "@/components/rankings/watchlist-provider";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

type WatchlistToggleProps = {
  playerId: string;
  label?: string;
};

export function WatchlistToggle({ playerId, label }: WatchlistToggleProps) {
  const watched = useIsWatched(playerId);
  const toggle = useToggleWatchlist();

  return (
    <Toggle
      size="sm"
      variant="default"
      pressed={watched}
      onPressedChange={() => toggle(playerId)}
      className={cn(
        "relative size-8 min-w-8 p-0",
        "after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2",
        "data-pressed:bg-transparent dark:data-pressed:bg-transparent",
      )}
      aria-label={
        label ??
        (watched ? "Remove from watchlist" : "Add to watchlist")
      }
    >
      <span className="relative flex size-4 items-center justify-center">
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-[opacity,filter,scale] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)]",
            watched
              ? "scale-100 opacity-100 blur-0"
              : "scale-[0.25] opacity-0 blur-[4px]",
          )}
          aria-hidden
        >
          <HugeiconsIcon
            icon={Bookmark02Icon}
            strokeWidth={2}
            className="fill-warning stroke-warning text-warning"
          />
        </span>
        <span
          className={cn(
            "flex items-center justify-center transition-[opacity,filter,scale] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)]",
            watched
              ? "scale-[0.25] opacity-0 blur-[4px]"
              : "scale-100 opacity-100 blur-0",
          )}
          aria-hidden
        >
          <HugeiconsIcon
            icon={Bookmark02Icon}
            strokeWidth={2}
            className="text-muted-foreground"
          />
        </span>
      </span>
    </Toggle>
  );
}
