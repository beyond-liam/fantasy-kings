"use client";

import { useState } from "react";
import { Bookmark02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  useIsWatched,
  useToggleWatchlist,
} from "@/components/rankings/watchlist-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type WatchlistToggleProps = {
  playerId: string;
  label?: string;
};

export function WatchlistToggle({ playerId, label }: WatchlistToggleProps) {
  const watched = useIsWatched(playerId);
  const toggle = useToggleWatchlist();
  const [open, setOpen] = useState(false);
  const tooltip =
    label ?? (watched ? "Remove from watchlist" : "Add to watchlist");

  return (
    <TooltipProvider delay={0}>
      <Tooltip open={open} onOpenChange={setOpen} disableHoverablePopup>
        <TooltipTrigger
          delay={0}
          closeOnClick={false}
          render={<span className="inline-flex" />}
          onPointerEnter={() => setOpen(true)}
          onPointerLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        >
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={tooltip}
            aria-pressed={watched}
            onClick={() => {
              setOpen(false);
              toggle(playerId);
            }}
            className={cn(
              "bg-input shadow-none hover:bg-input/80",
              watched &&
                "border-transparent bg-transparent hover:bg-transparent",
            )}
          >
            <span className="relative flex size-4 items-center justify-center">
              <span
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                  watched
                    ? "scale-100 opacity-100 blur-0"
                    : "scale-[0.25] opacity-0 blur-xs",
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
                  "flex items-center justify-center transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                  watched
                    ? "scale-[0.25] opacity-0 blur-xs"
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
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="z-100">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
